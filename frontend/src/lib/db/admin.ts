/**
 * Supabase admin client (service_role) — bypassa RLS.
 * Use SOMENTE em route handlers / server actions, NUNCA no client.
 *
 * Para queries de usuário (respeitando RLS), use lib/supabase/server.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _admin: SupabaseClient<Database> | null = null;

export function getAdmin(): SupabaseClient<Database> {
  if (_admin) return _admin;
  _admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _admin;
}
