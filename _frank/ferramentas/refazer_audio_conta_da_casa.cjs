// --teste (24/08): manda o job pro endpoint ISOLADO de teste (imagem da dev),
// nunca pra producao. Setado ANTES do dotenv (dotenv nao sobrescreve env ja
// definida). Ver memoria project-runpod-endpoint-teste-dev.
if (process.argv.includes("--teste")) {
  process.env.RUNPOD_ENDPOINT_TRAIN_ID = "vtfxcwcb0ohvdn";
  process.env.RUNPOD_ENDPOINT_INFERENCE_ID = "vtfxcwcb0ohvdn";
  console.log("⚠️  MODO TESTE: endpoint vtfxcwcb0ohvdn (fast_cloner_TESTE_dev)");
}
/**
 * 19/08 — REFAZER uma geração de áudio POR CONTA DA CASA (sem cobrar).
 *
 * Nasceu do caso Katia (incidente 4396496b): o suporte prometeu por escrito
 * refazer o áudio dela sem cobrar, a aluna aceitou 2x — e ninguém gerou,
 * porque não existia caminho pra "gerar em nome do aluno" fora da rota da
 * API (que exige a sessão dele). Ficou palavra dada sem dono por 24h.
 *
 * Réplica EXATA do POST /api/v1/voices/[id]/generate (mesmo payload: cfg 1.6,
 * timesteps 15, lora_alpha da voz, prompt_text = reference_transcript da voz,
 * policy.executionTimeout por job), menos o débito.
 *
 * ⚠️ REGRA 7: só rode quando o aluno PEDIU **ou** quando é compensação por
 * erro nosso — e aí sem cobrar. Nunca gaste GPU do aluno por iniciativa própria.
 * ⚠️ REGRA 8 (efeito colateral conhecido): se o job FALHAR, o estorno
 * automático credita o valor mesmo sem ter havido débito — o aluno ganha
 * crédito que nunca pagou. Em compensação por erro nosso isso é aceito DE
 * PROPÓSITO. Registre no relatório.
 *
 * Reaproveita o `text_normalized` JÁ GRAVADO na geração original: é o texto
 * que de fato foi pra GPU (a normalização por Haiku já corrigiu números,
 * abreviações e erros de digitação). Refazer com ele reproduz a mesma
 * entrada, sem depender de chamar o normalizador de novo.
 *
 * Uso (de qualquer pasta do projeto):
 *   node _frank/ferramentas/refazer_audio_conta_da_casa.cjs <generationId>
 *   node _frank/ferramentas/refazer_audio_conta_da_casa.cjs <generationId> --confirmar
 */
const { supa, RAIZ } = require("./_comum.cjs");
const path = require("node:path");

const { S3Client, GetObjectCommand, PutObjectCommand } = require(
  path.join(RAIZ, "frontend", "node_modules", "@aws-sdk/client-s3"),
);
const { getSignedUrl } = require(
  path.join(RAIZ, "frontend", "node_modules", "@aws-sdk/s3-request-presigner"),
);
const { randomUUID } = require("node:crypto");

const GEN_ID = process.argv[2];
const CONFIRMAR = process.argv.includes("--confirmar");
if (!GEN_ID) {
  console.error("uso: node refazer_audio_conta_da_casa.cjs <generationId> [--confirmar]");
  process.exit(1);
}

const PRESIGN_EXPIRES = 2 * 60 * 60;

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const getUrl = (bucket, key) =>
  getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: PRESIGN_EXPIRES });
const putUrl = (bucket, key, type) =>
  getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type }), {
    expiresIn: PRESIGN_EXPIRES,
  });

/** Espelha inferenceExecutionTimeoutMs da rota (piso 30min; 160 chars/chunk). */
function timeoutMs(textLen) {
  const chunks = Math.max(1, Math.ceil(textLen / 160));
  return Math.max(30 * 60, 15 * 60 + chunks * 2 * 60) * 1000;
}

(async () => {
  const db = supa();

  const { data: origem, error: eGen } = await db
    .from("generations")
    .select("id, user_id, voice_id, text_raw, text_normalized, status, created_at")
    .eq("id", GEN_ID)
    .maybeSingle();
  if (eGen) throw new Error(`consulta generations: ${eGen.message}`);
  if (!origem) throw new Error("geração de origem não encontrada");

  const { data: voz, error: eVoz } = await db
    .from("voices")
    .select("id, user_id, status, lora_path, reference_audio_path, reference_transcript, lora_alpha, tts_silence_ms, tts_crossfade_ms, language")
    .eq("id", origem.voice_id)
    .maybeSingle();
  if (eVoz) throw new Error(`consulta voices: ${eVoz.message}`);
  if (!voz) throw new Error("voz não encontrada");
  if (voz.status !== "ready" || !voz.lora_path) {
    throw new Error(`voz não está pronta (status=${voz.status})`);
  }

  // ⚠️ Checar o `error` SEMPRE: consulta que erra volta data:null e o script
  // imprime "undefined" alegremente (armadilha 1 do 03_ROTINA — pedir coluna
  // que não existe já quase deu um dia por limpo com 2 itens presos).
  // A coluna é `display_name`; `full_name` NÃO existe nesta tabela.
  const { data: perfil, error: ePerfil } = await db
    .from("profiles")
    .select("email, display_name, credits_subscription, credits_extra, access_until")
    .eq("id", origem.user_id)
    .maybeSingle();
  if (ePerfil) throw new Error(`consulta profiles: ${ePerfil.message}`);
  if (!perfil) throw new Error("perfil do aluno não encontrado");

  const texto = (origem.text_normalized || origem.text_raw || "").trim();
  if (!texto) throw new Error("geração de origem sem texto");
  const custoQueNaoSeraCobrado = Math.max(400, (origem.text_raw || "").length);

  console.log("=".repeat(64));
  console.log(`ALUNO : ${perfil.display_name} <${perfil.email}>`);
  console.log(`ACESSO: até ${perfil.access_until}`);
  console.log(`SALDO : ${(perfil.credits_subscription ?? 0) + (perfil.credits_extra ?? 0)}`);
  console.log(`VOZ   : ${voz.id} [${voz.status}] lang=${voz.language} alpha=${voz.lora_alpha ?? 16}`);
  console.log(`ORIGEM: ${origem.id} (${origem.status}, ${origem.created_at})`);
  console.log(`TEXTO : ${texto.length} chars`);
  console.log(`CUSTO : ${custoQueNaoSeraCobrado} cr — NÃO SERÁ COBRADO (conta da casa)`);
  console.log(`TIMEOUT: ${timeoutMs(texto.length) / 60000} min`);
  console.log("-".repeat(64));
  console.log(texto);
  console.log("=".repeat(64));

  if (!CONFIRMAR) {
    console.log("\n(SIMULAÇÃO — nada foi disparado. rode com --confirmar pra executar)");
    return;
  }

  const novoId = randomUUID();
  const outputKey = `${origem.user_id}/${novoId}.wav`;
  const B_VOICES = process.env.R2_BUCKET_VOICES;
  const B_GEN = process.env.R2_BUCKET_GENERATIONS;

  const input = {
    type: "inference",
    text: texto,
    output_upload_url: await putUrl(B_GEN, outputKey, "audio/wav"),
    lora_alpha: typeof voz.lora_alpha === "number" ? voz.lora_alpha : 16,
    cfg_value: 1.6,
    inference_timesteps: 15,
    language: voz.language || "pt",
    lora_url: await getUrl(B_VOICES, voz.lora_path),
  };
  const refKey = (voz.reference_audio_path ?? "").trim();
  if (refKey) {
    input.prompt_wav_url = await getUrl(B_VOICES, refKey);
    const t = (voz.reference_transcript ?? "").trim();
    if (t) input.prompt_text = t;
  }
  if (typeof voz.tts_silence_ms === "number") input.chunk_silence_ms = voz.tts_silence_ms;
  if (typeof voz.tts_crossfade_ms === "number") input.chunk_crossfade_ms = voz.tts_crossfade_ms;

  // ⚠️ O webhook TEM que ser o de PRODUÇÃO. Na máquina local
  // NEXT_PUBLIC_SITE_URL=http://localhost:3000 — a rota da API usa essa
  // precedência porque roda NO servidor, mas um script operacional roda daqui:
  // com localhost o RunPod recusa o job ("invalid webhook url", 400) e, se
  // aceitasse, o callback nunca chegaria e a geração ficaria pendente pra sempre.
  // Por isso preferimos SITE_URL e descartamos qualquer coisa local.
  const candidatos = [process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL, "https://fastcloner.com"];
  const site = candidatos
    .find((u) => u && /^https:\/\//i.test(u) && !/localhost|127\.0\.0\.1/i.test(u))
    .replace(/\/$/, "");
  const endpoint = process.env.RUNPOD_ENDPOINT_INFERENCE_ID || process.env.RUNPOD_ENDPOINT_TRAIN_ID;

  const res = await fetch(`https://api.runpod.ai/v2/${endpoint}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      webhook: `${site}/api/v1/webhooks/runpod`,
      policy: { executionTimeout: timeoutMs(texto.length) },
    }),
  });
  if (!res.ok) throw new Error(`RunPod ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const job = await res.json();

  const { error: eIns } = await db.from("generations").insert({
    id: novoId,
    user_id: origem.user_id,
    voice_id: voz.id,
    text_raw: origem.text_raw,
    text_normalized: texto,
    reference_audio_path: refKey || null,
    reference_transcript: (voz.reference_transcript ?? "").trim() || null,
    audio_path: outputKey,
    runpod_job_id: job.id,
    // #125 (24/08): geracao da equipe SEM debito precisa ser reconhecivel no
    // banco — sem nome, o detector de 'entregue e nao cobrada' a confunde com
    // vazamento de receita (28% falso). Nome = rotulo + data.
    name: `Conta da casa — ${new Date().toISOString().slice(0, 10)}`,
  });
  if (eIns) throw new Error(`insert generations: ${eIns.message} (job ${job.id} JÁ disparado)`);

  console.log(`✅ disparado: job ${job.id} (${job.status})`);
  console.log(`✅ generation ${novoId} criada para ${perfil.email}`);
  console.log(`✅ SEM débito — por conta da casa`);
  console.log(`\nacompanhe: node _frank/ferramentas/aluno.cjs ${perfil.email}`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
