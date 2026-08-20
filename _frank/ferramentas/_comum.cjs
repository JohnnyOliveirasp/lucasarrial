/**
 * Base compartilhada das ferramentas do Frank: carrega as credenciais e
 * devolve os clientes prontos. Roda de QUALQUER pasta (o caminho do
 * .env.local é resolvido a partir deste arquivo, não do diretório atual).
 *
 * Precisa das dependências do frontend — se der "Cannot find module",
 * rode de dentro de `frontend/` ou use `node --require` a partir de lá.
 */
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
const ENV = path.join(RAIZ, "frontend", ".env.local");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({ path: ENV });

const { createClient } = require(path.join(RAIZ, "frontend", "node_modules", "@supabase/supabase-js"));
const s3 = require(path.join(RAIZ, "frontend", "node_modules", "@aws-sdk", "client-s3"));
const presign = require(path.join(RAIZ, "frontend", "node_modules", "@aws-sdk", "s3-request-presigner"));

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`credenciais do Supabase ausentes em ${ENV}`);
  return createClient(url, key);
}

function r2() {
  return new s3.S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const BUCKETS = {
  vozes: () => process.env.R2_BUCKET_VOICES,
  geracoes: () => process.env.R2_BUCKET_GENERATIONS,
  imagens: () => process.env.R2_BUCKET_IMAGES || process.env.R2_BUCKET_VOICES,
  /** ⚠️ onde o worker de vídeo grava — NÃO é o de generations */
  worker: () => "voices-clone-ai-verse",
};

/** Lista objetos de um prefixo (só os que parecem arquivo de verdade). */
async function listar(bucket, prefixo, minBytes = 10000) {
  const out = await r2().send(
    new s3.ListObjectsV2Command({ Bucket: bucket, Prefix: prefixo }),
  );
  return (out.Contents ?? []).filter((o) => (o.Size ?? 0) > minBytes);
}

/** O objeto existe mesmo no R2? (linha no banco não é prova) */
async function existe(bucket, key) {
  try {
    await r2().send(new s3.HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** URL assinada pra leitura — assine SEMPRE na hora de usar. */
function urlAssinada(bucket, key, segundos = 3600) {
  return presign.getSignedUrl(r2(), new s3.GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: segundos,
  });
}

const minutos = (seg) => (seg ? `${Math.round(seg / 60)}min` : "?");
const idadeHoras = (iso) => (Date.now() - new Date(iso).getTime()) / 3600000;

/* ------------------------------------------------------------------ */
/* Fechamento de incidentes — FUNÇÃO ÚNICA (20/08).                     */
/* O app já garante resolved_at/resolved_by nos caminhos dele           */
/* (closureFields / 513f518 + 34b8e6a). Esta é a mesma trava para       */
/* TODO script NOSSO que escreva incidents.status por fora do app.      */
/* Regra: nunca monte o patch de status na mão — passe por aqui.        */
/* ------------------------------------------------------------------ */

const STATUS_FECHADO = ["fixed", "ignored"];

/**
 * Normaliza um patch de incidents que mexe em `status`:
 *  - fechamento (fixed/ignored): OBRIGA resolved_at + resolved_by.
 *    `by` identifica quem fechou (ex.: "frank/rotina-falhas", "vigia",
 *    "frank/coder"). Sem responsável => throw, não grava capado.
 *  - status vivo (open/investigating): limpa resolved_at/resolved_by,
 *    espelhando o app (reabertura não pode carregar data de fechamento
 *    residual — caso ce6e157d).
 *  - patch sem `status`: devolve intocado (nota não mexe em fechamento).
 */
function fechamento(patch, by) {
  if (!patch || patch.status === undefined) return patch;
  if (STATUS_FECHADO.includes(patch.status)) {
    const quem = patch.resolved_by ?? by;
    if (!quem) {
      throw new Error(
        "fechamento sem responsável: informe `by` (ex.: 'frank/rotina-falhas') — resolved_by é obrigatório ao fechar",
      );
    }
    patch.resolved_at = patch.resolved_at ?? new Date().toISOString();
    patch.resolved_by = quem;
  } else {
    patch.resolved_at = null;
    patch.resolved_by = null;
  }
  return patch;
}

module.exports = { supa, r2, s3, BUCKETS, listar, existe, urlAssinada, minutos, idadeHoras, RAIZ, fechamento, STATUS_FECHADO };
