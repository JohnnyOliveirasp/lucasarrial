/**
 * Cloudflare R2 client (S3-compatible).
 * Server-only — usa SERVICE credentials. Nunca importar no client.
 */
import { S3Client } from "@aws-sdk/client-s3";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: getEnv("R2_ENDPOINT"),
  credentials: {
    accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
  },
});

export const R2_BUCKETS = {
  voices: getEnv("R2_BUCKET_VOICES"),
  generations: getEnv("R2_BUCKET_GENERATIONS"),
} as const;
