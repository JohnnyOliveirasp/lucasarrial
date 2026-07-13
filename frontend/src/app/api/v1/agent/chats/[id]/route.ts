/**
 * /api/v1/agent/chats/[id] — Admin-only.
 *   GET   → mensagens da conversa (ordem cronológica, últimas 200)
 *   PATCH → { mode: "auto" | "human" } — Devolver pra IA / Assumir (F2)
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/responses";
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
    .select("id, wa_jid, kind, name, mode, wa_phone, profile_id, last_message_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return serverError("Failed to load chat");
  if (!chat) return notFound("Chat");

  // F4: aluno vinculado (telefone × Hotmart) — e-mail exibido no painel.
  let profile: { email: string; display_name: string | null } | null = null;
  const profileId = (chat as { profile_id?: string | null }).profile_id;
  if (profileId) {
    const { data: p } = await admin
      .from("profiles")
      .select("email, display_name")
      .eq("id", profileId)
      .maybeSingle();
    profile = (p as typeof profile) ?? null;
  }

  const { data: messages, error: mErr } = await admin
    .from("agent_messages")
    .select("id, sender_name, from_me, role, kind, content, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (mErr) return serverError("Failed to load messages");

  return jsonOk({ chat: { ...chat, profile }, messages: (messages ?? []).reverse() });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const { id } = await ctx.params;

  let body: { mode?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (body.mode !== "auto" && body.mode !== "human") {
    return badRequest("'mode' precisa ser 'auto' ou 'human'");
  }

  const { data, error } = await getAdmin()
    .from("agent_chats")
    .update({ mode: body.mode } as never)
    .eq("id", id)
    .select("id, mode")
    .maybeSingle();
  if (error) return serverError("Failed to update chat mode");
  if (!data) return notFound("Chat");
  return jsonOk({ chat: data });
}
