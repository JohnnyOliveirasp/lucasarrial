/**
 * GET /api/v1/agent/chats — conversas do WhatsApp do suporte (mais recentes
 * primeiro), com a última mensagem de cada uma. Admin-only.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import type { AgentChatRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  const admin = getAdmin();
  const { data: chats, error } = await admin
    .from("agent_chats")
    .select("id, wa_jid, kind, name, mode, last_message_at, created_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) return serverError("Failed to list agent chats");

  const rows = (chats ?? []) as AgentChatRow[];
  const previews = new Map<string, { content: string | null; kind: string; from_me: boolean }>();
  if (rows.length > 0) {
    // Última mensagem de cada chat (1 query, janela pequena).
    const { data: msgs } = await admin
      .from("agent_messages")
      .select("chat_id, content, kind, from_me, created_at")
      .in("chat_id", rows.map((c) => c.id))
      .order("created_at", { ascending: false })
      .limit(400);
    for (const m of (msgs ?? []) as { chat_id: string; content: string | null; kind: string; from_me: boolean }[]) {
      if (!previews.has(m.chat_id)) previews.set(m.chat_id, m);
    }
  }

  return jsonOk({
    chats: rows.map((c) => ({
      ...c,
      preview: previews.get(c.id) ?? null,
    })),
  });
}
