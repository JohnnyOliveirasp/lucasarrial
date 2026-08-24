// --teste (24/08): manda o job pro endpoint ISOLADO de teste (imagem da dev),
// nunca pra producao. Setado ANTES do dotenv (dotenv nao sobrescreve env ja
// definida). Ver memoria project-runpod-endpoint-teste-dev.
if (process.argv.includes("--teste")) {
  process.env.RUNPOD_ENDPOINT_TRAIN_ID = "vtfxcwcb0ohvdn";
  process.env.RUNPOD_ENDPOINT_INFERENCE_ID = "vtfxcwcb0ohvdn";
  console.log("⚠️  MODO TESTE: endpoint vtfxcwcb0ohvdn (fast_cloner_TESTE_dev)");
}
/**
 * 18/08 — RESGATE de voz parada em "uploading" com áudio JÁ no R2.
 * Réplica do POST /api/v1/voices/[id]/start-training (mesma receita:
 * max_steps 500, webhook de produção, timeout por duração) + o passo que
 * faltou (uploads-complete: raw_audio_paths/duration/status).
 *
 * NÃO COBRA (ordem do Johnny 18/08: "destes alunos que deram erro você não
 * vai cobrar, pelo contrário vai estornar") — o travamento foi culpa nossa,
 * então o treino do resgate é por conta da casa.
 * ⚠️ Efeito colateral conhecido: se o treino FALHAR, o estorno automático do
 * finalize-training credita 10.000 que não foram cobrados. Como a ordem é
 * compensar o aluno, fica assim de propósito.
 *
 * Uso (de dentro de frontend/):
 *   node _Bugs/fast_emails_18-08/resgatar_voz.cjs <voiceId>            # simula
 *   node _Bugs/fast_emails_18-08/resgatar_voz.cjs <voiceId> --confirmar # executa
 */
const path_ = require("node:path");
const os_ = require("node:os");
const fs_ = require("node:fs");
const RAIZ_ = path_.resolve(__dirname, "..", "..");
require(path_.join(RAIZ_, "frontend", "node_modules", "dotenv")).config({ path: path_.join(RAIZ_, "frontend", ".env.local") });
const { createClient } = require(path_.join(RAIZ_, "frontend", "node_modules", "@supabase/supabase-js"));
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require(path_.join(RAIZ_, "frontend", "node_modules", "@aws-sdk/client-s3"));
const { getSignedUrl } = require(path_.join(RAIZ_, "frontend", "node_modules", "@aws-sdk/s3-request-presigner"));
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);

const VOICE_ID = process.argv[2];
const CONFIRMAR = process.argv.includes("--confirmar");
if (!VOICE_ID) {
  console.error("uso: node resgatar_voz.cjs <voiceId> [--confirmar]");
  process.exit(1);
}

const SITE = "https://fastcloner.com"; // webhook de PRODUÇÃO (local é localhost)
const TRAIN_EXPIRES = 2 * 60 * 60;
const MAX_STEPS = 500;
const CUSTO_TREINO = 10000;

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
const B_VOICES = process.env.R2_BUCKET_VOICES;
const B_GEN = process.env.R2_BUCKET_GENERATIONS;

const getUrl = (bucket, key, exp = TRAIN_EXPIRES) =>
  getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: exp });
const putUrl = (bucket, key, type) =>
  getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type }), {
    expiresIn: TRAIN_EXPIRES,
  });

async function probe(alvo) {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", alvo],
    { timeout: 120000 },
  );
  const d = Number(String(stdout).trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * Duração do áudio.
 *
 * 22/08 — POR QUE ISTO BAIXA O ARQUIVO EM VEZ DE SÓ SONDAR A URL:
 * o ffprobe desta máquina dá SEGMENTATION FAULT (exit 139) ao abrir URL https.
 * A versão anterior chamava `ffprobe <url>` dentro de um try/catch que devolvia
 * 0 no catch — ou seja, engolia o segfault EM SILÊNCIO e toda voz reprovava no
 * "só 0.0 min — mínimo 20", independentemente do áudio. A ferramenta parecia
 * recusar o áudio do aluno quando na verdade era o nosso probe que morria.
 * Agora: tenta a URL; se vier 0, BAIXA pro /tmp e mede local (que funciona);
 * e qualquer falha é IMPRESSA, nunca engolida.
 */
async function duracao(url) {
  try {
    const d = await probe(url);
    if (d > 0) return d;
    console.log("   (probe pela URL devolveu 0 — vou baixar e medir local)");
  } catch (e) {
    console.log(`   (probe pela URL falhou: ${String(e.message).slice(0, 80)} — baixando)`);
  }
  const tmp = path_.join(os_.tmpdir(), `dur_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.log(`   ❌ download para medir falhou: HTTP ${resp.status}`);
      return 0;
    }
    fs_.writeFileSync(tmp, Buffer.from(await resp.arrayBuffer()));
    const d = await probe(tmp);
    if (d === 0) console.log("   ❌ ffprobe local também não achou duração — arquivo pode não ser áudio");
    return d;
  } catch (e) {
    console.log(`   ❌ medição local falhou: ${String(e.message).slice(0, 100)}`);
    return 0;
  } finally {
    try { fs_.unlinkSync(tmp); } catch {}
  }
}

(async () => {
  const { data: voz } = await supa
    .from("voices")
    .select("id, user_id, name, status")
    .eq("id", VOICE_ID)
    .maybeSingle();
  if (!voz) throw new Error("voz não encontrada");
  if (voz.status !== "uploading") throw new Error(`status é '${voz.status}', não 'uploading'`);

  const { data: perfil } = await supa
    .from("profiles")
    .select("email, credits_subscription, credits_extra")
    .eq("id", voz.user_id)
    .maybeSingle();
  const saldo = (perfil?.credits_subscription ?? 0) + (perfil?.credits_extra ?? 0);
  console.log(`voz "${voz.name}" de ${perfil?.email} · saldo ${saldo} (não será cobrado)`);

  // 1. Os áudios que estão no R2 (ordem = a mesma do upload, pelo prefixo NNN_)
  const lista = await r2.send(
    new ListObjectsV2Command({ Bucket: B_VOICES, Prefix: `${voz.user_id}/${voz.id}/` }),
  );
  const chaves = (lista.Contents ?? [])
    // ⚠️ 24/08: o prefixo da voz também contém ref/auto.wav e sample — a Kessuly
    // foi retreinada com a própria referência de 30s dentro do "áudio bruto".
    .filter((o) => o.Size > 10000 && /\/raw\/[^/]+\.(mp3|wav|m4a|aac|ogg|webm|mp4|flac)$/i.test(o.Key))
    .map((o) => o.Key)
    .sort();
  if (chaves.length === 0) throw new Error("nenhum áudio no R2");

  const urls = [];
  let total = 0;
  for (const k of chaves) {
    const u = await getUrl(B_VOICES, k);
    urls.push(u);
    total += await duracao(u);
  }
  console.log(`${chaves.length} áudio(s), ${(total / 60).toFixed(1)} min no total`);
  if (total < 20 * 60) throw new Error(`só ${(total / 60).toFixed(1)} min — mínimo 20`);

  if (!CONFIRMAR) {
    console.log("\n(simulação — nada foi alterado. rode com --confirmar pra executar)");
    return;
  }

  // 2. O passo que faltou (uploads-complete)
  const { error: e1 } = await supa
    .from("voices")
    .update({
      raw_audio_paths: chaves,
      duration_seconds: Math.round(total),
      status: "awaiting_training",
      error_message: null,
    })
    .eq("id", voz.id);
  if (e1) throw new Error(`update uploads-complete: ${e1.message}`);
  console.log("✅ voz restaurada (awaiting_training)");

  // 3. Treino — mesma receita do start-training
  const loraKey = `${voz.user_id}/${voz.id}/lora.safetensors`;
  const refKey = `${voz.user_id}/${voz.id}/ref/auto.wav`;
  const sampleKey = `${voz.user_id}/${voz.id}/sample.wav`;
  const body = {
    input: {
      type: "train",
      voice_id: voz.id,
      audio_urls: urls,
      lora_upload_url: await putUrl(B_VOICES, loraKey, "application/octet-stream"),
      reference_upload_url: await putUrl(B_VOICES, refKey, "audio/wav"),
      sample_upload_url: await putUrl(B_GEN, sampleKey, "audio/wav"),
      max_steps: MAX_STEPS,
      language: "pt",
    },
    webhook: `${SITE}/api/v1/webhooks/runpod`,
    policy: { executionTimeout: (30 * 60 + Math.ceil(total * 0.3)) * 1000 },
  };
  const res = await fetch(
    `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TRAIN_ID}/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`RunPod ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const job = await res.json();
  console.log(`✅ treino disparado: ${job.id} (${job.status})`);

  await supa
    .from("voices")
    .update({ status: "training", runpod_job_id: job.id, lora_path: loraKey, error_message: null })
    .eq("id", voz.id);
  await supa.from("training_jobs").insert({
    voice_id: voz.id,
    user_id: voz.user_id,
    runpod_job_id: job.id,
    status: "queued",
  });

  // 4. SEM cobrança (ordem do Johnny 18/08) — a culpa do travamento é nossa.
  console.log(`✅ sem débito: treino de resgate por conta da casa`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
