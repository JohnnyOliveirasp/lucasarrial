/**
 * 18/08 — apaga as vozes FANTASMA (status uploading, ZERO áudio no R2) que
 * ficaram na tela dos alunos. Mesma regra que o POST /voices passou a aplicar
 * (84f3197). Reconfere o R2 antes de cada exclusão — se tiver 1 byte de áudio,
 * NÃO apaga (o sweep de resgate cuida).
 *
 * Uso: node _Bugs/fast_emails_18-08/limpar_fantasmas.cjs [--confirmar]
 */
const path_ = require("node:path");
const RAIZ_ = path_.resolve(__dirname, "..", "..");
require(path_.join(RAIZ_, "frontend", "node_modules", "dotenv")).config({ path: path_.join(RAIZ_, "frontend", ".env.local") });
const { createClient } = require(path_.join(RAIZ_, "frontend", "node_modules", "@supabase/supabase-js"));
const { S3Client, ListObjectsV2Command } = require(path_.join(RAIZ_, "frontend", "node_modules", "@aws-sdk/client-s3"));

const CONFIRMAR = process.argv.includes("--confirmar");
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_VOICES;
const APAGA_APOS_MS = 45 * 60 * 1000;

(async () => {
  const { data: paradas } = await supa
    .from("voices")
    .select("id, user_id, name, created_at")
    .eq("status", "uploading")
    .lt("created_at", new Date(Date.now() - APAGA_APOS_MS).toISOString())
    .order("created_at", { ascending: true });

  let apagadas = 0;
  let mantidas = 0;
  for (const v of paradas ?? []) {
    const out = await r2.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${v.user_id}/${v.id}/` }),
    );
    const audios = (out.Contents ?? []).filter((o) => (o.Size ?? 0) > 10000);
    const { data: p } = await supa
      .from("profiles")
      .select("email")
      .eq("id", v.user_id)
      .maybeSingle();

    if (audios.length > 0) {
      mantidas++;
      console.log(`MANTÉM  ${p?.email} "${v.name}" — ${audios.length} áudio(s) no R2 (o sweep resgata)`);
      continue;
    }
    if (!CONFIRMAR) {
      console.log(`apagaria ${p?.email} "${v.name}" (${v.created_at.slice(0, 16)}) — sem áudio`);
      apagadas++;
      continue;
    }
    const { error } = await supa
      .from("voices")
      .delete()
      .eq("id", v.id)
      .eq("status", "uploading");
    if (error) console.log(`ERRO ao apagar ${v.id}: ${error.message}`);
    else {
      apagadas++;
      console.log(`APAGADA ${p?.email} "${v.name}" (${v.created_at.slice(0, 16)})`);
    }
  }
  console.log(
    `\n${CONFIRMAR ? "apagadas" : "apagaria"}: ${apagadas} · mantidas (têm áudio): ${mantidas}`,
  );
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
