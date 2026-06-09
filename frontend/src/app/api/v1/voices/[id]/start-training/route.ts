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
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";
import {
  buildAutoReferenceKey,
  buildLoraKey,
  createPresignedGet,
  createPresignedPut,
} from "@/lib/r2/presigned";
import { R2_BUCKETS } from "@/lib/r2/client";
import { runpodSubmitTrain, webhookUrlFor } from "@/lib/runpod/client";

type Ctx = { params: Promise<{ id: string }> };

const TRAIN_EXPIRES_SECONDS = 2 * 60 * 60; // 2h
// 500 = config que funciona com este dataset/codebase + alpha=16 (Aluno2 prova).
// 1000 (default do desktop VoiceLoraStudio/core.py:683) causou overfit no
// LoRA -> EsposaLucas saiu embolada com 26s de mumble no meio. Dataset/setup
// daqui responde melhor a 500 + alpha=16.
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

  // Clonar/treinar custa TRAINING_CREDIT_COST. Equipe/admin não é cobrada.
  const billed = !bypassesBilling(auth.email);
  if (billed) {
    const bal = await getBalance(auth.user_id);
    if (bal.total < TRAINING_CREDIT_COST) {
      // subscribed = assinatura ativa → CTA do popup "comprar avulso";
      // sem assinatura → "assinar" (o avulso exige assinatura ativa).
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError(
        "insufficient_credits",
        `Créditos insuficientes: treinar uma voz custa ${TRAINING_CREDIT_COST} e você tem ${bal.total}.`,
        402,
        { subscribed, balance: bal.total, cost: TRAINING_CREDIT_COST },
      );
    }
  }

  // 1. Presigned GETs pros áudios
  let audioUrls: string[];
  let loraUploadUrl: string;
  let referenceUploadUrl: string;
  const loraKey = buildLoraKey(auth.user_id, voice.id);
  const referenceKey = buildAutoReferenceKey(auth.user_id, voice.id);

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
    // O worker corta 2 min de 1 áudio e sobe aqui como a referência da voz.
    referenceUploadUrl = await createPresignedPut(
      R2_BUCKETS.voices,
      referenceKey,
      "audio/wav",
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
        reference_upload_url: referenceUploadUrl,
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

  // Debita após o treino ser disparado com sucesso (débito atômico no banco).
  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: TRAINING_CREDIT_COST,
      kind: "training",
      refType: "voice",
      refId: voice.id,
      note: "clonagem/treino de voz",
    });
  }

  return jsonOk({
    voice_id: voice.id,
    runpod_job_id: runpodJob.id,
    status: "training",
  });
}
