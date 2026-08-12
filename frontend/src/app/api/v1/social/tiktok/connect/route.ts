/**
 * GET /api/v1/social/tiktok/connect — início do OAuth do TikTok (Login Kit).
 * Mesmo desenho do instagram/connect: URL de autorização com state HMAC.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { forbidden, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { socialPublisherEnabled } from "@/lib/social/access";
import { makeOauthState } from "@/lib/social/crypto";
import { authorizeUrl } from "@/lib/social/tiktok";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await socialPublisherEnabled(auth.user_id))) return forbidden();
  const locale = request.nextUrl.searchParams.get("locale") ?? "pt-BR";
  try {
    return jsonOk({ url: authorizeUrl(makeOauthState(auth.user_id, locale)) });
  } catch {
    return serverError("Publicador sem credenciais do TikTok no servidor");
  }
}
