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
import { decryptApiKey, encryptApiKey } from "@/lib/heygen/crypto";
import { classifyHeygenError, getRemainingQuota, friendlyHeygenError } from "@/lib/heygen/client";
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
  let raw: number;
  try {
    ({ credits, raw } = await getRemainingQuota(apiKey));
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
  return jsonOk({ connected: true, remaining_credits: credits, remaining_quota_raw: raw });
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const { data } = await getAdmin()
    .from("heygen_accounts")
    .select("api_key_encrypted, status, remaining_credits, last_validated_at, created_at")
    .eq("user_id", auth.user_id)
    .maybeSingle();
  const row = data as Pick<
    HeygenAccountRow,
    "api_key_encrypted" | "status" | "remaining_credits" | "last_validated_at" | "created_at"
  > | null;
  // A key NUNCA volta ao client — nem mascarada.
  const account = row
    ? {
        status: row.status,
        remaining_credits: row.remaining_credits,
        last_validated_at: row.last_validated_at,
        created_at: row.created_at,
      }
    : null;
  const connected = Boolean(row && row.status === "active");
  if (!row || !connected) {
    return jsonOk({ connected, account, quota: null });
  }

  /**
   * Cota AO VIVO (14/09). Antes o GET devolvia só `remaining_credits` do banco,
   * que é gravado uma única vez no POST — ou seja, a tela mostrava pra sempre o
   * número do DIA EM QUE O ALUNO CONECTOU. Quem gastou a cota depois continuava
   * vendo o valor antigo e não tinha como saber que tinha chegado a zero.
   * É a mesma chamada de LEITURA da conexão: não gasta cota do aluno.
   */
  try {
    const { credits, raw } = await getRemainingQuota(decryptApiKey(row.api_key_encrypted));
    await getAdmin()
      .from("heygen_accounts")
      .update({
        remaining_credits: credits,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.user_id);
    return jsonOk({
      connected: true,
      account: { ...account, status: "active", remaining_credits: credits },
      quota: { raw, credits, stale: false, error: null, error_kind: null },
    });
  } catch (e) {
    const { kind, message } = classifyHeygenError(e);
    // Só a key RECUSADA invalida a conexão. Cota zerada, instabilidade do
    // HeyGen ou timeout NÃO são motivo pra mandar o aluno reconectar.
    if (kind === "auth") {
      await getAdmin()
        .from("heygen_accounts")
        .update({ status: "invalid", updated_at: new Date().toISOString() })
        .eq("user_id", auth.user_id);
      return jsonOk({
        connected: false,
        account: { ...account, status: "invalid" },
        quota: { raw: null, credits: null, stale: true, error: message, error_kind: kind },
      });
    }
    return jsonOk({
      connected: true,
      account,
      quota: {
        raw: null,
        credits: row.remaining_credits,
        stale: true,
        error: message,
        error_kind: kind,
      },
    });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  await getAdmin().from("heygen_accounts").delete().eq("user_id", auth.user_id);
  return jsonOk({ connected: false });
}
