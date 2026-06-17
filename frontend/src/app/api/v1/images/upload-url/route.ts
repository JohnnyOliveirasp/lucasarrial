/**
 * POST /api/v1/images/upload-url
 *
 * Devolve um presigned PUT pro browser subir a imagem de REFERÊNCIA direto no
 * R2 (não passa pelo backend). Retorna a `key` que o /generate vai usar depois.
 *
 * Body: { filename: string, content_type: string }
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { imagesBucket } from "@/lib/r2/client";
import {
  buildInputImageKey,
  createPresignedPut,
  isAllowedImageMime,
} from "@/lib/r2/presigned";

const PRESIGN_EXPIRES = 60 * 60; // 1h

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { filename?: string; content_type?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const filename = (body.filename ?? "").trim();
  const contentType = (body.content_type ?? "").trim();
  if (!filename || !contentType) {
    return badRequest("'filename' e 'content_type' são obrigatórios");
  }
  if (!isAllowedImageMime(contentType)) {
    return badRequest(`Formato não suportado: ${contentType}. Use JPG, PNG ou WEBP.`);
  }

  const imageId = randomUUID();
  const key = buildInputImageKey(auth.user_id, imageId, filename);

  try {
    const uploadUrl = await createPresignedPut(
      imagesBucket(),
      key,
      contentType,
      PRESIGN_EXPIRES,
    );
    return jsonOk({ key, upload_url: uploadUrl, expires_in_seconds: PRESIGN_EXPIRES });
  } catch (e) {
    return serverError(
      e instanceof Error ? `R2 presigned: ${e.message}` : "R2 presigned failed",
    );
  }
}
