#!/usr/bin/env node
/**
 * Medicao do risco do patch_9dc59356 (Video Clone `ready` sem MP4 no R2).
 *
 * O Vigia escreveu o fix mas NAO pode medir (sem banco, sem R2 no sandbox
 * dele) e deixou o risco cravado na propria entrega:
 *   "se o worker gravar em bucket/chave diferente do que o frontend espera,
 *    este patch converteria clones BONS em failed em massa."
 *
 * Este script faz o HEAD que ele pediu, no MESMO bucket que o aluno le
 * (imagesBucket() = R2_BUCKET_IMAGES || R2_BUCKET_VOICES, ver
 * frontend/src/lib/r2/client.ts:44) e no bucket do worker, pra separar
 * "arquivo nao existe" de "arquivo existe no lugar errado".
 *
 * uso: node _Bugs/medir_9dc59356.cjs [--limite 200]
 */
const path = require("node:path");
const c = require(path.join(__dirname, "..", "_frank", "ferramentas", "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({ path: path.join(c.RAIZ, "frontend", ".env.local") });

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const LIMITE = parseInt(arg("--limite", "200"), 10);

(async () => {
  const db = c.supa();
  const BUCKET_ALUNO = process.env.R2_BUCKET_IMAGES || process.env.R2_BUCKET_VOICES;
  const BUCKET_WORKER = c.BUCKETS.worker();
  if (!BUCKET_ALUNO) throw new Error("nem R2_BUCKET_IMAGES nem R2_BUCKET_VOICES no ambiente");
  console.log(`bucket que o ALUNO le : ${BUCKET_ALUNO}`);
  console.log(`bucket do WORKER      : ${BUCKET_WORKER}\n`);

  const { data, error } = await db
    .from("video_clones")
    .select("id,user_id,status,video_path,credits_cost,tier,created_at")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error(JSON.stringify(error));
  console.log(`amostra: ${data.length} clones ready mais recentes (${String(data[data.length - 1].created_at).slice(0, 10)} -> ${String(data[0].created_at).slice(0, 10)})\n`);

  const faltando = [];
  let ok = 0, semPath = 0, soNoWorker = 0;
  for (const r of data) {
    if (!r.video_path) { semPath++; faltando.push({ ...r, onde: "video_path NULO" }); continue; }
    const existeAluno = await c.existe(BUCKET_ALUNO, r.video_path);
    if (existeAluno) { ok++; continue; }
    const existeWorker = await c.existe(BUCKET_WORKER, r.video_path).catch(() => false);
    if (existeWorker) soNoWorker++;
    faltando.push({ ...r, onde: existeWorker ? "SO no bucket do worker" : "NAO existe em nenhum dos dois" });
  }

  console.log(`ok (aluno consegue baixar) : ${ok}`);
  console.log(`video_path nulo            : ${semPath}`);
  console.log(`so no bucket do worker     : ${soNoWorker}`);
  console.log(`AUSENTES pro aluno         : ${faltando.length}  (${Math.round(faltando.length / data.length * 100)}% da amostra)\n`);
  for (const f of faltando) {
    console.log(`  ${f.id.slice(0, 8)} ${String(f.created_at).slice(0, 16)} ${String(f.tier).padEnd(7)} ${String(f.credits_cost).padStart(6)}cr  ${f.onde}`);
    console.log(`      user ${f.user_id.slice(0, 8)}  key ${f.video_path}`);
  }
  require("node:fs").writeFileSync(path.join(__dirname, "medir_9dc59356.json"),
    JSON.stringify({ bucket_aluno: BUCKET_ALUNO, bucket_worker: BUCKET_WORKER, amostra: data.length, ok, sem_path: semPath, so_no_worker: soNoWorker, faltando }, null, 1));
  console.log("\ngravado em _Bugs/medir_9dc59356.json");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
