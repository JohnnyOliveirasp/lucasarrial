/**
 * Geração de presigned URLs pra browser fazer upload direto pro R2.
 * Server-only.
 */
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKETS } from "./client";

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "audio/webm",
]);

export type UploadSlot = {
  index: number;
  key: string;
  upload_url: string;
  expires_in_seconds: number;
};

export function isAllowedAudioMime(mime: string): boolean {
  return ALLOWED_AUDIO_MIME.has(mime.toLowerCase());
}

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIME.has(mime.toLowerCase());
}

/** Chave da imagem de REFERÊNCIA (foto enviada pelo usuário). */
export function buildInputImageKey(
  userId: string,
  imageId: string,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `${userId}/images/${imageId}/input_${safe}`;
}

/** Chave da imagem RESULTANTE (saída do Kie, guardada permanentemente). */
export function buildImageResultKey(
  userId: string,
  imageId: string,
  ext: string,
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${userId}/images/${imageId}/result.${safeExt}`;
}

export function buildRawAudioKey(
  userId: string,
  voiceId: string,
  index: number,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const padded = String(index).padStart(3, "0");
  return `${userId}/${voiceId}/raw/${padded}_${safe}`;
}

export function buildLoraKey(userId: string, voiceId: string): string {
  return `${userId}/${voiceId}/lora.safetensors`;
}

export function buildGenerationKey(userId: string, genId: string): string {
  return `${userId}/${genId}.wav`;
}

/**
 * Chave do áudio ENVIADO pelo usuário pro wizard de vídeo (voz própria).
 * Vive no bucket de generations (mesmo TTL/fluxo dos áudios TTS — o worker de
 * render e o player do projeto já leem desse bucket).
 */
export function buildVideoUploadAudioKey(
  userId: string,
  uploadId: string,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  return `${userId}/video-uploads/${uploadId}_${safe}`;
}

/**
 * Chave DETERMINÍSTICA da referência auto-extraída no treino. Determinística
 * de propósito: o `start-training` cria o presigned PUT com ela e o `webhook`
 * recalcula a mesma chave pra gravar em `voices.reference_audio_path` no fim do
 * treino (sem precisar carregar estado intermediário).
 */
export function buildAutoReferenceKey(userId: string, voiceId: string): string {
  return `${userId}/${voiceId}/ref/auto.wav`;
}

export async function createPresignedPut(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function createPresignedGet(
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function createUploadSlots(
  userId: string,
  voiceId: string,
  files: Array<{ filename: string; content_type: string }>,
): Promise<UploadSlot[]> {
  // 6h: uploads de treino podem ter centenas de MB (1h de áudio WAV/FLAC) e
  // levar muito tempo em conexões lentas. 1h (3600s) estourava a assinatura no
  // meio do upload e o R2 rejeitava com 403 ("falhou ao subir"). R2 aceita
  // presigned até 7 dias; 6h cobre uploads grandes com folga.
  const expiresIn = 6 * 3600;
  const slots: UploadSlot[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const key = buildRawAudioKey(userId, voiceId, i, f.filename);
    const url = await createPresignedPut(
      R2_BUCKETS.voices,
      key,
      f.content_type,
      expiresIn,
    );
    slots.push({
      index: i,
      key,
      upload_url: url,
      expires_in_seconds: expiresIn,
    });
  }
  return slots;
}
