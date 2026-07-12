/**
 * Vídeo Clone — finalização compartilhada entre o WEBHOOK do RunPod e o poll
 * da página (GET /video-clone/[id]). Gate idempotente: só quem transiciona a
 * row dispara a contingência (estorno automático + e-mail pro suporte).
 * Server-only.
 *
 * Criado 2026-07-12 depois do incidente dos executionTimeout: sem webhook, a
 * finalização dependia do usuário manter a página aberta — job que falhava
 * com a página fechada ficava "generating" pra sempre, cobrado e sem estorno.
 */
import { getAdmin } from "@/lib/db/admin";
import { handleTechFailure } from "@/lib/support/failure-alert";

export function friendlyCloneError(raw: string): string {
  const base = (() => {
    if (/out of memory|oom/i.test(raw)) return "A geração ficou sem memória. Tente a qualidade Padrão.";
    if (/timed?_?out|executionTimeout/i.test(raw)) return "A geração demorou demais e foi cancelada. Tente novamente.";
    return "A geração falhou. Tente novamente — se persistir, fale com o suporte.";
  })();
  return `${base} Os créditos cobrados foram devolvidos automaticamente.`;
}

/**
 * Aplica o desfecho de um job do InfiniteTalk na row do clone.
 * COMPLETED → ready (o worker já subiu o MP4 no R2). Falha → failed + estorno.
 */
export async function finalizeVideoClone(args: {
  cloneId: string;
  userId: string;
  jobId: string;
  runpodStatus: string;
  rawError?: string | null;
}): Promise<{ applied: boolean }> {
  const admin = getAdmin();

  if (args.runpodStatus === "COMPLETED") {
    const { data } = await admin
      .from("video_clones")
      .update({ status: "ready", error_message: null })
      .eq("id", args.cloneId)
      .in("status", ["pending", "generating"])
      .select("id");
    return { applied: !!data && data.length > 0 };
  }

  if (!["FAILED", "CANCELLED", "TIMED_OUT"].includes(args.runpodStatus)) {
    return { applied: false };
  }

  const rawError = args.rawError || `RunPod ${args.runpodStatus}`;
  const { data: claimed } = await admin
    .from("video_clones")
    .update({ status: "failed", error_message: friendlyCloneError(rawError) })
    .eq("id", args.cloneId)
    .in("status", ["pending", "generating"])
    .select("id");
  if (!claimed || claimed.length === 0) return { applied: false };

  await handleTechFailure({
    feature: "Vídeo Clone (lip-sync)",
    userId: args.userId,
    refId: args.cloneId,
    jobId: args.jobId,
    rawError,
    debitRefType: "video_clone",
    refundRefType: "video_clone_refund",
  });
  return { applied: true };
}
