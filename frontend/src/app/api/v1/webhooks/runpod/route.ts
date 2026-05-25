/**
 * POST /api/v1/webhooks/runpod
 *
 * Endpoint que o RunPod chama quando um job termina. Payload típico:
 *   {
 *     "id": "<job_id>",
 *     "status": "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT",
 *     "output": {...},
 *     "error": "...",
 *     "executionTime": 12345
 *   }
 *
 * Como o RunPod não tem HMAC oficial, a "segurança" vem de:
 *   - URL ser secreta (Site URL configurada no painel privadamente)
 *   - Match obrigatório de runpod_job_id na tabela `voices` ou `generations`
 *
 * O webhook trata TANTO jobs de treino quanto de inferência — discrimina pelo
 * conteúdo de `output` e/ou consultando qual tabela tem o job_id.
 */
import type { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { finalizeGenerationSuccess } from "@/lib/generations/finalize";
import type { VoiceStatus } from "@/lib/db/types";

type RunpodWebhookPayload = {
  id: string;
  status: string;
  output?: {
    error?: string;
    voice_id?: string;
    lora_uploaded?: boolean;
    uploaded?: boolean;
    elapsed_seconds?: number;
    elapsed_s?: number;
    trainer_returncode?: number;
    stdout_tail?: string;
    stderr_tail?: string;
    sample_rate?: number;
    duration_s?: number;
  };
  error?: string;
  executionTime?: number;
};

export async function POST(request: NextRequest) {
  let payload: RunpodWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonError("bad_request", "Invalid JSON", 400);
  }

  if (!payload.id || !payload.status) {
    return jsonError("bad_request", "Missing 'id' or 'status'", 400);
  }

  const admin = getAdmin();

  // 1. Tenta achar em voices (treino)
  const { data: voice } = await admin
    .from("voices")
    .select("id, user_id, status")
    .eq("runpod_job_id", payload.id)
    .maybeSingle();

  if (voice) {
    await handleTrainingWebhook(payload, voice.id, voice.user_id);
    return jsonOk({ handled: "training" });
  }

  // 2. Tenta achar em generations (inferência)
  const { data: generation } = await admin
    .from("generations")
    .select("id, user_id, audio_path")
    .eq("runpod_job_id", payload.id as never)
    .maybeSingle();

  if (generation) {
    await handleGenerationWebhook(payload, generation.id, generation.audio_path);
    return jsonOk({ handled: "generation" });
  }

  // Job não corresponde a nada nosso — descarta silenciosamente
  return jsonOk({ handled: "ignored", reason: "job_id not found" });
}

async function handleTrainingWebhook(
  payload: RunpodWebhookPayload,
  voiceId: string,
  _userId: string,
) {
  const admin = getAdmin();
  const out = payload.output ?? {};

  let nextStatus: VoiceStatus;
  let errorMessage: string | null = null;

  if (payload.status === "COMPLETED" && !out.error && out.trainer_returncode === 0) {
    nextStatus = "ready";
  } else {
    nextStatus = "failed";
    errorMessage = (
      out.error ||
      payload.error ||
      `trainer_returncode=${out.trainer_returncode ?? "?"}`
    ).slice(0, 500);
  }

  await admin
    .from("voices")
    .update({
      status: nextStatus,
      error_message: errorMessage,
      trained_at: nextStatus === "ready" ? new Date().toISOString() : null,
    })
    .eq("id", voiceId);

  await admin
    .from("training_jobs")
    .update({
      status: nextStatus === "ready" ? "completed" : "failed",
      elapsed_seconds: Math.round(out.elapsed_seconds ?? 0),
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("runpod_job_id", payload.id);
}

async function handleGenerationWebhook(
  payload: RunpodWebhookPayload,
  generationId: string,
  audioPath: string | null,
) {
  const out = payload.output ?? {};

  if (payload.status === "COMPLETED" && !out.error && out.uploaded) {
    // Converte WAV->MP3 e marca ready (audio_path passa a apontar pro .mp3).
    await finalizeGenerationSuccess(generationId, audioPath, out);
    return;
  }

  await getAdmin()
    .from("generations")
    .update({
      status: "failed",
      error_message: (out.error || payload.error || "unknown").slice(0, 500),
    })
    .eq("id", generationId);
}
