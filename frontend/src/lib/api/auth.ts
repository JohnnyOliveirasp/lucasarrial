/**
 * Dual authentication pra rotas /api/v1/*:
 *   1) Supabase cookie (frontend interno, usuário logado)
 *   2) Header `X-API-Key: <token>` (chamadas externas / SDK / curl)
 *
 * Retorna `{ user_id, source }` em caso de sucesso, ou null se não autenticado.
 */
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type AuthSource = "cookie" | "api_key";
export type AuthResult = { user_id: string; source: AuthSource } | null;

import type { Database } from "@/lib/db/types";

function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function tryCookie(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { user_id: user.id, source: "cookie" };
}

async function tryApiKey(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get("x-api-key");
  if (!header) return null;

  const hash = hashApiKey(header);
  const admin = getServiceClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("user_id, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // best-effort update last_used_at; ignore failure
  await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", hash);

  return { user_id: data.user_id, source: "api_key" };
}

export async function authenticate(request: NextRequest): Promise<AuthResult> {
  return (await tryApiKey(request)) ?? (await tryCookie());
}

export function generateApiKey(): { plain: string; hash: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const plain =
    "aiv_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const hash = hashApiKey(plain);
  const prefix = plain.slice(0, 12);
  return { plain, hash, prefix };
}
