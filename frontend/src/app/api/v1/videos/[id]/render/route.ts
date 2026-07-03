/**
 * /api/v1/videos/[id]/render
 *   POST → aprova os vídeos e ENFILEIRA a montagem final (render_jobs). Exige
 *          que TODAS as cenas tenham clipe pronto. Idempotente: se já houver job
 *          pending/processing, devolve ele. O worker (ffmpeg) faz o trabalho.
 *   GET  → estado da montagem (job + status do projeto + URL do vídeo final).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { subscriptionGate } from "@/lib/credits/subscription-gate";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import {
  SUBTITLE_PRESET_IDS,
  SUBTITLE_POSITIONS,
  SUBTITLE_SIZES,
} from "@/lib/video/subtitle-presets";

async function latestJob(projectId: string) {
  const { data } = await getAdmin()
    .from("render_jobs")
    .select("id, status, error, created_at, updated_at")
    .eq("video_project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("id, status, final_video_path, error_message, subtitle_style, subtitle_position, subtitle_size")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  let final_video_url: string | null = null;
  if (project.final_video_path) {
    final_video_url = await createPresignedGet(imagesBucket(), project.final_video_path, 60 * 60).catch(
      () => null,
    );
  }

  return jsonOk({
    status: project.status,
    error_message: project.error_message,
    subtitle_style: project.subtitle_style,
    subtitle_position: project.subtitle_position,
    subtitle_size: project.subtitle_size,
    final_video_url,
    job: await latestJob(id),
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const gate = await subscriptionGate(auth);
  if (gate) return gate;

  let body: { style?: unknown; position?: unknown; size?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const style = typeof body.style === "string" && SUBTITLE_PRESET_IDS.includes(body.style)
    ? body.style
    : null;
  const position =
    typeof body.position === "string" && (SUBTITLE_POSITIONS as readonly string[]).includes(body.position)
      ? body.position
      : null;
  const size =
    typeof body.size === "string" && (SUBTITLE_SIZES as readonly string[]).includes(body.size)
      ? body.size
      : null;

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const { data: scenes } = await admin
    .from("video_scenes")
    .select("id, video_status")
    .eq("video_project_id", id);
  const list = scenes ?? [];
  if (list.length === 0) return badRequest("Gere as cenas e os vídeos primeiro.");
  if (!list.every((s) => s.video_status === "ready")) {
    return badRequest("Todas as cenas precisam ter o vídeo pronto antes de montar o final.");
  }

  // Idempotente: já tem job em andamento? devolve ele.
  const existing = await latestJob(id);
  if (existing && (existing.status === "pending" || existing.status === "processing")) {
    return jsonOk({ status: "rendering", job: existing, already: true });
  }

  const { data: job, error } = await admin
    .from("render_jobs")
    .insert({ video_project_id: id, user_id: auth.user_id, status: "pending" })
    .select("id, status, created_at")
    .maybeSingle();
  if (error || !job) return serverError("Não consegui enfileirar a montagem.");

  await admin
    .from("video_projects")
    .update({
      status: "rendering",
      error_message: null,
      ...(style ? { subtitle_style: style } : {}),
      // position/size: null = padrão do preset (ex.: "one_word" centraliza)
      subtitle_position: position,
      subtitle_size: size,
    })
    .eq("id", id)
    .eq("user_id", auth.user_id);

  return jsonOk({ status: "rendering", job });
}
