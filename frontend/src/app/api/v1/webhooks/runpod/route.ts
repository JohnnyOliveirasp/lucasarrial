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
import { runpodGetStatus, inferenceEndpoint } from "@/lib/runpod/client";
import { finalizeGenerationSuccess } from "@/lib/generations/finalize";
import { recordRunpodTiming } from "@/lib/generations/runpod-timing";
import { finalizeTraining, type TrainOutput } from "@/lib/voices/finalize-training";
import {
  finalizeStudioAudio,
  finalizeStudioMontage,
  type AudioEditOutput,
  type MontageOutput,
} from "@/lib/studio/finalize";
import { finalizeVideoClone } from "@/lib/video-clone/finalize";
import { handleTechFailure } from "@/lib/support/failure-alert";
import { verificarOnboardingPronto } from "@/lib/onboarding/pronto";

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
  delayTime?: number;
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
    // Voz do onboarding ficou pronta? Pode ser a última peça → e-mail
    // "plataforma pronta" (fire-and-forget; a função filtra não-onboarding).
    void verificarOnboardingPronto(admin, voice.user_id);
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

  // 3. Tenta achar em studio_projects (Estúdio: audio_edit OU video_edit F2)
  const { data: studio } = await admin
    .from("studio_projects")
    .select("id, user_id, kind")
    .eq("runpod_job_id", payload.id as never)
    .maybeSingle();

  if (studio) {
    await finalizeStudioAudio({
      projectId: (studio as { id: string }).id,
      userId: (studio as { user_id: string }).user_id,
      kind: (studio as { kind?: string }).kind === "video" ? "video" : "audio",
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

  // 5. Tenta achar em video_clones (InfiniteTalk — endpoint próprio; sem o
  //    webhook a finalização dependia do usuário manter a página aberta)
  const { data: clone } = await admin
    .from("video_clones")
    .select("id, user_id")
    .eq("runpod_job_id", payload.id as never)
    .maybeSingle();

  if (clone) {
    await finalizeVideoClone({
      cloneId: (clone as { id: string }).id,
      userId: (clone as { user_id: string }).user_id,
      jobId: payload.id,
      runpodStatus: payload.status,
      rawError: payload.output?.error || payload.error || null,
    });
    return jsonOk({ handled: "video_clone" });
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
  // Grava o tempo de execução que o RunPod já manda no webhook (incidente
  // d3d8d1b2, 18/08): o log do worker expira ~30min depois do job, então toda
  // investigação de "tempo de execução estourado" chegava tarde e batia em 404.
  // Com elapsed_seconds preenchido na falha dá pra diferenciar HANG do worker
  // (tempo alto) de COLD START (tempo baixo) sem depender de log que expira.
  // NUNCA concatenar esse dado no error_message: a assinatura do incidente é
  // derivada do texto do erro (src/lib/incidents/classify.ts) e identificador
  // alfanumérico não normaliza — já estilhaçou a mesma falha em 4 incidentes.
  const failUpdate: {
    status: "failed";
    error_message: string;
    elapsed_seconds?: number;
  } = {
    status: "failed",
    error_message: rawError.slice(0, 500),
  };
  if (typeof payload.executionTime === "number") {
    failUpdate.elapsed_seconds = payload.executionTime / 1000; // RunPod manda em ms
  }
  // Gate idempotente (corrida webhook×poll): só quem transiciona pra failed
  // dispara a contingência (estorno + e-mail pro suporte).
  const { data: claimed } = await getAdmin()
    .from("generations")
    .update(failUpdate)
    .eq("id", generationId)
    .in("status", ["pending", "generating"])
    .select("id");
  if (claimed && claimed.length > 0) {
    // Telemetria fila×execução (migration 82, incidente d3d8d1b2): delayTime
    // separa "esperou na fila" de "rodou demais". Se o webhook não trouxer,
    // busca o status AGORA — ele expira ~30min depois do job, sweep posterior
    // chega tarde. Tudo best-effort: instrumentação NUNCA derruba o estorno.
    let delayTimeMs = payload.delayTime;
    let executionTimeMs = payload.executionTime;
    if (typeof delayTimeMs !== "number") {
      try {
        // Teto de 5s: essa busca fala com a RunPod justamente quando a RunPod
        // está mal — sem teto, um fetch pendurado (Node não tem timeout default)
        // segura o webhook ANTES do estorno. O signal cobre o total, inclusive
        // o fallback pro endpoint B. Estourou → TimeoutError → cai no catch.
        const st = await runpodGetStatus(
          payload.id,
          inferenceEndpoint(),
          AbortSignal.timeout(5000),
        );
        if (typeof st.delayTime === "number") delayTimeMs = st.delayTime;
        if (typeof executionTimeMs !== "number" && typeof st.executionTime === "number") {
          executionTimeMs = st.executionTime;
        }
      } catch {
        // segue sem — o estorno não espera telemetria
      }
    }
    await recordRunpodTiming(generationId, { delayTimeMs, executionTimeMs });
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
