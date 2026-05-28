/**
 * POST /api/v1/voices/[id]/generate
 *
 * Dispara geração de áudio com a voz clonada (status="ready").
 *
 * A referência (≥60s) é PERSISTENTE por voz (voices.reference_audio_path):
 * o usuário sobe/troca/apaga em /reference. Aqui ela é só lida e reusada.
 * Sem referência salva, gera só com a LoRA. A transcrição fica a cargo do
 * worker (Whisper) a cada geração — Caminho A.
 *
 * Body:
 *   {
 *     text: string,                       // texto a sintetizar
 *     cfg_value?: number,                 // default 2.0
 *     inference_timesteps?: number        // default 10
 *   }
 *
 * Backend:
 *   1. Auth + voice.status === "ready" + lora_path existente
 *   2. Gera UUID pra generation + presigned PUT do output
 *   3. Gera presigned GET do lora + reference
 *   4. Chama RunPod inference (async com webhook)
 *   5. Cria row em generations com status="pending" + runpod_job_id
 *   6. Retorna { generation_id, runpod_job_id }
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { normalizeTextForTTS } from "@/lib/llm/normalize";
import {
  badRequest,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS } from "@/lib/r2/client";
import {
  buildGenerationKey,
  createPresignedGet,
  createPresignedPut,
} from "@/lib/r2/presigned";
import { runpodSubmitInference, webhookUrlFor } from "@/lib/runpod/client";

type Ctx = { params: Promise<{ id: string }> };

const PRESIGN_EXPIRES = 60 * 60; // 1h
// Cobre ~2 min de fala em pt-BR (~150 wpm). Bate com o TEXT_MAX da UI
// (voice-generator.tsx). Acima disso, o stop-predictor do VoxCPM começa a
// ficar instável em single-shot — se precisar mais, dividir por frase no worker.
const TEXT_MAX = 2000;

type Body = {
  text: string;
  cfg_value?: number;
  inference_timesteps?: number;
};

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id: voiceId } = await ctx.params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const text = (body.text ?? "").trim();

  if (!text) return badRequest("'text' is required");
  if (text.length > TEXT_MAX) return badRequest(`'text' max length is ${TEXT_MAX}`);

  const admin = getAdmin();

  const { data: voice, error: vErr } = await admin
    .from("voices")
    .select("id, user_id, status, lora_path, reference_audio_path, reference_transcript, lora_alpha")
    .eq("id", voiceId)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (vErr) return serverError("Failed to load voice");
  if (!voice) return notFound("Voice");
  if (voice.status !== "ready" || !voice.lora_path) {
    return badRequest(`Voice not ready (status=${voice.status})`);
  }

  // Referência salva na voz (OPCIONAL). Sem ela, gera só com a LoRA. A
  // transcrição é feita pelo worker (Whisper) a cada geração — não guardamos.
  const refKey = (voice.reference_audio_path ?? "").trim();

  // Normaliza o texto pra fala (números/moeda/abreviações → palavras) via Claude
  // Haiku. Sem ANTHROPIC_API_KEY ou em caso de erro, retorna o texto cru.
  const normalizedText = await normalizeTextForTTS(text);

  const generationId = randomUUID();
  const outputKey = buildGenerationKey(auth.user_id, generationId);

  let loraUrl: string;
  let outputUploadUrl: string;
  let refUrl: string | undefined;
  try {
    [loraUrl, outputUploadUrl] = await Promise.all([
      createPresignedGet(R2_BUCKETS.voices, voice.lora_path, PRESIGN_EXPIRES),
      createPresignedPut(R2_BUCKETS.generations, outputKey, "audio/wav", PRESIGN_EXPIRES),
    ]);
    if (refKey) {
      refUrl = await createPresignedGet(R2_BUCKETS.voices, refKey, PRESIGN_EXPIRES);
    }
  } catch (e) {
    return serverError(
      e instanceof Error ? `R2 presigned: ${e.message}` : "R2 presigned failed",
    );
  }

  const inferenceInput: Record<string, unknown> = {
    type: "inference",
    text: normalizedText,
    lora_url: loraUrl,
    output_upload_url: outputUploadUrl,
    // Alpha gravado no treino daquela voz (16 p/ antigas, 32 p/ novas). O worker
    // infere com esse alpha — casa com a LoRA. Sem valor, o worker usa 16.
    lora_alpha: typeof voice.lora_alpha === "number" ? voice.lora_alpha : 16,
    cfg_value: typeof body.cfg_value === "number" ? body.cfg_value : 2.0,
    // 15 = meio termo entre 10 (pace correto mas qualidade media) e 20 (qualidade
    // alta mas acelerou pace em testes). Drift NAO se resolve por timesteps —
    // e estrutural (VoxCPM Issue #302). Match com worker default.
    inference_timesteps:
      typeof body.inference_timesteps === "number" ? body.inference_timesteps : 15,
  };
  if (refUrl) {
    inferenceInput.prompt_wav_url = refUrl;
    // A referência é auto-extraída e transcrita no treino. Mandamos o
    // prompt_text salvo → o worker NÃO re-transcreve a cada geração. Se por
    // algum motivo não houver transcrição, o worker cai no Whisper (Caminho A).
    const refTranscript = (voice.reference_transcript ?? "").trim();
    if (refTranscript) inferenceInput.prompt_text = refTranscript;
  }

  let runpodJob;
  try {
    runpodJob = await runpodSubmitInference(inferenceInput, {
      webhook: webhookUrlFor("generation"),
    });
  } catch (e) {
    return serverError(
      e instanceof Error ? `RunPod submit: ${e.message}` : "RunPod submit failed",
    );
  }

  const { error: insertErr } = await admin.from("generations").insert({
    id: generationId,
    user_id: auth.user_id,
    voice_id: voice.id,
    text_raw: text,
    text_normalized: normalizedText,
    reference_audio_path: refKey || null,
    reference_transcript: null,
    audio_path: outputKey,
    runpod_job_id: runpodJob.id,
  } as never);

  if (insertErr) {
    return serverError("Failed to create generation row");
  }

  return jsonOk({
    generation_id: generationId,
    runpod_job_id: runpodJob.id,
    status: "pending",
  });
}
