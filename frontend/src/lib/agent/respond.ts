/**
 * Agente de suporte — pipeline de resposta. Server-only.
 * Decide se a mensagem recém-ingerida merece resposta da IA e responde.
 *
 * Guards (decisões do Johnny 2026-07-13):
 *   - PRIVADO: responde QUALQUER pessoa (assunto restrito à plataforma pelo
 *     prompt; toda conversa fica registrada no banco/painel)
 *   - GRUPO: só quando a mensagem MARCA (@) ou RESPONDE o número do suporte
 *     — e a resposta sai CITANDO a pessoa
 *   - só chats em mode 'auto' (etiqueta humano cala a IA — F2)
 *   - DEBOUNCE: espera a pessoa terminar de "picotar" as mensagens e responde
 *     UMA vez (a mensagem mais nova responde; as anteriores desistem)
 *   - RATE-LIMIT: máximo de respostas da IA por chat/24h (anti-flood/custo)
 * Áudio: baixa do provedor → Whisper → responde a transcrição.
 * Imagem: baixa e a Mary VÊ (print de erro, comprovante) — multimodal.
 * Escalação: marcador [ESCALAR: ...] na resposta → pausa a IA no chat e
 * avisa a equipe (WhatsApp + e-mail) — ver lib/agent/escalate.ts.
 * Best-effort: nunca lança (o webhook não pode falhar por causa da IA).
 */
import { getAdmin } from "@/lib/db/admin";
import { buildAccountContext, ensureChatIdentity } from "@/lib/agent/account";
import { buildAgentReply, type AgentImage } from "@/lib/agent/brain";
import { fetchMediaBytes } from "@/lib/agent/provider";
import { sendHumanized } from "@/lib/agent/humanize";
import { extractEscalation, notifyTeamEscalation } from "@/lib/agent/escalate";
import type { IngestedMessage } from "@/lib/agent/ingest";
import { transcribeAudioBuffer } from "@/lib/video/transcribe";
import type { AgentMessageRow } from "@/lib/db/types";

const HISTORY_LIMIT = 50; // memória da conversa: a Mary relê as últimas 50
const DEBOUNCE_MS = Number(process.env.AGENT_DEBOUNCE_MS ?? 6_000);
const RATE_LIMIT_PER_DAY = Number(process.env.AGENT_RATE_LIMIT_PER_DAY ?? 40);
const IMAGE_MAX_BYTES = 4_500_000; // limite da API (5MB) com folga
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Interruptor GERAL (botão "Desligar" do painel — F2). */
export async function agentEnabled(): Promise<boolean> {
  const { data } = await getAdmin().from("agent_settings").select("enabled").eq("id", 1).maybeSingle();
  return (data as { enabled?: boolean } | null)?.enabled !== false;
}

/**
 * Auto-pausa (F2): humano respondeu pelo CELULAR/web nessa conversa → a IA
 * cala nela até um admin devolver. Chamado pelo webhook quando chega fromMe
 * que não é eco do pipeline (eco cai no dedupe e nem chega aqui).
 */
export async function pauseChatForHuman(chatId: string): Promise<void> {
  await getAdmin()
    .from("agent_chats")
    .update({ mode: "human" } as never)
    .eq("id", chatId)
    .eq("mode", "auto");
}

/**
 * Debounce das mensagens picotadas: dorme e confere se chegou mensagem MAIS
 * NOVA do aluno neste chat. Se chegou, ESTA desiste (a mais nova responde
 * pelo lote inteiro — o histórico já junta os turns consecutivos).
 */
async function supersededAfterDebounce(msg: IngestedMessage): Promise<boolean> {
  if (DEBOUNCE_MS <= 0) return false;
  await sleep(DEBOUNCE_MS);
  const { data } = await getAdmin()
    .from("agent_messages")
    .select("id")
    .eq("chat_id", msg.chat.id)
    .eq("from_me", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestId = (data as { id: string } | null)?.id;
  return Boolean(latestId && latestId !== msg.messageId);
}

/** Grava uma resposta enviada (uma row por parte — dedupe do eco por id). */
async function saveAgentParts(
  chatId: string,
  parts: { waMessageId: string | null; text: string }[],
): Promise<void> {
  const admin = getAdmin();
  for (const part of parts) {
    await admin.from("agent_messages").insert({
      chat_id: chatId,
      wa_message_id: part.waMessageId,
      from_me: true,
      role: "agent",
      kind: "text",
      content: part.text,
    } as never);
  }
}

/**
 * Anti-flood: nº de respostas da IA neste chat nas últimas 24h. No exato
 * momento em que estoura o limite, avisa a pessoa UMA vez; depois, silêncio
 * (a janela desliza — no dia seguinte a Mary volta sozinha).
 */
async function overRateLimit(msg: IngestedMessage): Promise<boolean> {
  if (RATE_LIMIT_PER_DAY <= 0) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await getAdmin()
    .from("agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", msg.chat.id)
    .eq("from_me", true)
    .eq("role", "agent")
    .gte("created_at", since);
  const n = count ?? 0;
  if (n < RATE_LIMIT_PER_DAY) return false;
  if (n === RATE_LIMIT_PER_DAY) {
    const notice =
      "Opa, a gente já trocou bastante mensagem hoje! 😅 Pra assuntos novos me chama de novo amanhã — e se for urgente, escreve pra suporte@fastcloner.com que a equipe te responde.";
    const sent = await sendHumanized(msg.chat.wa_jid, notice, {
      group: msg.chat.kind === "group",
      replyTo: msg.chat.kind === "group" ? msg.replyToId : null,
    });
    await saveAgentParts(msg.chat.id, sent);
  }
  return true;
}

/** Baixa a imagem recebida e prepara pro Claude (base64 + media type). */
async function prepareImage(msg: IngestedMessage): Promise<AgentImage | null> {
  try {
    const bytes = await fetchMediaBytes({ waMessageId: msg.waMessageId, mediaUrl: msg.mediaUrl });
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > IMAGE_MAX_BYTES) return null;
    const mediaType =
      msg.mediaType && IMAGE_TYPES.has(msg.mediaType) ? msg.mediaType : "image/jpeg";
    return { data: bytes.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

/** Responde a mensagem ingerida quando os guards permitem. Nunca lança. */
export async function maybeRespond(msg: IngestedMessage): Promise<void> {
  try {
    if (msg.fromMe) return;
    if (msg.chat.mode !== "auto") return;
    if (!(await agentEnabled())) return; // botão geral "Desligada"
    // Grupo: só quando marcada/respondida. Privado: responde qualquer pessoa.
    if (msg.chat.kind === "group" && !msg.mentioned) return;
    if (msg.kind !== "text" && msg.kind !== "audio" && msg.kind !== "image") return;

    const admin = getAdmin();

    // Áudio → transcreve e grava a transcrição na própria mensagem (SEMPRE,
    // mesmo que o debounce descarte esta: o histórico precisa do texto).
    if (msg.kind === "audio") {
      const bytes = await fetchMediaBytes({ waMessageId: msg.waMessageId, mediaUrl: msg.mediaUrl });
      if (!bytes) return;
      const t = await transcribeAudioBuffer(new Uint8Array(bytes), "audio.ogg");
      if (!t.text) return;
      await admin
        .from("agent_messages")
        .update({ content: `[áudio] ${t.text}` } as never)
        .eq("id", msg.messageId);
    } else if (msg.kind === "image") {
      // Marca no histórico que veio uma imagem (com a legenda, se houver).
      await admin
        .from("agent_messages")
        .update({
          content: `[imagem]${msg.content?.trim() ? ` ${msg.content.trim()}` : ""}`,
        } as never)
        .eq("id", msg.messageId);
    } else if (!msg.content?.trim()) {
      return;
    }

    // Mensagens picotadas: a mais nova responde pelo lote; esta desiste.
    if (await supersededAfterDebounce(msg)) return;
    // Durante a espera um humano pode ter assumido/pausado — re-checa o modo.
    const { data: freshChat } = await admin
      .from("agent_chats")
      .select("mode")
      .eq("id", msg.chat.id)
      .maybeSingle();
    if ((freshChat as { mode?: string } | null)?.mode !== "auto") return;
    // Anti-flood por chat/24h.
    if (await overRateLimit(msg)) return;

    // Histórico (asc) — a última precisa ser do aluno (é o que respondemos).
    const { data: rows } = await admin
      .from("agent_messages")
      .select("*")
      .eq("chat_id", msg.chat.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const history = ((rows ?? []) as AgentMessageRow[]).reverse();
    if (history.length === 0 || history[history.length - 1].from_me) return;

    // F4: no privado, resolve quem é o aluno (LID→telefone→perfil) e entrega
    // o snapshot da conta pra Mary responder com dados reais (só leitura).
    let account: string | null = null;
    if (msg.chat.kind === "private") {
      const profileId = await ensureChatIdentity(msg.chat);
      if (profileId) account = await buildAccountContext(profileId);
    }

    // Print/comprovante: a Mary vê a imagem da mensagem que disparou a resposta.
    const image = msg.kind === "image" ? await prepareImage(msg) : null;

    const reply = await buildAgentReply(history, {
      group: msg.chat.kind === "group",
      account,
      image,
    });
    // Escalação real: o marcador interno sai da mensagem e vira aviso à equipe.
    const { clean, reason } = extractEscalation(reply);
    if (!clean) return;

    // Envio humanizado: visto + digitando… + (no privado) até 3 mensagens.
    // No grupo a resposta sai CITANDO a mensagem de quem marcou.
    const sent = await sendHumanized(msg.chat.wa_jid, clean, {
      group: msg.chat.kind === "group",
      replyTo: msg.chat.kind === "group" ? msg.replyToId : null,
    });
    await saveAgentParts(msg.chat.id, sent);
    await admin
      .from("agent_chats")
      .update({ last_message_at: new Date().toISOString() } as never)
      .eq("id", msg.chat.id);

    // Escalou: pausa a IA nesta conversa e avisa a equipe (WhatsApp → e-mail).
    if (reason) {
      await pauseChatForHuman(msg.chat.id);
      await notifyTeamEscalation({
        chat: msg.chat,
        reason,
        lastUserText: history[history.length - 1]?.content ?? msg.content,
      });
    }
  } catch (e) {
    console.error("[agent] resposta falhou:", e instanceof Error ? e.message : e);
  }
}
