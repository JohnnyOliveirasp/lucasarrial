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
 *
 * ⚠️ POR QUE ISTO LANÇA em vez de devolver "" (incidente 147/148, 27/08).
 * Quando NEM `R2_BUCKET_IMAGES` NEM `R2_BUCKET_VOICES` existem, a versão
 * anterior devolvia string vazia e seguia em frente. O `PutObjectCommand`
 * recebia `Bucket: ""` e o SDK da AWS estourava com
 *   `No value provided for input HTTP label: Bucket.`
 * — erro que não menciona configuração nenhuma. Em `lib/studio/scenes.ts` ele
 * caía no `catch` do salvamento e era lido como "a geração falhou": a cena do
 * aluno virava `failed` + estorno, embora o vídeo estivesse PRONTO no Kie.
 * Foi assim que 8 cenas de 3 alunos (uma esperando havia 14 dias) foram
 * jogadas fora em 71 segundos.
 *
 * Config ausente é erro de operador, não de aluno: tem que gritar na hora, no
 * lugar certo, em vez de virar dado corrompido três camadas adiante.
 * (Medido em 27/08: a produção NÃO tem `R2_BUCKET_IMAGES` e vive do fallback —
 * o bucket real das cenas do Estúdio é o de `voices`.)
 */
export function imagesBucket(): string {
  const bucket = process.env.R2_BUCKET_IMAGES || R2_BUCKETS.voices;
  if (!bucket) {
    throw new Error(
      "R2 mal configurado: nem R2_BUCKET_IMAGES nem R2_BUCKET_VOICES estão definidos. " +
        "Recusando devolver bucket vazio (incidente 147/148: bucket vazio destruiu cena de aluno).",
    );
  }
  return bucket;
}
