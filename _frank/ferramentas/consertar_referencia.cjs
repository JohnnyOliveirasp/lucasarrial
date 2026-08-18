/**
 * 18/08 — profiles.image_ref_key apontando pra objeto que NÃO existe no R2
 * (caso Ricardo). Troca pela primeira foto real do acervo do aluno.
 * Uso: node _Bugs/fast_emails_18-08/consertar_referencia.cjs [--confirmar]
 */
const path_ = require("node:path");
const RAIZ_ = path_.resolve(__dirname, "..", "..");
require(path_.join(RAIZ_, "frontend", "node_modules", "dotenv")).config({ path: path_.join(RAIZ_, "frontend", ".env.local") });
const { createClient } = require(path_.join(RAIZ_, "frontend", "node_modules", "@supabase/supabase-js"));
const { S3Client, HeadObjectCommand } = require(path_.join(RAIZ_, "frontend", "node_modules", "@aws-sdk/client-s3"));

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
const BUCKET = process.env.R2_BUCKET_IMAGES || process.env.R2_BUCKET_VOICES;

const existe = async (key) => {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
};

(async () => {
  const { data: perfis } = await supa
    .from("profiles")
    .select("id, email, image_ref_key")
    .not("image_ref_key", "is", null)
    .limit(500);

  let quebrados = 0;
  for (const p of perfis ?? []) {
    if (await existe(p.image_ref_key)) continue;
    quebrados++;
    const { data: fotos } = await supa
      .from("image_generations")
      .select("image_path, created_at")
      .eq("user_id", p.id)
      .eq("status", "ready")
      .not("image_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);
    let nova = null;
    for (const f of fotos ?? []) {
      if (await existe(f.image_path)) {
        nova = f.image_path;
        break;
      }
    }
    console.log(`QUEBRADA ${p.email}\n  antiga: ${p.image_ref_key}\n  nova:   ${nova ?? "NENHUMA disponível"}`);
    if (nova && CONFIRMAR) {
      const { error } = await supa
        .from("profiles")
        .update({ image_ref_key: nova })
        .eq("id", p.id);
      console.log(error ? `  ERRO: ${error.message}` : "  ✅ trocada");
    }
  }
  console.log(`\nperfis conferidos: ${perfis?.length ?? 0} · referências quebradas: ${quebrados}`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
