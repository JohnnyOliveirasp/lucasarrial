/**
 * Sweep de imagens presas (incidente 69f0aec5) — rede de segurança embaixo do
 * webhook/poll do Kie, igual à do sweep-clones pro RunPod: image_generations
 * presa em pending/generating há 10min+ é reconciliada via syncImageTask
 * (success → baixa+R2+ready; fail definitivo → failed+estorno; transiente →
 * retry cruzado), e registro sem task no Kie há 1h+ vira failed órfão.
 *
 * A lógica (e os testes) vivem em sweep-stuck-core.ts; aqui só se ligam as
 * dependências reais. Chamado pelo cron de 5min (sweep-clones/route.ts).
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { syncImageTask } from "@/lib/images/sync";
import { failImageGeneration } from "@/lib/images/finalize";
import {
  sweepStuckImagesWith,
  type ImageSweepSummary,
  type StuckImageRow,
} from "@/lib/images/sweep-stuck-core";

export type { ImageSweepSummary };

export async function sweepStuckImageGenerations(): Promise<ImageSweepSummary> {
  const admin = getAdmin();
  return sweepStuckImagesWith({
    fetchStuck: async (cutoffIso, limit) => {
      const { data, error } = await admin
        .from("image_generations")
        .select("id, user_id, status, kie_task_id, created_at")
        .in("status", ["pending", "generating"])
        .lt("created_at", cutoffIso)
        .order("created_at", { ascending: true })
        .limit(limit);
      return {
        data: (data as StuckImageRow[] | null) ?? null,
        error: error ? { message: error.message } : null,
      };
    },
    sync: syncImageTask,
    readStatus: async (id) => {
      const { data } = await admin
        .from("image_generations")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      return (data as { status?: string } | null)?.status ?? null;
    },
    failOrphan: failImageGeneration,
    now: Date.now,
  });
}
