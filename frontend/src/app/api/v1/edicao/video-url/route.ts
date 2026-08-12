/**
 * GET /api/v1/edicao/video-url?key= — URL presignada (1h) do vídeo EDITADO
 * do wizard (saída dos jobs caption_burn/broll_overlay). A key foi escolhida
 * pelo servidor nos POSTs da edição; aqui só re-validamos a posse pelo
 * prefixo do usuário (mesmo padrão dos GETs de captions/broll).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const key = (request.nextUrl.searchParams.get("key") ?? "").trim();
  const dono =
    key.startsWith(`${auth.user_id}/edicao/captions/`) ||
    key.startsWith(`${auth.user_id}/edicao/broll/`);
  if (!dono || key.includes("..")) return badRequest("key inválida");

  try {
    const video_url = await createPresignedGet(imagesBucket(), key, 3600);
    return jsonOk({ video_url });
  } catch {
    return serverError("Não foi possível assinar a URL do vídeo");
  }
}
