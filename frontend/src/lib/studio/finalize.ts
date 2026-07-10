/**
 * Vídeo Estúdio F0 — finalização do job audio_edit (webhook do RunPod E
 * polling; quem chegar primeiro ganha via gate idempotente). Em falha
 * técnica: estorno automático + e-mail pro suporte (lib/support).
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { handleTechFailure } from "@/lib/support/failure-alert";

export type AudioEditOutput = {
  edited?: boolean;
  uploaded?: boolean;
  duration_raw?: number;
  duration_clean?: number;
  kept_takes?: number;
  removed_takes?: number;
  words?: { start: number; end: number; word: string }[];
  report?: string;
  error?: string;
  max_seconds?: number;
};

function friendlyStudioError(out: AudioEditOutput, raw: string): string {
  if (out.error === "audio_too_long") {
    const max = Math.round((out.max_seconds ?? 600) / 60);
    return `O áudio passa do limite de ${max} minutos. Grave em partes menores.`;
  }
  if (out.error === "no_speech") {
    return "Não encontramos fala nesse áudio. Confira o arquivo e tente de novo.";
  }
  if (raw === "audio_too_long" || raw === "no_speech") return raw;
  return (
    "Tivemos um problema técnico ao processar seu áudio — não foi culpa sua. " +
    "Seus créditos foram devolvidos automaticamente. Tente novamente."
  );
}

/** Erros causados pelo próprio áudio (não são falha técnica nossa). */
function isInputError(out: AudioEditOutput): boolean {
  return out.error === "audio_too_long" || out.error === "no_speech";
}

export async function finalizeStudioAudio(args: {
  projectId: string;
  userId: string;
  runpodJobId: string;
  runpodStatus: string;
  output: AudioEditOutput;
  runpodError?: string | null;
}): Promise<{ applied: boolean }> {
  const { projectId, userId, runpodJobId, runpodStatus, output: out } = args;
  const admin = getAdmin();

  const success = runpodStatus === "COMPLETED" && !out.error && out.uploaded === true;
  const rawError = out.error || args.runpodError || `RunPod ${runpodStatus}`;

  // Gate idempotente: só UM caminho (webhook OU poll) finaliza.
  const { data: claimed } = await admin
    .from("studio_projects")
    .update({
      status: success ? "audio_ready" : "failed",
      duration_raw_seconds: out.duration_raw ?? null,
      duration_clean_seconds: out.duration_clean ?? null,
      kept_takes: out.kept_takes ?? null,
      removed_takes: out.removed_takes ?? null,
      transcript_words: out.words ?? null,
      edit_report: out.report ?? null,
      error_message: success ? null : friendlyStudioError(out, rawError),
    } as never)
    .eq("id", projectId)
    .eq("runpod_job_id", runpodJobId)
    .eq("status", "processing")
    .select("id");
  if (!claimed || claimed.length === 0) return { applied: false };

  // Estorno + alerta: qualquer falha devolve os créditos (o aluno não recebeu
  // nada); só falha TÉCNICA acorda o suporte (erro de input é do usuário).
  if (!success) {
    await handleTechFailure({
      feature: "Vídeo Estúdio (limpeza de áudio)",
      userId,
      refId: projectId,
      jobId: runpodJobId,
      rawError,
      debitRefType: "studio_audio",
      refundRefType: "studio_audio_refund",
      alertSupport: !isInputError(out),
    });
  }
  return { applied: true };
}
