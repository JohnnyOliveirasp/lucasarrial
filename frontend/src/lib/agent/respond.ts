/**
 * Agente de suporte — pipeline de resposta (F1). Server-only.
 * Decide se a mensagem recém-ingerida merece resposta da IA e responde.
 *
 * Guards da F1 (pré-produção do agente):
 *   - só PRIVADO (🚧 grupo entra na F3, com classificador)
 *   - só chats em mode 'auto' (etiqueta humano cala a IA — F2)
 *   - 🚧 só números da allowlist AGENT_TEST_NUMBERS (csv de dígitos;
 *     vazio/ausente = não responde NINGUÉM — seguro por padrão)
 * Áudio: baixa da Evolution → Whisper → responde a transcrição.
 * Best-effort: nunca lança (o webhook não pode falhar por causa da IA).
 */
import { getAdmin } from "@/lib/db/admin";
import { buildAgentReply } from "@/lib/agent/brain";
import { getMediaBase64, sendText } from "@/lib/agent/evolution";
import type { IngestedMessage } from "@/lib/agent/ingest";
import { transcribeAudioBuffer } from "@/lib/video/transcribe";
import type { AgentMessageRow } from "@/lib/db/types";

const HISTORY_LIMIT = 30;

/** 🚧 F1: allowlist de teste (dígitos, ex. "13522548533,5511999999999"). */
function isAllowedNumber(waJid: string): boolean {
  const allow = (process.env.AGENT_TEST_NUMBERS ?? "")
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter(Boolean);
  if (allow.length === 0) return false;
  const digits = waJid.split("@")[0].replace(/\D/g, "");
  return allow.includes(digits);
}

/** Responde a mensagem ingerida quando os guards permitem. Nunca lança. */
export async function maybeRespond(msg: IngestedMessage): Promise<void> {
  try {
    if (msg.fromMe) return;
    if (msg.chat.kind !== "private") return; // 🚧 F3: grupo
    if (msg.chat.mode !== "auto") return;
    if (!isAllowedNumber(msg.chat.wa_jid)) return; // 🚧 F1: allowlist
    if (msg.kind !== "text" && msg.kind !== "audio") return;

    const admin = getAdmin();

    // Áudio → transcreve e grava a transcrição na própria mensagem.
    if (msg.kind === "audio") {
      if (!msg.waMessageId) return;
      const media = await getMediaBase64(msg.waMessageId);
      if (!media) return;
      const bytes = Buffer.from(media.base64, "base64");
      const ext = media.mimetype.includes("mp4") ? "m4a" : "ogg";
      const t = await transcribeAudioBuffer(new Uint8Array(bytes), `audio.${ext}`);
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

    const reply = await buildAgentReply(history);
    const sentId = await sendText(msg.chat.wa_jid, reply);

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
