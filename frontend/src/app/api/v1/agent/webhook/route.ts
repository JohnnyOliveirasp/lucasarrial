/**
 * POST /api/v1/agent/webhook?token=... — recebe os eventos da Evolution API
 * (instância do WhatsApp do suporte). F0: só MESSAGES_UPSERT → grava no banco.
 * Segurança: a Evolution não assina o payload — o gate é o token secreto na
 * URL (env AGENT_WEBHOOK_TOKEN), configurado só no webhook da instância.
 * Responde 200 SEMPRE que autenticado (a Evolution re-tenta em erro).
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { ingestMessage, type EvolutionMessage } from "@/lib/agent/ingest";

type EvolutionWebhook = {
  event?: string;
  instance?: string;
  data?: unknown;
};

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
  if (event === "messages.upsert" && payload.data) {
    // O upsert pode vir como 1 mensagem ou como lote { messages: [...] }.
    const d = payload.data as { messages?: EvolutionMessage[] } & EvolutionMessage;
    const list = Array.isArray(d.messages) ? d.messages : [d];
    for (const m of list) await ingestMessage(m);
    return jsonOk({ handled: "messages", count: list.length });
  }

  return jsonOk({ handled: "ignored", event });
}
