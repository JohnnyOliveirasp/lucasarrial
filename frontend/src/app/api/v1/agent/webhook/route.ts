/**
 * POST /api/v1/agent/webhook?token=... — recebe os eventos da Evolution API
 * (instância do WhatsApp do suporte). MESSAGES_UPSERT → grava no banco (F0)
 * e aciona a IA quando os guards permitem (F1: privado + allowlist).
 * Segurança: a Evolution não assina o payload — o gate é o token secreto na
 * URL (env AGENT_WEBHOOK_TOKEN), configurado só no webhook da instância.
 * Responde 200 SEMPRE que autenticado (a Evolution re-tenta em erro).
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { ingestMessage, type EvolutionMessage } from "@/lib/agent/ingest";
import { maybeRespond } from "@/lib/agent/respond";

type EvolutionWebhook = {
  event?: string;
  instance?: string;
  data?: unknown;
  /** WAHA: { event: "message", session, payload: {...} } */
  session?: string;
  payload?: WahaMessagePayload;
};

type WahaMessagePayload = {
  id?: string;
  from?: string;
  to?: string;
  fromMe?: boolean;
  participant?: string | null;
  body?: string;
  hasMedia?: boolean;
  media?: { url?: string; mimetype?: string } | null;
  _data?: { notifyName?: string };
};

/** Converte o payload da WAHA (webjs) pro shape Evolution/Baileys do ingest. */
function wahaToEvolution(p: WahaMessagePayload): { m: EvolutionMessage; mediaUrl: string | null } {
  const norm = (jid: string | null | undefined) =>
    (jid ?? "").replace(/@c\.us$/, "@s.whatsapp.net");
  const mime = p.media?.mimetype ?? "";
  const messageType = !p.hasMedia
    ? "conversation"
    : mime.startsWith("audio")
      ? "audioMessage"
      : mime.startsWith("image")
        ? "imageMessage"
        : mime.startsWith("video")
          ? "videoMessage"
          : "documentMessage";
  return {
    m: {
      key: {
        remoteJid: norm(p.from),
        fromMe: p.fromMe === true,
        // id serializado do webjs: "false_1321...@c.us_<ID>" → só o <ID>
        // (mesmo valor que o sendText devolve — o dedupe do eco depende disso)
        id: (p.id ?? "").split("_").pop() || p.id || undefined,
        participant: p.participant ? norm(p.participant) : undefined,
      },
      pushName: p._data?.notifyName,
      messageType,
      message: { conversation: p.body || undefined },
    },
    mediaUrl: p.media?.url ?? null,
  };
}

export async function POST(request: NextRequest) {
  const token = process.env.AGENT_WEBHOOK_TOKEN;
  if (!token || request.nextUrl.searchParams.get("token") !== token) {
    return jsonError("unauthorized", "Invalid token", 401);
  }

  let payload: EvolutionWebhook;
  try {
    payload = (await request.json()) as EvolutionWebhook;
  } catch {
    return jsonOk({ handled: false });
  }

  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");

  // WAHA (webjs): evento "message" com payload plano.
  if (event === "message" && payload.payload) {
    const { m, mediaUrl } = wahaToEvolution(payload.payload);
    const ingested = await ingestMessage(m, { mediaUrl });
    if (ingested) await maybeRespond(ingested);
    return jsonOk({ handled: "waha_message" });
  }

  if (event === "messages.upsert" && payload.data) {
    // O upsert pode vir como 1 mensagem ou como lote { messages: [...] }.
    const d = payload.data as { messages?: EvolutionMessage[] } & EvolutionMessage;
    const list = Array.isArray(d.messages) ? d.messages : [d];
    for (const m of list) {
      const ingested = await ingestMessage(m);
      if (ingested) await maybeRespond(ingested);
    }
    return jsonOk({ handled: "messages", count: list.length });
  }

  return jsonOk({ handled: "ignored", event });
}
