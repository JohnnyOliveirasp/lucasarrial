/**
 * POST /api/v1/video-clone/upload-url
 * Presigned PUT pros DOIS insumos do Vídeo Clone: a foto da pessoa e o áudio.
 * Browser valida duração (≤90s) antes; a validação definitiva (Whisper) roda
 * na criação do job. Aqui só tipo e tamanho.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedPut, isAllowedAudioMime, isAllowedImageMime } from "@/lib/r2/presigned";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25MB cobre 90s até em WAV
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function safeExt(filename: string, fallback: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : fallback;
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { kind?: unknown; filename?: unknown; content_type?: unknown; size?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }

  const kind = body.kind === "image" ? "image" : body.kind === "audio" ? "audio" : null;
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  const size = typeof body.size === "number" ? body.size : 0;

  if (!kind || !filename || !contentType) return badRequest("Arquivo inválido.");

  if (kind === "audio") {
    if (!isAllowedAudioMime(contentType)) {
      return badRequest("Formato não suportado. Envie MP3, WAV, M4A, OGG ou FLAC.");
    }
    if (size <= 0 || size > MAX_AUDIO_BYTES) return badRequest("Áudio muito grande (máx. 25MB).");
  } else {
    if (!isAllowedImageMime(contentType)) {
      return badRequest("Formato não suportado. Envie PNG, JPG ou WEBP.");
    }
    if (size <= 0 || size > MAX_IMAGE_BYTES) return badRequest("Imagem muito grande (máx. 12MB).");
  }

  try {
    const ext = safeExt(filename, kind === "audio" ? "mp3" : "png");
    const key = `${auth.user_id}/video-clone/uploads/${randomUUID()}.${ext}`;
    const upload_url = await createPresignedPut(R2_BUCKETS.generations, key, contentType, 1800);
    return jsonOk({ key, upload_url, expires_in_seconds: 1800 });
  } catch {
    return serverError("Failed to create upload URL");
  }
}
