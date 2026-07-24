/**
 * POST /api/v1/agent/sweep-clones — sweeper de jobs órfãos do Vídeo Clone.
 * Rede de segurança embaixo do webhook/poll (caso samuel 24/07: falha só
 * finalizou 5h22 depois porque o webhook não disparou e a página fechou).
 * Cron no Hetzner chama a cada 5min com x-agent-token (AGENT_MONITOR_TOKEN).
 *
 * Pra cada clone preso em pending/generating há >10min: consulta o RunPod e
 * aplica a MESMA finalização do webhook (finalizeVideoClone — ready, ou
 * failed + estorno automático). Job que nem existe mais no RunPod (expirou
 * sem resposta) ou registro sem job id há >1h → failed + estorno.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { getAdmin } from "@/lib/db/admin";
import { getInfiniteTalkStatus } from "@/lib/video-clone/runpod";
import { finalizeVideoClone } from "@/lib/video-clone/finalize";

const STUCK_AFTER_MS = 10 * 60 * 1000; // só olha o que está preso há 10min+
const NO_JOB_FAIL_MS = 60 * 60 * 1000; // sem job id há 1h = órfão de verdade
const GONE_FAIL_MS = 30 * 60 * 1000;   // 404 no RunPod com 30min+ = expirou

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  const admin = getAdmin();

  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data: stuck, error } = await admin
    .from("video_clones")
    .select("id, user_id, status, runpod_job_id, created_at")
    .in("status", ["pending", "generating"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return jsonError("db_error", error.message, 500);

  let ready = 0;
  let failed = 0;
  let running = 0;
  let errors = 0;
  for (const c of stuck ?? []) {
    const ageMs = Date.now() - new Date(c.created_at).getTime();
    try {
      if (!c.runpod_job_id) {
        if (ageMs > NO_JOB_FAIL_MS) {
          const r = await finalizeVideoClone({
            cloneId: c.id, userId: c.user_id, jobId: "",
            runpodStatus: "FAILED", rawError: "registro sem job no RunPod (órfão)",
          });
          if (r.applied) failed += 1;
        }
        continue;
      }
      const st = await getInfiniteTalkStatus(c.runpod_job_id);
      if (st.status === "COMPLETED" || st.status === "FAILED" || st.status === "CANCELLED" || st.status === "TIMED_OUT") {
        const r = await finalizeVideoClone({
          cloneId: c.id, userId: c.user_id, jobId: c.runpod_job_id,
          runpodStatus: st.status, rawError: st.error,
        });
        if (r.applied) {
          if (st.status === "COMPLETED") ready += 1;
          else failed += 1;
        }
      } else {
        running += 1;
        if (st.status === "IN_PROGRESS" && c.status === "pending") {
          await admin.from("video_clones").update({ status: "generating" }).eq("id", c.id);
        }
      }
    } catch (e) {
      // 404 = RunPod já descartou o job (terminou há 30min+ sem ninguém ouvir).
      if (e instanceof Error && /status 404/.test(e.message) && ageMs > GONE_FAIL_MS) {
        const r = await finalizeVideoClone({
          cloneId: c.id, userId: c.user_id, jobId: c.runpod_job_id ?? "",
          runpodStatus: "FAILED", rawError: "job não existe mais no RunPod (expirou sem resposta)",
        });
        if (r.applied) failed += 1;
      } else {
        errors += 1; // rede/instabilidade: próximo sweep tenta de novo
      }
    }
  }

  const summary = { checked: (stuck ?? []).length, ready, failed_refunded: failed, still_running: running, errors };
  if (summary.checked > 0) console.log("[sweep-clones]", JSON.stringify(summary));
  return jsonOk({ sweep: summary });
}
