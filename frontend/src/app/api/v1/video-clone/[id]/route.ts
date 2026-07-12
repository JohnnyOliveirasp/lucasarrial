/**
 * GET /api/v1/video-clone/[id]
 * Estado do job. Se pending/generating, consulta o RunPod e atualiza
 * (COMPLETED → o worker JÁ subiu o MP4 no R2 via node aiverse → ready;
 * FAILED → mensagem amigável). Quando ready, inclui video_url presignada.
 * PATCH → renomeia { name }.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { getInfiniteTalkStatus } from "@/lib/video-clone/runpod";
import { finalizeVideoClone } from "@/lib/video-clone/finalize";

type Ctx = { params: Promise<{ id: string }> };

const SELECT =
  "id, user_id, name, duration_seconds, tier, credits_cost, status, error_message, runpod_job_id, video_path, created_at";

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: clone, error } = await admin
    .from("video_clones")
    .select(SELECT)
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (error) return serverError("Failed to load video clone");
  if (!clone) return notFound("Video clone");

  let current = clone;
  const polling = current.status === "pending" || current.status === "generating";
  if (polling && current.runpod_job_id) {
    try {
      const st = await getInfiniteTalkStatus(current.runpod_job_id);
      if (st.status === "COMPLETED" || st.status === "FAILED" || st.status === "CANCELLED" || st.status === "TIMED_OUT") {
        // Finalização compartilhada com o webhook (gate idempotente lá dentro).
        await finalizeVideoClone({
          cloneId: id,
          userId: auth.user_id,
          jobId: current.runpod_job_id,
          runpodStatus: st.status,
          rawError: st.error,
        });
      } else if (st.status === "IN_PROGRESS" && current.status === "pending") {
        await admin.from("video_clones").update({ status: "generating" }).eq("id", id);
      }
      const { data: refreshed } = await admin
        .from("video_clones")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (refreshed) current = refreshed;
    } catch {
      // devolve o estado atual; próximo poll tenta de novo
    }
  }

  let video_url: string | null = null;
  if (current.status === "ready" && current.video_path) {
    try {
      video_url = await createPresignedGet(imagesBucket(), current.video_path, 60 * 60);
    } catch {
      video_url = null;
    }
  }

  return jsonOk({
    clone: {
      id: current.id,
      name: current.name,
      duration_seconds: current.duration_seconds,
      tier: current.tier,
      credits_cost: current.credits_cost,
      status: current.status,
      error_message: current.error_message,
      created_at: current.created_at,
      video_url,
    },
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (typeof body.name !== "string") return badRequest("Nome inválido");
  const trimmed = body.name.trim().slice(0, 120);

  const admin = getAdmin();
  const { data, error } = await admin
    .from("video_clones")
    .update({ name: trimmed === "" ? null : trimmed })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id, name")
    .maybeSingle();
  if (error) return serverError("Failed to rename");
  if (!data) return notFound("Video clone");
  return jsonOk({ clone: data });
}
