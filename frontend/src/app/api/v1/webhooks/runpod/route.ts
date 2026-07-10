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
import { finalizeTraining, type TrainOutput } from "@/lib/voices/finalize-training";
import {
  finalizeStudioAudio,
  finalizeStudioMontage,
  type AudioEditOutput,
  type MontageOutput,
} from "@/lib/studio/finalize";
import { handleTechFailure } from "@/lib/support/failure-alert";

type RunpodWebhookPayload = {
  id: string;
  status: string;
  output?: {
    error?: string;
    voice_id?: string;
    lora_uploaded?: boolean;
    uploaded?: boolean;
    reference_uploaded?: boolean;
    reference_transcript?: string | null;
    lora_alpha?: number;
    lora_rank?: number;
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
    await handleGenerationWebhook(payload, generation.id, generation.user_id, generation.audio_path);
    return jsonOk({ handled: "generation" });
  }

  // 3. Tenta achar em studio_projects (Vídeo Estúdio: audio_edit)
  const { data: studio } = await admin
    .from("studio_projects")
    .select("id, user_id")
    .eq("runpod_job_id", payload.id as never)
    .maybeSingle();

  if (studio) {
    await finalizeStudioAudio({
      projectId: (studio as { id: string }).id,
      userId: (studio as { user_id: string }).user_id,
      runpodJobId: payload.id,
      runpodStatus: payload.status,
      output: (payload.output ?? {}) as AudioEditOutput,
      runpodError: payload.error ?? null,
    });
    return jsonOk({ handled: "studio" });
  }

  // 4. Tenta achar em studio_projects pela MONTAGEM (Vídeo Estúdio F1)
  const { data: studioMontage } = await admin
    .from("studio_projects")
    .select("id, user_id")
    .eq("montage_job_id", payload.id as never)
    .maybeSingle();

  if (studioMontage) {
    await finalizeStudioMontage({
      projectId: (studioMontage as { id: string }).id,
      userId: (studioMontage as { user_id: string }).user_id,
      montageJobId: payload.id,
      runpodStatus: payload.status,
      output: (payload.output ?? {}) as MontageOutput,
      runpodError: payload.error ?? null,
    });
    return jsonOk({ handled: "studio_montage" });
  }

  // Job não corresponde a nada nosso — descarta silenciosamente
  return jsonOk({ handled: "ignored", reason: "job_id not found" });
}

async function handleTrainingWebhook(
  payload: RunpodWebhookPayload,
  voiceId: string,
  userId: string,
) {
  // Toda a lógica (voz + telemetria + estorno + amostra) vive no helper
  // compartilhado com o polling — gate idempotente evita dupla finalização.
  await finalizeTraining({
    voiceId,
    userId,
    runpodJobId: payload.id,
    runpodStatus: payload.status,
    output: (payload.output ?? {}) as TrainOutput,
    runpodError: payload.error ?? null,
  });
}

async function handleGenerationWebhook(
  payload: RunpodWebhookPayload,
  generationId: string,
  userId: string,
  audioPath: string | null,
) {
  const out = payload.output ?? {};

  if (payload.status === "COMPLETED" && !out.error && out.uploaded) {
    // Converte WAV->MP3 e marca ready (audio_path passa a apontar pro .mp3).
    await finalizeGenerationSuccess(generationId, audioPath, out);
    return;
  }

  const rawError = out.error || payload.error || `RunPod ${payload.status}`;
  // Gate idempotente (corrida webhook×poll): só quem transiciona pra failed
  // dispara a contingência (estorno + e-mail pro suporte).
  const { data: claimed } = await getAdmin()
    .from("generations")
    .update({
      status: "failed",
      error_message: rawError.slice(0, 500),
    })
    .eq("id", generationId)
    .in("status", ["pending", "generating"])
    .select("id");
  if (claimed && claimed.length > 0) {
    await handleTechFailure({
      feature: "Geração de áudio (TTS)",
      userId,
      refId: generationId,
      jobId: payload.id,
      rawError,
      debitRefType: "generation",
      refundRefType: "generation_refund",
    });
  }
}
