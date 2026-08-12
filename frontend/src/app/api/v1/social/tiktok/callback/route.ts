/**
 * GET /api/v1/social/tiktok/callback — retorno do OAuth do TikTok.
 * Valida state HMAC → troca code por access+refresh token → busca o perfil →
 * salva a conta com tokens CRIPTOGRAFADOS. Redirect pra tela do Publicador.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/db/admin";
import { encryptToken, verifyOauthState } from "@/lib/social/crypto";
import { exchangeCode, friendlyTikTokError, getProfile } from "@/lib/social/tiktok";

const LAB_PATH = "/app/lab/publicador";

function labRedirect(
  request: NextRequest,
  params: Record<string, string>,
  locale = "pt-BR",
): NextResponse {
  // Atrás do nginx o origin interno é localhost — usar sempre a URL pública.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const path = locale && locale !== "pt-BR" ? `/${locale}${LAB_PATH}` : LAB_PATH;
  const url = new URL(path, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  if (query.get("error")) return labRedirect(request, { error: "denied" });
  const code = query.get("code");
  const state = query.get("state");
  const verified = state ? verifyOauthState(state) : null;
  if (!code || !verified) return labRedirect(request, { error: "state" });
  const { userId, locale } = verified;

  try {
    const tokens = await exchangeCode(code);
    const profile = await getProfile(tokens.accessToken);
    const { error } = await getAdmin()
      .from("social_accounts")
      .upsert(
        {
          user_id: userId,
          platform: "tiktok",
          account_ref: tokens.openId,
          username: profile.displayName,
          auth_kind: "tiktok_oauth",
          access_token_encrypted: encryptToken(tokens.accessToken),
          refresh_token_encrypted: encryptToken(tokens.refreshToken),
          token_expires_at: tokens.expiresAt.toISOString(),
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,account_ref" },
      );
    if (error) return labRedirect(request, { error: "save" }, locale);
    return labRedirect(request, { connected: "1", username: profile.displayName }, locale);
  } catch (e) {
    console.error("[social/tiktok/callback]", e);
    return labRedirect(request, { error: "exchange", detail: friendlyTikTokError(e) }, locale);
  }
}
