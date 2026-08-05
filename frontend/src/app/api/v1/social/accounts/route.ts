/**
 * /api/v1/social/accounts — contas sociais conectadas do usuário.
 *   GET    → lista (SEM tokens — nem mascarados).
 *   DELETE → desconecta (?id=): apaga a conta e as publicações pendentes dela.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { data } = await getAdmin()
    .from("social_accounts")
    .select("id, platform, username, account_ref, status, token_expires_at, connected_at")
    .eq("user_id", auth.user_id)
    .order("connected_at", { ascending: false });
  return jsonOk({ accounts: data ?? [] });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("id da conta é obrigatório");
  // cascade da FK remove as publicações; filtro por user_id impede apagar dos outros
  await getAdmin().from("social_accounts").delete().eq("id", id).eq("user_id", auth.user_id);
  return jsonOk({ deleted: true });
}
