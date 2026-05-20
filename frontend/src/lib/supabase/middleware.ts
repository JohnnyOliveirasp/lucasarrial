/**
 * Supabase middleware helper — refresh expired auth tokens on every request.
 *
 * Called from the root middleware.ts. Returns a NextResponse with refreshed
 * Supabase cookies set on it. The caller is expected to merge those cookies
 * into the final response (e.g. when combining with next-intl middleware).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // CRITICAL: validate against Supabase Auth server (not just cookies).
  // Without this call, sessions never refresh and getUser() returns stale data.
  const { data: { user } } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
