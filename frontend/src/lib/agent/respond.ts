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
 * Áudio: baixa do provedor → Whisper → responde a transcrição.
 * Best-effort: nunca lança (o webhook não pode falhar por causa da IA).
 */
import { getAdmin } from "@/lib/db/admin";
import { buildAgentReply } from "@/lib/agent/brain";
import { fetchAudioBytes, sendAgentText } from "@/lib/agent/provider";
import type { IngestedMessage } from "@/lib/agent/ingest";
import { transcribeAudioBuffer } from "@/lib/video/transcribe";
import type { AgentMessageRow } from "@/lib/db/types";

const HISTORY_LIMIT = 50; // memória da conversa: a Mary relê as últimas 50

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

/** Responde a mensagem ingerida quando os guards permitem. Nunca lança. */
export async function maybeRespond(msg: IngestedMessage): Promise<void> {
  try {
    if (msg.fromMe) return;
    if (msg.chat.mode !== "auto") return;
    if (!(await agentEnabled())) return; // botão geral "Desligada"
    // Grupo: só quando marcada/respondida. Privado: responde qualquer pessoa.
    if (msg.chat.kind === "group" && !msg.mentioned) return;
    if (msg.kind !== "text" && msg.kind !== "audio") return;

    const admin = getAdmin();

    // Áudio → transcreve e grava a transcrição na própria mensagem.
    if (msg.kind === "audio") {
      const bytes = await fetchAudioBytes({ waMessageId: msg.waMessageId, mediaUrl: msg.mediaUrl });
      if (!bytes) return;
      const t = await transcribeAudioBuffer(new Uint8Array(bytes), "audio.ogg");
      if (!t.text) return;
      await admin
        .from("agent_messages")
        .update({ content: `[áudio] ${t.text}` } as never)
        .eq("id", msg.messageId);
    } else if (!msg.content?.trim()) {
      return;
    }

    // Histórico (asc) — a última precisa ser do aluno (é o que respondemos).
    const { data: rows } = await admin
      .from("agent_messages")
      .select("*")
      .eq("chat_id", msg.chat.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const history = ((rows ?? []) as AgentMessageRow[]).reverse();
    if (history.length === 0 || history[history.length - 1].from_me) return;

    const reply = await buildAgentReply(history, { group: msg.chat.kind === "group" });
    // No grupo a resposta sai CITANDO a mensagem de quem marcou.
    const sentId = await sendAgentText(msg.chat.wa_jid, reply, {
      replyTo: msg.chat.kind === "group" ? msg.replyToId : null,
    });

    // Grava a resposta com o wa_message_id do envio — quando o eco fromMe
    // voltar pelo webhook, o índice único descarta a duplicata.
    await admin.from("agent_messages").insert({
      chat_id: msg.chat.id,
      wa_message_id: sentId,
      from_me: true,
      role: "agent",
      kind: "text",
      content: reply,
    } as never);
    await admin
      .from("agent_chats")
      .update({ last_message_at: new Date().toISOString() } as never)
      .eq("id", msg.chat.id);
  } catch (e) {
    console.error("[agent] resposta falhou:", e instanceof Error ? e.message : e);
  }
}
