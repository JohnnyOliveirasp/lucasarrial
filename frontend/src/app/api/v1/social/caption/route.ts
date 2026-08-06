/**
 * POST /api/v1/social/caption — "✨ Gerar legenda" do popup de publicação.
 * Recebe o contexto do conteúdo (prompt da imagem / roteiro do vídeo), o
 * idioma da página e a ideia opcional da pessoa, e devolve legenda com
 * hashtags via Haiku no idioma pedido. Admin-only até o App Review.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, forbidden, jsonOk, unauthorized } from "@/lib/api/responses";
import { socialPublisherEnabled } from "@/lib/social/access";
import { generateInstagramCaption } from "@/lib/llm/generate-caption";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await socialPublisherEnabled(auth.user_id))) return forbidden();

  let body: { context?: string; locale?: string; idea?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const caption = await generateInstagramCaption(body.context ?? "", {
    locale: body.locale,
    idea: body.idea,
  });
  return jsonOk({ caption });
}
