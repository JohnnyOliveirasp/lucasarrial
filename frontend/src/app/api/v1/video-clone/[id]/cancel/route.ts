/**
 * POST /api/v1/video-clone/[id]/cancel — o aluno desiste da espera.
 *
 * POR QUE EXISTE (incidente 13/09, aluno rafapaga@uol.com.br): ele reclamou no
 * chat que a geração estava "travada há mais de 1h". Não estava — o vídeo saiu
 * 89 segundos depois da reclamação. O defeito não era o job, era ele não ter
 * NENHUMA saída: `POST /video-clone` recusa nova geração com `clone_in_progress`
 * enquanto houver linha pending|generating (route.ts:113-123), e o `DELETE`
 * pula linha em voo (route.ts:341-347). Uma hora olhando pra algo que parece
 * parado, sem poder tentar de novo e sem poder desistir.
 *
 * ── A ARMADILHA DA ENTREGA TARDIA (requisito do cartão) ──────────────────
 * Se a row é marcada terminal e o job DEPOIS completa, o aluno fica com o
 * vídeo E com o crédito de volta? NÃO. Medido, não deduzido.
 *
 * `finalizeVideoClone` (lib/video-clone/finalize.ts) reivindica a row com
 * `.in("status", ["pending","generating"])` nos DOIS ramos — o COMPLETED
 * (finalize.ts:38-45) e o de falha (finalize.ts:52-58). Uma row `canceled` não
 * casa em nenhum dos dois:
 *   - webhook COMPLETED tardio  → casa 0 linhas → NÃO vira `ready`;
 *   - webhook FAILED tardio     → casa 0 linhas → `handleTechFailure` nunca
 *     roda → NÃO estorna de novo.
 * Provado contra o banco real em _Bugs/2026-09-13_provar_gate_entrega_tardia.cjs,
 * rodando os dois UPDATEs literais em cima de uma row terminal: 0 e 0, row
 * intacta. O mesmo vale pro sweeper, que só varre pending|generating
 * (agent/sweep-clones/route.ts:38-40).
 *
 * Efeito colateral aceito e conhecido: se o job completar depois do cancelamento,
 * o worker sobe um MP4 no R2 que nenhuma row aponta (órfão). Custa storage, não
 * dá vídeo de graça nem crédito dobrado. O `cancelInfiniteTalk` existe pra que
 * isso seja raro.
 *
 * ── POR QUE NÃO USA handleTechFailure ────────────────────────────────────
 * Porque cancelamento NÃO é falha nossa. `video_clone_refund` tem regra de
 * rajada (support/failure-alert.ts, BURST_RULES: 2 em 6h) que ABRE INCIDENTE na
 * aba Falhas do /admin. Estornar cancelamento voluntário por lá inundaria a
 * fila do Sentinela com defeito inexistente. Aqui o estorno sai por
 * `video_clone_cancel`, que não alimenta detector nenhum.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { cancelInfiniteTalk } from "@/lib/video-clone/runpod";
import { refundOriginalDebit } from "@/lib/support/failure-alert";
import { podeCancelar, motivoNaoCancelavel, STATUS_EM_VOO } from "@/lib/video-clone/cancelar-politica";
import { logger } from "@/lib/logger/server";

type Ctx = { params: Promise<{ id: string }> };

const MENSAGEM_ALUNO =
  "Você cancelou esta geração. Os créditos cobrados voltaram pra sua conta.";

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: clone, error } = await admin
    .from("video_clones")
    .select("id, user_id, status, runpod_job_id, credits_cost")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (error) return serverError("Failed to load video clone");
  if (!clone) return notFound("Video clone");

  // Recusa amigável ANTES de tentar reivindicar, só pra dar mensagem boa. Não
  // é a trava de verdade — a trava é o `.in(...)` do UPDATE abaixo, que é o
  // único ponto à prova de corrida.
  if (!podeCancelar(clone.status)) {
    return jsonError("nao_cancelavel", motivoNaoCancelavel(clone.status), 409);
  }

  // ── REIVINDICAÇÃO ATÔMICA ────────────────────────────────────────────────
  // Mesmo padrão do gate de `finalizeVideoClone`. Só quem TRANSICIONA a row
  // segue pro estorno. Dois cliques no botão, ou um clique competindo com o
  // webhook, e apenas um passa daqui — o outro casa 0 linhas e sai.
  // Sem isto, duplo clique = crédito devolvido duas vezes.
  const { data: claimed } = await admin
    .from("video_clones")
    .update({ status: "canceled", error_message: MENSAGEM_ALUNO })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .in("status", [...STATUS_EM_VOO])
    .select("id");
  if (!claimed || claimed.length === 0) {
    // Perdeu a corrida: o job finalizou (ou outro clique cancelou) no meio.
    const { data: agora } = await admin
      .from("video_clones")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    return jsonError("nao_cancelavel", motivoNaoCancelavel(agora?.status ?? "ready"), 409);
  }

  // Para a GPU. Best-effort de propósito (ver cancelInfiniteTalk): a row já
  // está cancelada e o estorno é obrigação nossa mesmo se o RunPod não atender.
  let runpodCancelado = false;
  if (clone.runpod_job_id) {
    runpodCancelado = await cancelInfiniteTalk(clone.runpod_job_id);
    if (!runpodCancelado) {
      logger.warn("api", "video_clone.cancel.runpod_nao_confirmou", {
        cloneId: id,
        jobId: clone.runpod_job_id,
      });
    }
  }

  // Estorno. `refType` PRÓPRIO (video_clone_cancel) pra não alimentar o
  // detector de rajada. Idempotente por contagem no extrato — cinto e suspensório
  // junto com a reivindicação atômica acima.
  let estorno = "nada cobrado (sem débito no extrato)";
  try {
    estorno = await refundOriginalDebit({
      userId: auth.user_id,
      refId: id,
      debitRefType: "video_clone",
      refundRefType: "video_clone_cancel",
    });
  } catch (e) {
    // Nunca deixa a resposta explodir depois da row já estar cancelada: o
    // aluno precisa saber que o cancelamento valeu. O estorno pendente vira
    // log alto pro suporte resolver.
    logger.error("api", "video_clone.cancel.estorno_falhou", {
      cloneId: id,
      userId: auth.user_id,
      error: e instanceof Error ? e.message : String(e),
    });
    estorno = "ESTORNO FALHOU — aplicar manualmente!";
  }

  logger.info("api", "video_clone.cancel", {
    cloneId: id,
    userId: auth.user_id,
    runpodCancelado,
    estorno,
  });

  return jsonOk({ canceled: true, refund: estorno, runpod_canceled: runpodCancelado });
}
