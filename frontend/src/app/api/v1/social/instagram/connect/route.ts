/**
 * GET /api/v1/social/instagram/connect — início do OAuth do publicador.
 * Devolve a URL de autorização do Instagram com `state` HMAC amarrado ao
 * usuário logado (o callback valida). O aluno precisa de conta Profissional.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { forbidden, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { socialPublisherEnabled } from "@/lib/social/access";
import { makeOauthState } from "@/lib/social/crypto";
import { authorizeUrl } from "@/lib/social/instagram";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await socialPublisherEnabled(auth.user_id))) return forbidden();
  const locale = request.nextUrl.searchParams.get("locale") ?? "pt-BR";
  try {
    return jsonOk({ url: authorizeUrl(makeOauthState(auth.user_id, locale)) });
  } catch {
    return serverError("Publicador sem credenciais do Instagram no servidor");
  }
}
