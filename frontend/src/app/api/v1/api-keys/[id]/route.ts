/**
 * DELETE /api/v1/api-keys/[id] → revoga (soft) a chave do usuário.
 * Só via sessão do painel. Idempotente: revogar de novo retorna ok.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  forbidden,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (auth.source !== "cookie") {
    return forbidden("Revogue chaves pelo painel (sessão), não via API key");
  }
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data, error } = await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id")
    .maybeSingle();

  if (error) return serverError("Failed to revoke API key");
  if (!data) return notFound("API key");
  return jsonOk({ revoked: true });
}
