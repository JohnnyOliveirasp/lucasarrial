/**
 * Agente de suporte — ingestão de mensagens do webhook da Evolution (F0).
 * Extrai o texto/tipo do payload do Baileys, garante o chat no banco e grava
 * a mensagem (dedupe por wa_message_id). Server-only. Ainda NÃO responde —
 * o cérebro entra na F1.
 */
import { getAdmin } from "@/lib/db/admin";
import { getGroupSubject } from "@/lib/agent/evolution";
import type { AgentChatRow, AgentMessageKind } from "@/lib/db/types";

/** Shape (parcial) do data de MESSAGES_UPSERT da Evolution v2 (Baileys). */
export type EvolutionMessage = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string };
  pushName?: string;
  messageType?: string;
  message?: Record<string, unknown> & {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { fileName?: string };
  };
};

const IGNORED_TYPES = new Set([
  "protocolMessage", "reactionMessage", "pollUpdateMessage", "messageContextInfo",
]);

function kindOf(type: string | undefined): AgentMessageKind {
  switch (type) {
    case "conversation":
    case "extendedTextMessage":
      return "text";
    case "audioMessage":
      return "audio";
    case "imageMessage":
      return "image";
    case "videoMessage":
      return "video";
    case "documentMessage":
    case "documentWithCaptionMessage":
      return "document";
    case "stickerMessage":
      return "sticker";
    default:
      return "other";
  }
}

function textOf(m: EvolutionMessage): string | null {
  const msg = m.message ?? {};
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.fileName ||
    null
  );
}

/** Garante a row do chat (cria com nome do grupo/contato na primeira vez). */
async function ensureChat(jid: string, m: EvolutionMessage): Promise<AgentChatRow | null> {
  const admin = getAdmin();
  const { data: existing } = await admin
    .from("agent_chats")
    .select("*")
    .eq("wa_jid", jid)
    .maybeSingle();
  if (existing) return existing as AgentChatRow;

  const isGroup = jid.endsWith("@g.us");
  const name = isGroup
    ? await getGroupSubject(jid)
    : m.key?.fromMe
      ? null // privado iniciado por nós: nome vem quando a pessoa responder
      : m.pushName || null;

  const { data: created } = await admin
    .from("agent_chats")
    .insert({ wa_jid: jid, kind: isGroup ? "group" : "private", name } as never)
    .select("*")
    .maybeSingle();
  if (created) return created as AgentChatRow;

  // Corrida entre 2 webhooks: alguém criou primeiro — relê.
  const { data: retry } = await admin.from("agent_chats").select("*").eq("wa_jid", jid).maybeSingle();
  return (retry as AgentChatRow | null) ?? null;
}

/** Ingere UMA mensagem do webhook. Nunca lança (webhook responde 200 sempre). */
export async function ingestMessage(m: EvolutionMessage): Promise<void> {
  try {
    const jid = m.key?.remoteJid ?? "";
    if (!jid || jid === "status@broadcast") return;
    const type = m.messageType;
    if (type && IGNORED_TYPES.has(type)) return;

    const chat = await ensureChat(jid, m);
    if (!chat) return;

    const fromMe = m.key?.fromMe === true;
    const admin = getAdmin();
    await admin.from("agent_messages").insert({
      chat_id: chat.id,
      wa_message_id: m.key?.id ?? null,
      sender_jid: fromMe ? null : (m.key?.participant ?? jid),
      sender_name: fromMe ? null : (m.pushName ?? null),
      from_me: fromMe,
      // fromMe na F0 = Johnny respondendo pelo celular (a IA ainda não fala).
      role: fromMe ? "human" : "user",
      kind: kindOf(type),
      content: textOf(m),
    } as never);
    // Índice único (chat_id, wa_message_id) absorve retries — erro é ignorado.

    await admin
      .from("agent_chats")
      .update({
        last_message_at: new Date().toISOString(),
        // Preenche o nome do privado assim que a pessoa fala.
        ...(chat.kind === "private" && !chat.name && !fromMe && m.pushName
          ? { name: m.pushName }
          : {}),
      } as never)
      .eq("id", chat.id);
  } catch {
    // ingestão é best-effort; a mensagem seguinte não pode ser bloqueada
  }
}
