/**
 * GET /api/v1/social/instagram/callback — retorno do OAuth do Instagram.
 * Valida o state HMAC → troca code por token short-lived → long-lived (~60d)
 * → busca o perfil → salva a conta com token CRIPTOGRAFADO. Sempre termina
 * em redirect pra tela do Publicador (?connected=1 ou ?error=...).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/db/admin";
import { encryptToken, verifyOauthState } from "@/lib/social/crypto";
import {
  exchangeCode,
  friendlyInstagramError,
  getProfile,
  toLongLived,
} from "@/lib/social/instagram";

const LAB_PATH = "/app/lab/publicador";

function labRedirect(
  request: NextRequest,
  params: Record<string, string>,
  locale = "pt-BR",
): NextResponse {
  // ⚠️ atrás do nginx, request.nextUrl.origin vira http://localhost:3002 —
  // sempre montar o redirect com a URL PÚBLICA (caso Johnny 06/08). O locale
  // vem do state pro /en|/es não se perder na volta do OAuth.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const path = locale && locale !== "pt-BR" ? `/${locale}${LAB_PATH}` : LAB_PATH;
  const url = new URL(path, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  // Aluno cancelou a autorização no Instagram
  if (query.get("error")) {
    return labRedirect(request, { error: "denied" });
  }
  const code = query.get("code");
  const state = query.get("state");
  const verified = state ? verifyOauthState(state) : null;
  if (!code || !verified) return labRedirect(request, { error: "state" });
  const { userId, locale } = verified;

  try {
    const short = await exchangeCode(code);
    const long = await toLongLived(short.accessToken);
    const profile = await getProfile(long.accessToken);
    const { error } = await getAdmin()
      .from("social_accounts")
      .upsert(
        {
          user_id: userId,
          platform: "instagram",
          account_ref: profile.igUserId,
          username: profile.username,
          auth_kind: "instagram_login",
          access_token_encrypted: encryptToken(long.accessToken),
          token_expires_at: long.expiresAt.toISOString(),
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,account_ref" },
      );
    if (error) return labRedirect(request, { error: "save" }, locale);
    return labRedirect(request, { connected: "1", username: profile.username }, locale);
  } catch (e) {
    console.error("[social/instagram/callback]", e);
    return labRedirect(request, { error: "exchange", detail: friendlyInstagramError(e) }, locale);
  }
}
