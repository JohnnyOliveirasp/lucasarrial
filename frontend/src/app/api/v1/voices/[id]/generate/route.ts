/**
 * POST /api/v1/voices/[id]/generate
 *
 * Dispara geração de áudio com a voz clonada (status="ready").
 *
 * Body:
 *   {
 *     text: string,                       // texto a sintetizar
 *     reference_audio_key: string,        // chave R2 já subida (browser→R2 via /prepare)
 *     reference_transcript?: string,      // opcional — vazio => worker transcreve via Whisper
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
const TEXT_MAX = 1000;

type Body = {
  text: string;
  reference_audio_key: string;
  reference_transcript?: string;
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
  const refKey = (body.reference_audio_key ?? "").trim();
  const refTranscript = (body.reference_transcript ?? "").trim();

  if (!text) return badRequest("'text' is required");
  if (text.length > TEXT_MAX) return badRequest(`'text' max length is ${TEXT_MAX}`);
  // reference_audio_key é OPCIONAL: sem ele, gera só com a LoRA. Com ele (modo
  // "ultimate cloning"), a transcrição é opcional — vazia => worker usa Whisper.

  const admin = getAdmin();

  const { data: voice, error: vErr } = await admin
    .from("voices")
    .select("id, user_id, status, lora_path")
    .eq("id", voiceId)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (vErr) return serverError("Failed to load voice");
  if (!voice) return notFound("Voice");
  if (voice.status !== "ready" || !voice.lora_path) {
    return badRequest(`Voice not ready (status=${voice.status})`);
  }

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
    cfg_value: typeof body.cfg_value === "number" ? body.cfg_value : 2.0,
    inference_timesteps:
      typeof body.inference_timesteps === "number" ? body.inference_timesteps : 10,
  };
  if (refUrl) {
    inferenceInput.prompt_wav_url = refUrl;
    // transcrição vazia => worker transcreve a referência via Whisper
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
    reference_transcript: refTranscript || null,
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
