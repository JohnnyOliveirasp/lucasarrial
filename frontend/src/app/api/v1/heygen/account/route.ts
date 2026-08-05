/**
 * /api/v1/heygen/account — conexão BYOK do HeyGen ("HeyGen dentro do FastCloner").
 *
 *   POST   → conecta: valida a API key no HeyGen (chamada de LEITURA: quota),
 *            salva CRIPTOGRAFADA (upsert por usuário) e devolve o resumo.
 *   GET    → estado da conexão (SEM a key — nem mascarada).
 *   DELETE → desconecta (apaga a key).
 *
 * Auth: cookie (frontend) OU X-API-Key. A key do HeyGen nunca volta ao client.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { encryptApiKey } from "@/lib/heygen/crypto";
import { getRemainingQuota, friendlyHeygenError } from "@/lib/heygen/client";
import type { HeygenAccountRow } from "@/lib/db/types";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { api_key?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const apiKey = (body.api_key ?? "").trim();
  if (!apiKey || apiKey.length < 20) return badRequest("Cole a API key do HeyGen");

  // Valida com uma chamada de LEITURA (não gasta créditos do aluno).
  let credits: number;
  try {
    credits = (await getRemainingQuota(apiKey)).credits;
  } catch (e) {
    return badRequest(friendlyHeygenError(e));
  }

  const { error } = await getAdmin()
    .from("heygen_accounts")
    .upsert(
      {
        user_id: auth.user_id,
        api_key_encrypted: encryptApiKey(apiKey),
        status: "active",
        remaining_credits: credits,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) return serverError("Não foi possível salvar a conexão");
  return jsonOk({ connected: true, remaining_credits: credits });
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const { data } = await getAdmin()
    .from("heygen_accounts")
    .select("status, remaining_credits, last_validated_at, created_at")
    .eq("user_id", auth.user_id)
    .maybeSingle();
  const row = data as Pick<
    HeygenAccountRow,
    "status" | "remaining_credits" | "last_validated_at" | "created_at"
  > | null;
  return jsonOk({ connected: Boolean(row && row.status === "active"), account: row });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  await getAdmin().from("heygen_accounts").delete().eq("user_id", auth.user_id);
  return jsonOk({ connected: false });
}
