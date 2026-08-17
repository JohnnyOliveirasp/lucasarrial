// Probe (11/08): descobre QUAL credencial escreve em voxbr/ no bucket voices.
// Testa PUT de 10 bytes com (A) creds do frontend/.env.local e (B) creds do
// voxbr/tagarela/.r2env, em voxbr/_probe.txt. Não imprime segredo nenhum —
// só o resultado de cada tentativa e um fingerprint curto do endpoint.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

function parseEnv(p) {
  const out = {};
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const ROOT = path.join(__dirname, "..", "..");
const CANDS = [
  ["frontend/.env.local", parseEnv(path.join(ROOT, "frontend", ".env.local"))],
  ["tagarela/.r2env", parseEnv(path.join(ROOT, "voxbr", "tagarela", ".r2env"))],
];
const BUCKET = "voices-clone-ai-verse";
const fp = (s) => crypto.createHash("sha256").update(s || "").digest("hex").slice(0, 8);

(async () => {
  for (const [nome, env] of CANDS) {
    const s3 = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
    console.log(`\n== ${nome} — endpoint fp:${fp(env.R2_ENDPOINT)} key fp:${fp(env.R2_ACCESS_KEY_ID)}`);
    for (const key of ["voxbr/_probe.txt"]) {
      try {
        await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: "probe11-08", ContentType: "text/plain" }));
        console.log(`  PUT ${key}: OK`);
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
      } catch (e) {
        console.log(`  PUT ${key}: ${e.name} ${e.$metadata?.httpStatusCode ?? ""}`);
      }
    }
  }
})();
