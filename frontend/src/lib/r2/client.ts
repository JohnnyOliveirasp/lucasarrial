/**
 * Cloudflare R2 client (S3-compatible).
 * Server-only — usa SERVICE credentials. Nunca importar no client.
 */
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "https://missing-r2-endpoint.invalid",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "missing",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "missing",
  },
});

export const R2_BUCKETS = {
  voices: process.env.R2_BUCKET_VOICES || "",
  generations: process.env.R2_BUCKET_GENERATIONS || "",
} as const;

/**
 * Bucket das imagens geradas (referência + resultado). Imagens são PERMANENTES
 * (a pessoa reusa pra gerar vídeo depois), então NÃO usam o bucket de
 * `generations` (que tem TTL 30d). Se R2_BUCKET_IMAGES não estiver setado, cai
 * no bucket `voices` (permanente e já com CORS pra upload do browser) — assim
 * funciona sem infra nova; troca-se por um bucket dedicado quando quiser.
 */
export function imagesBucket(): string {
  return process.env.R2_BUCKET_IMAGES || R2_BUCKETS.voices;
}
