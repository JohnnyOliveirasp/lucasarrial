/**
 * /api/v1/api-keys
 *   GET  → lista as chaves do usuário (sem o segredo; só prefixo + metadados)
 *   POST → cria uma nova chave { name? }. Retorna o segredo `key` UMA ÚNICA VEZ.
 *
 * Gerenciamento só via SESSÃO do painel (cookie) — uma API key não cria/gerencia
 * outras chaves (evita escalada). Geração: aiv_<64 hex>, guardado como sha256.
 */
import type { NextRequest } from "next/server";
import { authenticate, generateApiKey } from "@/lib/api/auth";
import {
  forbidden,
  jsonOk,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list API keys");
  return jsonOk({ api_keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (auth.source !== "cookie") {
    return forbidden("Crie chaves pelo painel (sessão), não via API key");
  }

  let body: { name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body → usa nome padrão */
  }
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 60)
      : "Minha chave";

  const { plain, hash, prefix } = generateApiKey();
  const admin = getAdmin();
  const { data, error } = await admin
    .from("api_keys")
    .insert({
      user_id: auth.user_id,
      name,
      key_prefix: prefix,
      key_hash: hash,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) return serverError("Failed to create API key");

  // `key` (segredo) só aparece AQUI — não é recuperável depois (guardamos só o hash).
  return jsonOk({ api_key: { ...data, key: plain } }, 201);
}
