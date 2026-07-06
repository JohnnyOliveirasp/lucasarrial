/**
 * POST /api/v1/videos/upload-audio
 * Gera o presigned PUT pro usuário subir o PRÓPRIO áudio (voz dele) que vira
 * um projeto de vídeo. O browser valida a duração (≤90s) ANTES de pedir o
 * upload; a validação definitiva acontece na criação do projeto (Whisper mede
 * a duração real). Aqui só validamos tipo e tamanho.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { R2_BUCKETS } from "@/lib/r2/client";
import {
  buildVideoUploadAudioKey,
  createPresignedPut,
  isAllowedAudioMime,
} from "@/lib/r2/presigned";

/** 25MB cobre 90s até em WAV; MP3 de 90s tem ~2MB. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { filename?: unknown; content_type?: unknown; size?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  const size = typeof body.size === "number" ? body.size : 0;

  if (!filename || !contentType) return badRequest("Arquivo inválido.");
  if (!isAllowedAudioMime(contentType)) {
    return badRequest("Formato não suportado. Envie MP3, WAV, M4A, OGG ou FLAC.");
  }
  if (size <= 0 || size > MAX_UPLOAD_BYTES) {
    return badRequest("Arquivo muito grande (máx. 25MB).");
  }

  try {
    const key = buildVideoUploadAudioKey(auth.user_id, randomUUID(), filename);
    const upload_url = await createPresignedPut(R2_BUCKETS.generations, key, contentType, 1800);
    return jsonOk({ key, upload_url, expires_in_seconds: 1800 });
  } catch {
    return serverError("Failed to create upload URL");
  }
}
