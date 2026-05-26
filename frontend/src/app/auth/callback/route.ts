/**
 * OAuth callback handler — Supabase redirects here after:
 *  (a) Google/email OAuth signin → `?code=<pkce_code>`
 *  (b) Email confirmation link (signup) → `?token_hash=<hash>&type=signup`
 *  (c) Magic link / password reset → `?token_hash=<hash>&type=magiclink|recovery`
 *
 * Lives outside [locale] so the Supabase Site URL doesn't need locale prefixes.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // `next` deve ser sempre um caminho interno (evita open-redirect).
  const requestedNext = searchParams.get("next") || "/app/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/app/dashboard";

  // Atrás do nginx, `origin` (de request.url) vira o host interno
  // (localhost:3002), o que vazava no redirect. Usamos a URL pública.
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? origin).replace(/\/+$/, "");

  const supabase = await createClient();

  // OAuth (Google) ou PKCE signup confirm
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return NextResponse.redirect(`${baseUrl}${next}`);
  }

  // Email confirmation (signup, magiclink, recovery, invite, email_change)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return NextResponse.redirect(`${baseUrl}${next}`);
  }

  return NextResponse.redirect(`${baseUrl}/login?error=missing_code_or_token`);
}
