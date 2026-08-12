/**
 * GET /api/v1/social/tiktok/creator-info?account_id= — opções do criador
 * (níveis de privacidade permitidos, duração máxima). A UI de publicar DEVE
 * oferecer exatamente essas opções — exigência da auditoria do TikTok.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { creatorInfo, friendlyTikTokError } from "@/lib/social/tiktok";
import { freshAccessToken } from "@/lib/social/tiktok-publish";
import type { SocialAccountRow } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const accountId = (request.nextUrl.searchParams.get("account_id") ?? "").trim();
  if (!accountId) return badRequest("account_id ausente");

  const { data } = await getAdmin()
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", auth.user_id)
    .eq("platform", "tiktok")
    .maybeSingle();
  const account = data as SocialAccountRow | null;
  if (!account || account.status !== "active") {
    return badRequest("Conta do TikTok não encontrada ou desconectada");
  }
  try {
    const info = await creatorInfo(await freshAccessToken(account));
    return jsonOk({ creator_info: info });
  } catch (e) {
    return serverError(friendlyTikTokError(e));
  }
}
