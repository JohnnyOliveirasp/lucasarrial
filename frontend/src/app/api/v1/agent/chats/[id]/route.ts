/**
 * GET /api/v1/agent/chats/[id] — mensagens de uma conversa do suporte
 * (ordem cronológica, últimas 200). Admin-only.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: chat, error } = await admin
    .from("agent_chats")
    .select("id, wa_jid, kind, name, mode, last_message_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return serverError("Failed to load chat");
  if (!chat) return notFound("Chat");

  const { data: messages, error: mErr } = await admin
    .from("agent_messages")
    .select("id, sender_name, from_me, role, kind, content, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (mErr) return serverError("Failed to load messages");

  return jsonOk({ chat, messages: (messages ?? []).reverse() });
}
