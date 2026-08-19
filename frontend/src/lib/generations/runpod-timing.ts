/**
 * Telemetria do RunPod na FALHA de uma geração (incidente d3d8d1b2). Server-only.
 *
 * O status de um job no RunPod expira ~30min depois do fim
 * (_frank/02_ACESSOS.md), então delayTime/executionTime têm que ser gravados
 * NO MOMENTO da falha — sweep posterior chega tarde e bate em 404.
 *
 * delay_seconds (fila) e execution_seconds (rodando) são o que separa COLD
 * START (delay alto, execution baixo/nulo) de HANG do worker (delay baixo,
 * execution no teto) — o elapsed_seconds sozinho não separa os dois.
 *
 * ⚠️ UPDATE SEPARADO do que marca status=failed, de propósito: as colunas vêm
 * da migration 82 (scripts/82_generations_runpod_timing.sql) e, enquanto ela
 * não for aplicada, um UPDATE único falharia INTEIRO por coluna desconhecida —
 * e derrubaria junto o gate que dispara o estorno do aluno. Instrumentação
 * falha sozinha e em silêncio; o estorno nunca depende dela.
 */
import { getAdmin } from "@/lib/db/admin";
import { logger } from "@/lib/logger/server";

export type RunpodTiming = {
  /** delayTime do RunPod em ms (espera na fila antes de começar a rodar). */
  delayTimeMs?: number;
  /** executionTime do RunPod em ms (tempo rodando de fato). */
  executionTimeMs?: number;
};

/** Grava a telemetria na row da geração. Best-effort: NUNCA lança. */
export async function recordRunpodTiming(
  generationId: string,
  timing: RunpodTiming,
): Promise<void> {
  const update: { delay_seconds?: number; execution_seconds?: number } = {};
  if (typeof timing.delayTimeMs === "number") {
    update.delay_seconds = timing.delayTimeMs / 1000; // RunPod manda em ms
  }
  if (typeof timing.executionTimeMs === "number") {
    update.execution_seconds = timing.executionTimeMs / 1000;
  }
  if (Object.keys(update).length === 0) return;

  try {
    const { error } = await getAdmin()
      .from("generations")
      .update(update as never)
      .eq("id", generationId);
    if (error) {
      // Migration 82 ainda não aplicada é o caso esperado aqui — só registra.
      logger.warn("api", "generation.runpod_timing.write_failed", {
        generationId,
        error: error.message,
      });
    }
  } catch (e) {
    logger.warn("api", "generation.runpod_timing.write_failed", {
      generationId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
