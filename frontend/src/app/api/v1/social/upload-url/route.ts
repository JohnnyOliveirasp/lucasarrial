/**
 * POST /api/v1/social/upload-url — upload de mídia do COMPUTADOR pro Publicador.
 * Devolve presigned PUT no R2 (prefixo {user}/social-uploads/). O arquivo vira
 * fonte da publicação (r2://…) e o sweeper apaga 7 dias após publicar/falhar.
 */
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticate } from "@/lib/api/auth";
import { badRequest, forbidden, jsonOk, unauthorized } from "@/lib/api/responses";
import { socialPublisherEnabled } from "@/lib/social/access";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedPut } from "@/lib/r2/presigned";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "video/mp4"]);
const MAX_NAME = 60;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await socialPublisherEnabled(auth.user_id))) return forbidden();

  let body: { filename?: string; content_type?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const contentType = (body.content_type ?? "").toLowerCase().trim();
  if (!ALLOWED.has(contentType)) {
    return badRequest("Formato não suportado — use JPG, PNG, WebP ou MP4");
  }
  const safe = (body.filename ?? "arquivo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-MAX_NAME);
  const key = `${auth.user_id}/social-uploads/${randomUUID()}_${safe}`;
  const uploadUrl = await createPresignedPut(imagesBucket(), key, contentType, 3600);
  return jsonOk({
    key,
    upload_url: uploadUrl,
    media_type: contentType === "video/mp4" ? "reel" : "image",
  });
}
