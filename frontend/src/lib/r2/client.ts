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
