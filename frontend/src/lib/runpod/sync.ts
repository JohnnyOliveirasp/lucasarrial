/**
 * Sincroniza status de job de treino do RunPod com a tabela `voices`.
 * Chamado pelo GET /api/v1/voices/[id] quando status="training" e tem runpod_job_id.
 *
 * Slice 4 vai substituir isso por webhook do RunPod (mais eficiente).
 */
import { getAdmin } from "@/lib/db/admin";
import { buildAutoReferenceKey } from "@/lib/r2/presigned";
import { runpodGetStatus } from "./client";
import type { VoiceStatus, VoiceUpdate } from "@/lib/db/types";

type SyncResult = {
  changed: boolean;
  status: VoiceStatus;
  lora_url?: string;
  elapsed_seconds?: number;
};

type TrainOutput = {
  voice_id?: string;
  lora_uploaded?: boolean;
  reference_uploaded?: boolean;
  reference_transcript?: string | null;
  lora_alpha?: number;
  elapsed_seconds?: number;
  steps?: number;
  trainer_returncode?: number;
  dataset_chunks?: number;
  error?: string;
  stdout_tail?: string;
  stderr_tail?: string;
};

export async function syncTrainingJob(
  voiceId: string,
  runpodJobId: string,
  userId: string,
): Promise<SyncResult> {
  let resp;
  try {
    resp = await runpodGetStatus(runpodJobId);
  } catch (e) {
    return { changed: false, status: "training" };
  }

  if (resp.status === "IN_QUEUE" || resp.status === "IN_PROGRESS") {
    return { changed: false, status: "training" };
  }

  const admin = getAdmin();

  if (resp.status === "COMPLETED") {
    const out = (resp.output ?? {}) as TrainOutput;
    if (out.error || out.trainer_returncode !== 0) {
      await admin
        .from("voices")
        .update({
          status: "failed",
          error_message: out.error || `trainer exit=${out.trainer_returncode}`,
        })
        .eq("id", voiceId);
      return { changed: true, status: "failed" };
    }
    // Sucesso. Grava os MESMOS campos que o webhook (este polling é o caminho
    // quando o webhook não chega — ex.: rodando local com SITE_URL=localhost).
    const update: VoiceUpdate = {
      status: "ready",
      trained_at: new Date().toISOString(),
    };
    if (out.reference_uploaded) {
      update.reference_audio_path = buildAutoReferenceKey(userId, voiceId);
      update.reference_transcript = out.reference_transcript ?? null;
    }
    if (typeof out.lora_alpha === "number") {
      update.lora_alpha = out.lora_alpha;
    }
    await admin.from("voices").update(update).eq("id", voiceId);

    return {
      changed: true,
      status: "ready",
      elapsed_seconds: out.elapsed_seconds,
    };
  }

  // FAILED / CANCELLED / TIMED_OUT
  await admin
    .from("voices")
    .update({
      status: "failed",
      error_message: `RunPod job ${resp.status}: ${resp.error || ""}`.slice(0, 500),
    })
    .eq("id", voiceId);

  return { changed: true, status: "failed" };
}
