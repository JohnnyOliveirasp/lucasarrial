/**
 * POST /api/v1/voices/[id]/start-training
 *
 * Voice precisa estar em status="awaiting_training".
 * Backend:
 *   1. Gera presigned GET URLs (2h) pros raw_audio_paths
 *   2. Gera presigned PUT URL (2h) pro `<user>/<voice>/lora.safetensors`
 *   3. Chama RunPod /run com { type: "train", audio_urls, lora_upload_url }
 *   4. Salva runpod_job_id na voice, move status="training"
 *   5. Cria row em training_jobs
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  buildLoraKey,
  createPresignedGet,
  createPresignedPut,
} from "@/lib/r2/presigned";
import { R2_BUCKETS } from "@/lib/r2/client";
import { runpodSubmitTrain, webhookUrlFor } from "@/lib/runpod/client";

type Ctx = { params: Promise<{ id: string }> };

const TRAIN_EXPIRES_SECONDS = 2 * 60 * 60; // 2h
const DEFAULT_MAX_STEPS = 500;

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();

  const { data: voice, error: loadErr } = await admin
    .from("voices")
    .select("id, user_id, status, raw_audio_paths")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (loadErr) return serverError("Failed to load voice");
  if (!voice) return notFound("Voice");
  if (voice.status !== "awaiting_training") {
    return badRequest(`Voice status '${voice.status}' is not 'awaiting_training'`);
  }

  const paths = Array.isArray(voice.raw_audio_paths) ? voice.raw_audio_paths : [];
  if (paths.length === 0) return badRequest("Voice has no audio paths");

  // 1. Presigned GETs pros áudios
  let audioUrls: string[];
  let loraUploadUrl: string;
  const loraKey = buildLoraKey(auth.user_id, voice.id);

  try {
    audioUrls = await Promise.all(
      paths.map((key) =>
        createPresignedGet(R2_BUCKETS.voices, key, TRAIN_EXPIRES_SECONDS),
      ),
    );
    loraUploadUrl = await createPresignedPut(
      R2_BUCKETS.voices,
      loraKey,
      "application/octet-stream",
      TRAIN_EXPIRES_SECONDS,
    );
  } catch (e) {
    return serverError(
      e instanceof Error ? `R2 presigned: ${e.message}` : "R2 presigned failed",
    );
  }

  // 2. Submete pra RunPod (com webhook se SITE_URL estiver definida)
  let runpodJob;
  try {
    runpodJob = await runpodSubmitTrain(
      {
        type: "train",
        voice_id: voice.id,
        audio_urls: audioUrls,
        lora_upload_url: loraUploadUrl,
        max_steps: DEFAULT_MAX_STEPS,
        language: "pt",
      },
      { webhook: webhookUrlFor("training") },
    );
  } catch (e) {
    return serverError(
      e instanceof Error ? `RunPod submit: ${e.message}` : "RunPod submit failed",
    );
  }

  // 3. Atualiza voice + cria training_job
  const { error: updateErr } = await admin
    .from("voices")
    .update({
      status: "training",
      runpod_job_id: runpodJob.id,
      lora_path: loraKey,
      error_message: null,
    })
    .eq("id", voice.id);

  if (updateErr) return serverError("Failed to update voice status");

  await admin.from("training_jobs").insert({
    voice_id: voice.id,
    user_id: auth.user_id,
    runpod_job_id: runpodJob.id,
    status: "queued",
  });

  return jsonOk({
    voice_id: voice.id,
    runpod_job_id: runpodJob.id,
    status: "training",
  });
}
