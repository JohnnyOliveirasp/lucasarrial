/**
 * POST /api/v1/agent/chats/[id]/send — admin responde a conversa PELO PAINEL
 * (sai pelo número do suporte). Assumir implícito: a conversa vai pra mode
 * 'human' (IA cala até alguém devolver). Admin-only. F2.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { sendAgentText } from "@/lib/agent/provider";
import type { AgentChatRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const { id } = await ctx.params;

  let body: { text?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return badRequest("Mensagem vazia");
  if (text.length > 3000) return badRequest("Mensagem longa demais (máx. 3000)");

  const admin = getAdmin();
  const { data: chat, error } = await admin
    .from("agent_chats")
    .select("id, wa_jid, mode")
    .eq("id", id)
    .maybeSingle();
  if (error) return serverError("Failed to load chat");
  if (!chat) return notFound("Chat");
  const row = chat as Pick<AgentChatRow, "id" | "wa_jid" | "mode">;

  let sentId: string | null = null;
  try {
    sentId = await sendAgentText(row.wa_jid, text);
  } catch (e) {
    console.error("[agent] envio manual falhou:", e instanceof Error ? e.message : e);
    return serverError("Não consegui enviar a mensagem. Confira a conexão do WhatsApp.");
  }

  await admin.from("agent_messages").insert({
    chat_id: row.id,
    wa_message_id: sentId,
    from_me: true,
    role: "human",
    kind: "text",
    content: text,
  } as never);
  await admin
    .from("agent_chats")
    .update({ mode: "human", last_message_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return jsonOk({ sent: true, mode: "human" }, 201);
}
