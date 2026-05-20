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

export function buildReferenceKey(
  userId: string,
  voiceId: string,
  refId: string,
): string {
  return `${userId}/${voiceId}/ref/${refId}.mp3`;
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
  const expiresIn = 3600;
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
