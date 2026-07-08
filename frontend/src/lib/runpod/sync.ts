/**
 * Sincroniza status de job de treino do RunPod com a tabela `voices`.
 * Chamado pelo GET /api/v1/voices/[id] quando status="training" e tem runpod_job_id.
 *
 * Slice 4 vai substituir isso por webhook do RunPod (mais eficiente).
 */
import { runpodGetStatus } from "./client";
import { finalizeTraining, type TrainOutput } from "@/lib/voices/finalize-training";
import type { VoiceStatus } from "@/lib/db/types";

type SyncResult = {
  changed: boolean;
  status: VoiceStatus;
  lora_url?: string;
  elapsed_seconds?: number;
};

export async function syncTrainingJob(
  voiceId: string,
  runpodJobId: string,
  userId: string,
): Promise<SyncResult> {
  let resp;
  try {
    resp = await runpodGetStatus(runpodJobId);
  } catch {
    return { changed: false, status: "training" };
  }

  if (resp.status === "IN_QUEUE" || resp.status === "IN_PROGRESS") {
    return { changed: false, status: "training" };
  }

  // Mesma finalização do webhook (helper compartilhado, gate idempotente):
  // voz + telemetria + estorno de dataset inútil + amostra automática.
  const out = (resp.output ?? {}) as TrainOutput;
  const { status } = await finalizeTraining({
    voiceId,
    userId,
    runpodJobId,
    runpodStatus: resp.status,
    output: out,
    runpodError: resp.error ?? null,
  });

  return { changed: true, status, elapsed_seconds: out.elapsed_seconds };
}
