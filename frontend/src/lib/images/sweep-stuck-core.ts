/**
 * Lógica PURA do sweep de imagens presas (incidente 69f0aec5, 22/08) —
 * testável com `node --test`, zero dependências (as de verdade entram por
 * injeção em sweep-stuck.ts).
 *
 * O buraco: image_generations só era reconciliada com o Kie pelo poll da tela
 * (GET /images/[id]) e pelo webhook. Webhook que não chega + tela fechada =
 * row presa em pending/generating PARA SEMPRE (achada uma de 28 dias, e uma
 * em que o Kie tinha ENTREGUE a imagem em 74s e ninguém foi buscar).
 */

export type ImageSweepSummary = {
  checked: number;
  ready: number;
  failed: number;
  still_running: number;
  orphan_failed: number;
  errors: number;
};

export type StuckImageRow = {
  id: string;
  user_id: string;
  status: string;
  kie_task_id: string | null;
  created_at: string;
};

/** Só olha o que está preso há 10min+ (mesma régua do sweep-clones). */
export const STUCK_AFTER_MS = 10 * 60 * 1000;
/** Sem kie_task_id há 1h+ = órfão de verdade (mais nova pode estar submetendo). */
export const NO_TASK_FAIL_MS = 60 * 60 * 1000;
/** Teto por rodada — o cron roda a cada 5min, o resto sai na próxima. */
export const MAX_POR_RODADA = 25;

export type ImageSweepDeps = {
  /** Busca as rows presas (pending/generating mais velhas que cutoff). */
  fetchStuck: (
    cutoffIso: string,
    limit: number,
  ) => Promise<{ data: StuckImageRow[] | null; error: { message: string } | null }>;
  /** syncImageTask real: reconcilia UMA row com o Kie (ready/retry/failed+estorno). */
  sync: (id: string, userId: string, taskId: string) => Promise<void>;
  /** Relê o status da row DEPOIS do sync (o que o banco diz, não o que se planejou). */
  readStatus: (id: string) => Promise<string | null>;
  /** failImageGeneration real: failed + estorno automático. */
  failOrphan: (id: string, message: string) => Promise<void>;
  now: () => number;
};

export async function sweepStuckImagesWith(
  deps: ImageSweepDeps,
): Promise<ImageSweepSummary> {
  const summary: ImageSweepSummary = {
    checked: 0,
    ready: 0,
    failed: 0,
    still_running: 0,
    orphan_failed: 0,
    errors: 0,
  };

  const cutoff = new Date(deps.now() - STUCK_AFTER_MS).toISOString();
  const { data, error } = await deps.fetchStuck(cutoff, MAX_POR_RODADA);
  // Consulta que erra volta data:null — sem este guard o resumo mentiria
  // "0 presas" (armadilha que já custou caro neste repo: zero sem denominador).
  if (error) {
    console.error("[images/sweep-stuck] consulta falhou:", error.message);
    summary.errors += 1;
    return summary;
  }

  const rows = data ?? [];
  summary.checked = rows.length;

  for (const row of rows) {
    // try/catch INDIVIDUAL: uma row ruim não pode derrubar o sweep.
    try {
      if (!row.kie_task_id) {
        const ageMs = deps.now() - new Date(row.created_at).getTime();
        if (ageMs > NO_TASK_FAIL_MS) {
          await deps.failOrphan(row.id, "registro sem task no Kie (órfão)");
          summary.orphan_failed += 1;
        }
        // Mais nova que 1h: ainda pode estar submetendo — não toca.
        continue;
      }

      await deps.sync(row.id, row.user_id, row.kie_task_id);
      // Conta o que o BANCO diz depois do sync, não o que o código planejou.
      const after = await deps.readStatus(row.id);
      if (after === "ready") summary.ready += 1;
      else if (after === "failed") summary.failed += 1;
      // pending/generating (retry no ar, fila do Kie) ou null (aluno apagou a
      // row no meio — o DELETE do histórico hard-deleta): próximo sweep decide.
      else summary.still_running += 1;
    } catch (e) {
      summary.errors += 1;
      console.error(
        `[images/sweep-stuck] row ${row.id} falhou:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return summary;
}
