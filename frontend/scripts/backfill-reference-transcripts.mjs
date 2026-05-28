/**
 * Backfill de `voices.reference_transcript`.
 *
 * Acha TODA voz que tem áudio de referência (`reference_audio_path`) mas está
 * SEM transcrição (`reference_transcript` null) — o meio-estado que fazia a
 * clonagem cortar cedo (mandava o áudio sem o texto). Pra cada uma: gera um
 * presigned GET do áudio no R2, manda o worker do RunPod transcrever (job
 * `type: "transcribe"`, mesmo Whisper do treino) e grava o resultado no banco.
 *
 * Idempotente: rode quantas vezes quiser; só toca em quem está sem transcrição.
 *
 * Pré-requisito: o worker com o job `transcribe` precisa estar DEPLOYADO.
 *
 * Uso (com as envs do projeto carregadas — não imprime segredos):
 *   node --env-file=.env.local scripts/backfill-reference-transcripts.mjs
 *
 * Envs necessárias:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_VOICES
 *   RUNPOD_API_KEY, RUNPOD_ENDPOINT_INFERENCE_ID (ou RUNPOD_ENDPOINT_TRAIN_ID)
 */
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min (cobre cold start)

function requireEnv(name, fallbackName) {
  const v = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!v) {
    throw new Error(`Faltando env: ${name}${fallbackName ? ` (ou ${fallbackName})` : ""}`);
  }
  return v;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function presignGet(s3, bucket, key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

async function runpodTranscribe(apiKey, endpointId, audioUrl) {
  const submit = await fetch(`${RUNPOD_BASE}/${endpointId}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: { type: "transcribe", audio_url: audioUrl, language: "pt" } }),
  });
  if (!submit.ok) {
    throw new Error(`RunPod submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  }
  const { id } = await submit.json();
  if (!id) throw new Error("RunPod não devolveu job id");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(`${RUNPOD_BASE}/${endpointId}/status/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`RunPod status ${res.status}`);
    const data = await res.json();
    if (data.status === "COMPLETED") {
      const transcript = (data.output?.transcript || "").trim();
      if (!transcript) throw new Error(`job ${id} completou sem transcript: ${JSON.stringify(data.output)}`);
      return transcript;
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(data.status)) {
      throw new Error(`job ${id} ${data.status}: ${data.error || ""}`);
    }
    process.stdout.write(".");
  }
  throw new Error(`job ${id} não terminou em ${POLL_TIMEOUT_MS / 1000}s`);
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const r2Endpoint = requireEnv("R2_ENDPOINT");
  const r2Bucket = requireEnv("R2_BUCKET_VOICES");
  const runpodKey = requireEnv("RUNPOD_API_KEY");
  const endpointId = requireEnv("RUNPOD_ENDPOINT_INFERENCE_ID", "RUNPOD_ENDPOINT_TRAIN_ID");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const s3 = new S3Client({
    region: "auto",
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  const { data: voices, error } = await supabase
    .from("voices")
    .select("id, name, reference_audio_path")
    .not("reference_audio_path", "is", null)
    .is("reference_transcript", null);

  if (error) throw new Error(`Supabase select: ${error.message}`);
  if (!voices?.length) {
    console.log("✅ Nada a fazer: nenhuma voz com áudio de referência sem transcrição.");
    return;
  }

  console.log(`Encontradas ${voices.length} voz(es) sem transcrição:\n`);
  let ok = 0;
  let fail = 0;
  for (const v of voices) {
    console.log(`→ ${v.name} (${v.id})`);
    try {
      const url = await presignGet(s3, r2Bucket, v.reference_audio_path);
      process.stdout.write("  transcrevendo no RunPod ");
      const transcript = await runpodTranscribe(runpodKey, endpointId, url);
      console.log(` ok (${transcript.length} chars)`);
      console.log(`  preview: "${transcript.slice(0, 80)}${transcript.length > 80 ? "…" : ""}"`);

      const { error: upErr } = await supabase
        .from("voices")
        .update({ reference_transcript: transcript })
        .eq("id", v.id);
      if (upErr) throw new Error(`update: ${upErr.message}`);
      console.log("  gravado no banco ✅\n");
      ok++;
    } catch (e) {
      console.error(`  ❌ falhou: ${e instanceof Error ? e.message : e}\n`);
      fail++;
    }
  }

  console.log(`Fim. ${ok} corrigida(s), ${fail} falha(s).`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
