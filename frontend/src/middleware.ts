/**
 * Root middleware — runs on every request.
 *
 * Responsibilities (in order):
 * 1. Refresh Supabase auth tokens via updateSupabaseSession()
 * 2. Run next-intl locale routing (redirects /foo → /pt-BR/foo if needed)
 * 3. Protect /[locale]/app/** — redirect to /[locale]/login if unauthenticated
 * 4. Merge Supabase auth cookies onto the final response
 */
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

// Regex aceitam locale opcional (pt-BR é default sem prefix em "as-needed")
const APP_PATH_RE = /^\/(?:(pt-BR|en|es)\/)?app(\/|$)/;
const AUTH_PATH_RE = /^\/(?:(pt-BR|en|es)\/)?(login|signup|forgot-password)(\/|$)/;

function extractLocale(pathname: string): string {
  const match = pathname.match(/^\/(pt-BR|en|es)(\/|$)/);
  return match?.[1] ?? routing.defaultLocale;
}

function withLocalePrefix(locale: string, path: string): string {
  // Como localePrefix="as-needed", default locale não recebe prefixo.
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path}`;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSupabaseSession(request);

  const { pathname } = request.nextUrl;

  // /auth/* (callback, etc.) is NOT localized — skip intl rewriting.
  // Still keeps Supabase session cookies (set above via updateSupabaseSession).
  if (pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  const locale = extractLocale(pathname);

  if (APP_PATH_RE.test(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/login");
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PATH_RE.test(pathname) && user) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/app/dashboard");
    return NextResponse.redirect(url);
  }

  const intlResponse = intlMiddleware(request);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
