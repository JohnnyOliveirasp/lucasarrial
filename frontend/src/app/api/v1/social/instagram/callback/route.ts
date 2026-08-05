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

function labRedirect(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL(LAB_PATH, request.nextUrl.origin);
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
  const userId = state ? verifyOauthState(state) : null;
  if (!code || !userId) return labRedirect(request, { error: "state" });

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
    if (error) return labRedirect(request, { error: "save" });
    return labRedirect(request, { connected: "1", username: profile.username });
  } catch (e) {
    console.error("[social/instagram/callback]", e);
    return labRedirect(request, { error: "exchange", detail: friendlyInstagramError(e) });
  }
}
