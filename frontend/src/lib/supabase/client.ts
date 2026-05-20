/**
 * Supabase browser client (Client Components, "use client").
 *
 * Use this when running in the browser — uses NEXT_PUBLIC_* vars,
 * stores session in cookies (handled by @supabase/ssr).
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
