/**
 * Fast no app — balão de ajuda da plataforma.
 *   GET  → histórico do chat do usuário logado (últimas 50)
 *   POST → { text, pathname?, image?: { data(base64), media_type } } → resposta da Fast
 *
 * Mesmo cérebro do WhatsApp (manual + Sonnet + visão), mas identidade vem do
 * LOGIN (sem telefone): o contexto da conta é sempre o do próprio usuário.
 * Escalação [ESCALAR/-TECNICO] → CHAMADO (fila do Frank) + e-mail pra equipe.
 * O WhatsApp está pausado.
 * Rate-limit por usuário/dia (HELP_RATE_LIMIT_PER_DAY, default 60).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { buildAgentReply, type AgentImage } from "@/lib/agent/brain";
import { buildAccountContext } from "@/lib/agent/account";
import { extractEscalation } from "@/lib/agent/escalate";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import { transcribeAudioBuffer } from "@/lib/video/transcribe";
import type { AgentMessageRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 40;
const TEXT_MAX = 2000;
const RATE_LIMIT_PER_DAY = Number(process.env.HELP_RATE_LIMIT_PER_DAY ?? 60);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_MAX_B64 = 6_000_000; // ~4,5MB de imagem (limite da API com folga)
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"]);
const AUDIO_MAX_B64 = 8_000_000; // ~6MB (~1min de opus sobra muito)

/** Fast fala (TTS OpenAI): resposta em áudio quando o aluno mandou áudio. */
async function fastTts(text: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    // Tira markdown/emoji da fala (o texto formatado continua indo por escrito).
    const spoken = text
      .replace(/\*\*?|__|~~|`/g, "")
      .replace(/\p{Extended_Pictographic}/gu, "")
      .trim()
      .slice(0, 1500);
    if (!spoken) return null;
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "nova", input: spoken, response_format: "mp3" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null; // áudio é bônus — nunca derruba a resposta em texto
  }
}

type HelpRow = {
  id: string;
  from_me: boolean;
  content: string;
  pathname: string | null;
  has_image: boolean;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { data, error } = await getAdmin()
    .from("help_messages")
    .select("id, from_me, content, pathname, has_image, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return serverError("Failed to load help chat");
  return jsonOk({ messages: ((data ?? []) as HelpRow[]).reverse() });
}

/** Contexto do canal web pro system prompt (substitui o "mundo WhatsApp"). */
function webSystemExtra(pathname: string | null, locale: string): string {
  return [
    `CANAL: você está no CHAT DE AJUDA DENTRO DA PLATAFORMA (balão flutuante no app), não no WhatsApp. A pessoa está LOGADA e navegando agora.`,
    pathname ? `PÁGINA ATUAL do aluno: ${pathname} — use isso pra orientar ("clica em...", "nesse menu à esquerda...").` : "",
    `IDIOMA: a interface do aluno está em "${locale}". Responda SEMPRE nesse idioma (se a pessoa escrever em outro, siga o idioma dela).`,
    `PRINTS: quando o aluno mandar um print da tela, descreva o que fazer apontando os elementos que aparecem nele.`,
    `Não mencione WhatsApp como canal seu; se precisar de humano, diga que a equipe foi avisada e responde por e-mail (suporte@fastcloner.com).`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Escalação no canal web: e-mail pra equipe (zap da Fast está pausado). */
async function emailEscalation(args: {
  email: string;
  reason: string;
  lastText: string;
  pathname: string | null;
  technical: boolean;
  /** Chamado aberto pra esta escalação (#150) — o time cita esse número. */
  numero: number | null;
}): Promise<void> {
  try {
    // Pedido Johnny 05/08: escalações da Fast só pra ele + suporte@ (era admin_emails inteira).
    // Caso Anderson 11/08: escalação TÉCNICA só pra suporte@ morria sem humano
    // (a caixa é atendida pela própria Fast) — Johnny entra em TODAS.
    const to = new Set<string>([SUPPORT_EMAIL, "johnny.oliveirasp@gmail.com"]);
    await sendEmail({
      to: [...to],
      subject: `${args.technical ? "⚙️ ERRO TÉCNICO" : "🙋 Aluno pedindo humano"} — help do app${args.numero != null ? ` — #${args.numero}` : ""} — ${args.email}`,
      html:
        `<p>Escalação da Fast no <strong>chat de ajuda do app</strong>.</p><ul>` +
        (args.numero != null
          ? `<li><strong>Chamado:</strong> #${args.numero} (aba Falhas do /admin)</li>`
          : `<li><strong>Chamado:</strong> ⚠️ NÃO abriu — este e-mail é o único registro</li>`) +
        `<li><strong>Aluno:</strong> ${escapeHtml(args.email)}</li>` +
        `<li><strong>Situação:</strong> ${escapeHtml(args.reason)}</li>` +
        (args.pathname ? `<li><strong>Página:</strong> ${escapeHtml(args.pathname)}</li>` : "") +
        `<li><strong>Última mensagem:</strong> "${escapeHtml(args.lastText.slice(0, 300))}"</li>` +
        `</ul><p>Responda o aluno por e-mail (o chat do app não tem resposta humana ainda).</p>`,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Escalação no chat do app vira CHAMADO — o buraco do incidente #150.
 *
 * O bot promete ao aluno "vou chamar alguém da equipe" / "a equipe foi
 * avisada" e, até 27/08, esse texto não tinha NENHUM caminho até a tabela
 * `incidents`. Só saía o e-mail do `emailEscalation` — que cai na caixa do
 * suporte@ atendida pela própria Fast, e que é `try/catch` vazio: se o Resend
 * falhasse, a escalação evaporava sem rastro. Medido em 27/08: 11 alunos com
 * promessa de escalação e zero chamado; a Zethe (#151) pediu ajuda 4x em
 * 1h e o bot prometeu 3 vezes que a equipe sabia. Ninguém sabia.
 *
 * É o MESMO defeito que a Viviana expôs no e-mail (19/08) e a Carol no zap
 * (22/08), pela terceira vez em canal diferente: quem escreveu o caminho de
 * um canal não replicou no outro.
 *
 * Dedupe por `help:<fila>:<email>`, espelhando o e-mail (`fast-email:...`):
 * no chat do app a identidade é 1 aluno = 1 conversa, então o aluno que
 * insiste 3x soma 3 ocorrências no MESMO chamado — exatamente o que faltou
 * pra Zethe — e um pedido novo depois de `fixed` REABRE. Nada novo no banco:
 * o índice UNIQUE parcial da mig 92 + `inserirChamadoUnico` já resolvem a
 * corrida (lição do #110, "1 problema virava 6 chamados").
 *
 * ⚠️ POR QUE ESTE CANAL NÃO CHAMA `entregarAoTime` (e o e-mail chama):
 * no e-mail, "avisa o grupo e FECHA" (#82, ordem do Johnny 24/08) funciona
 * porque quem pegar responde o aluno pelo suporte@. O chat do app NÃO TEM
 * resposta humana — o próprio texto do `emailEscalation` abaixo diz isso. Um
 * chamado fechado como "entregue ao time" num canal sem caminho de volta é
 * precisamente como a Zethe se perdeu. Aqui o chamado FICA ABERTO até alguém
 * responder de verdade. Se/quando o chat ganhar resposta humana, alinhar com
 * o e-mail.
 */
async function abrirChamadoDoChat(args: {
  email: string;
  reason: string;
  lastText: string;
  pathname: string | null;
  technical: boolean;
}): Promise<number | null> {
  try {
    return await abrirChamadoReportado({
      signature: `help:${args.technical ? "tec" : "atend"}:${args.email}`,
      title: `Fast (chat do app${args.technical ? "" : ", atendimento"}): ${args.reason.slice(0, 90)}`,
      description:
        (args.technical
          ? `Relato do aluno no CHAT DE AJUDA DENTRO DO APP — a Fast não conseguiu resolver e escalou. Resumo dela: ${args.reason}`
          : `Pedido de ATENDIMENTO no CHAT DE AJUDA DENTRO DO APP (cobrança, cancelamento, reembolso ou dúvida de conta) — a Fast não resolve isso sozinha e prometeu ao aluno que a equipe verificaria. Resumo dela: ${args.reason}`) +
        (args.pathname ? `

Página onde ele estava: ${args.pathname}` : "") +
        `

⚠️ O aluno está esperando DENTRO do app e não recebe resposta humana por lá: responda por e-mail.`,
      reportedBy: "fast-help",
      categoria: args.technical ? "tecnico" : "atendimento",
      affectedEmails: [args.email],
      sampleError: args.lastText,
    });
  } catch (e) {
    // Best-effort como nos outros canais: nunca derruba a resposta ao aluno.
    console.error("[help] falha ao abrir chamado:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: {
    text?: unknown;
    pathname?: unknown;
    locale?: unknown;
    image?: { data?: unknown; media_type?: unknown } | null;
    audio?: { data?: unknown; media_type?: unknown } | null;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  let text = typeof body.text === "string" ? body.text.trim() : "";
  const pathname =
    typeof body.pathname === "string" ? body.pathname.slice(0, 200) : null;
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : "pt-BR";

  let image: AgentImage | null = null;
  if (body.image && typeof body.image === "object") {
    const data = typeof body.image.data === "string" ? body.image.data : "";
    const mediaType = typeof body.image.media_type === "string" ? body.image.media_type : "";
    if (!IMAGE_TYPES.has(mediaType)) return badRequest("Formato de imagem não suportado");
    if (!data || data.length > IMAGE_MAX_B64) return badRequest("Imagem grande demais (máx ~4MB)");
    image = { data, mediaType };
  }

  // Áudio (voz do aluno, estilo WhatsApp): Whisper transcreve no idioma da
  // interface e a transcrição vira a mensagem. Resposta volta em texto + TTS.
  let voiceNote = false;
  if (body.audio && typeof body.audio === "object") {
    const data = typeof body.audio.data === "string" ? body.audio.data : "";
    const mediaType = typeof body.audio.media_type === "string" ? body.audio.media_type : "";
    if (!AUDIO_TYPES.has(mediaType)) return badRequest("Formato de áudio não suportado");
    if (!data || data.length > AUDIO_MAX_B64) return badRequest("Áudio grande demais (máx 60s)");
    try {
      const ext = mediaType.split("/")[1] ?? "webm";
      const tr = await transcribeAudioBuffer(
        Buffer.from(data, "base64"),
        `voice.${ext}`,
        locale.slice(0, 2),
      );
      if (!tr.text) return badRequest("Não consegui entender o áudio — tenta de novo?");
      text = tr.text.trim().slice(0, TEXT_MAX);
      voiceNote = true;
    } catch (e) {
      console.error("[help] transcrição falhou:", e instanceof Error ? e.message : e);
      return serverError("Não consegui processar o áudio agora — escreva a dúvida ou tente de novo.");
    }
  }

  if (!text && !image) return badRequest("Mensagem vazia");
  if (text.length > TEXT_MAX) return badRequest(`Mensagem máx ${TEXT_MAX} caracteres`);

  const admin = getAdmin();

  // Rate-limit: respostas da Fast pra este usuário nas últimas 24h.
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { count } = await admin
    .from("help_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user_id)
    .eq("from_me", true)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_PER_DAY) {
    return jsonError(
      "rate_limited",
      "Você atingiu o limite de mensagens de hoje no chat de ajuda. Escreva pra suporte@fastcloner.com que a equipe continua de lá.",
      429,
    );
  }

  // Grava a mensagem do aluno.
  const userContent = voiceNote ? `🎤 ${text}` : text || "[imagem]";
  const { error: insErr } = await admin.from("help_messages").insert({
    user_id: auth.user_id,
    from_me: false,
    content: image && text ? `${userContent}\n[o aluno anexou um print]` : userContent,
    pathname,
    has_image: Boolean(image),
  } as never);
  if (insErr) return serverError("Failed to save message");

  // Histórico → formato do cérebro (só content/from_me/sender_name importam).
  const { data: hist } = await admin
    .from("help_messages")
    .select("from_me, content, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = ((hist ?? []) as HelpRow[])
    .reverse()
    .map(
      (m) =>
        ({
          content: m.content,
          from_me: m.from_me,
          sender_name: null,
        }) as unknown as AgentMessageRow,
    );

  // Conta SEMPRE identificada (login). Falhou o snapshot → aviso neutro (sem
  // cair no texto "não localizada pelo telefone", que é do WhatsApp).
  const account =
    (await buildAccountContext(auth.user_id)) ??
    "Conta logada identificada, mas o snapshot não carregou agora. Responda normalmente; pra saldo/pagamento exatos, oriente recarregar a página ou escrever pra suporte@fastcloner.com.";

  let reply: string;
  try {
    reply = await buildAgentReply(history, {
      account,
      image,
      systemExtra: webSystemExtra(pathname, locale),
    });
  } catch (e) {
    console.error("[help] Fast falhou:", e instanceof Error ? e.message : e);
    return serverError("Assistente indisponível agora — tente de novo em instantes.");
  }

  const { clean, reason, technical } = extractEscalation(reply);
  if (reason) {
    const email = auth.email ?? "?";
    // O chamado primeiro: é o registro que sobrevive: o e-mail é aviso, não memória.
    const numero = await abrirChamadoDoChat({ email, reason, lastText: userContent, pathname, technical });
    await emailEscalation({ email, reason, lastText: userContent, pathname, technical, numero });
  }
  const finalReply = clean || reply;

  const { data: saved, error: repErr } = await admin
    .from("help_messages")
    .insert({ user_id: auth.user_id, from_me: true, content: finalReply, pathname } as never)
    .select("id, from_me, content, pathname, has_image, created_at")
    .single();
  if (repErr) return serverError("Failed to save reply");

  // Aluno mandou voz → Fast responde falando também (best-effort).
  const replyAudio = voiceNote ? await fastTts(finalReply) : null;

  return jsonOk({
    message: saved,
    user_transcript: voiceNote ? userContent : null,
    reply_audio: replyAudio ? { data: replyAudio, media_type: "audio/mpeg" } : null,
  });
}
