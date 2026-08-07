/**
 * POST /api/v1/images/ref-url
 *
 * Presigned GET de uma imagem do PRÓPRIO usuário (referência fixa do estúdio,
 * 29/07): o estúdio guarda só a CHAVE R2 da referência (localStorage) e pede
 * aqui uma URL fresca pra exibir o preview após reload/sessão nova.
 *
 * Body: { key: string } → { url: string }
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { imagesBucket } from "@/lib/r2/client";
import { objectExists } from "@/lib/r2/exists";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const key = (body.key ?? "").trim();
  // Mesma defesa do generate: só chaves do espaço de imagens do próprio usuário.
  if (!key || !key.startsWith(`${auth.user_id}/images/`)) {
    return badRequest("Imagem de referência inválida");
  }

  try {
    // Chave morta (imagem apagada do histórico) → 404: o estúdio limpa a
    // referência fixa do localStorage em !ok (caso 06/08, rajadas do Kie).
    if (!(await objectExists(imagesBucket(), key))) return notFound("Imagem de referência");
    const url = await createPresignedGet(imagesBucket(), key, 60 * 60);
    return jsonOk({ url });
  } catch (e) {
    return serverError(e instanceof Error ? `R2 presigned: ${e.message}` : "R2 presigned failed");
  }
}
