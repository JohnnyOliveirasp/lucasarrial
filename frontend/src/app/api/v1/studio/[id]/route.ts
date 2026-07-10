/**
 * GET /api/v1/studio/[id] — estado do projeto do Vídeo Estúdio.
 * Se processing, consulta o RunPod e finaliza (helper compartilhado com o
 * webhook, gate idempotente). Quando audio_ready, inclui clean_audio_url
 * presignada + transcrição + relatório do que foi editado.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { isAdmin } from "@/lib/admin/guard";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS, imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { runpodGetStatus } from "@/lib/runpod/client";
import {
  finalizeStudioAudio,
  finalizeStudioMontage,
  type AudioEditOutput,
  type MontageOutput,
} from "@/lib/studio/finalize";

type Ctx = { params: Promise<{ id: string }> };

const SELECT =
  "id, user_id, name, status, raw_audio_path, clean_audio_path, duration_raw_seconds, duration_clean_seconds, kept_takes, removed_takes, transcript_words, edit_report, runpod_job_id, error_message, montage_status, montage_job_id, video_path, montage_error, montage_report, created_at";

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: project, error } = await admin
    .from("studio_projects")
    .select(SELECT)
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (error) return serverError("Failed to load studio project");
  if (!project) return notFound("Studio project");

  let current = project;
  if (current.status === "processing" && current.runpod_job_id) {
    try {
      const resp = await runpodGetStatus(current.runpod_job_id);
      if (resp.status !== "IN_QUEUE" && resp.status !== "IN_PROGRESS") {
        await finalizeStudioAudio({
          projectId: id,
          userId: auth.user_id,
          runpodJobId: current.runpod_job_id,
          runpodStatus: resp.status,
          output: (resp.output ?? {}) as AudioEditOutput,
          runpodError: resp.error ?? null,
        });
        const { data: refreshed } = await admin
          .from("studio_projects")
          .select(SELECT)
          .eq("id", id)
          .maybeSingle();
        if (refreshed) current = refreshed;
      }
    } catch {
      // devolve o estado atual; próximo poll tenta de novo
    }
  }

  // F1: poll da montagem em andamento (mesmo padrão do áudio)
  if (current.montage_status === "processing" && current.montage_job_id) {
    try {
      const resp = await runpodGetStatus(current.montage_job_id);
      if (resp.status !== "IN_QUEUE" && resp.status !== "IN_PROGRESS") {
        await finalizeStudioMontage({
          projectId: id,
          userId: auth.user_id,
          montageJobId: current.montage_job_id,
          runpodStatus: resp.status,
          output: (resp.output ?? {}) as MontageOutput,
          runpodError: resp.error ?? null,
        });
        const { data: refreshed } = await admin
          .from("studio_projects")
          .select(SELECT)
          .eq("id", id)
          .maybeSingle();
        if (refreshed) current = refreshed;
      }
    } catch {
      // devolve o estado atual; próximo poll tenta de novo
    }
  }

  let clean_audio_url: string | null = null;
  if (current.status === "audio_ready" && current.clean_audio_path) {
    try {
      clean_audio_url = await createPresignedGet(
        R2_BUCKETS.generations,
        current.clean_audio_path,
        3600,
      );
    } catch {
      clean_audio_url = null;
    }
  }

  let video_url: string | null = null;
  if (current.montage_status === "ready" && current.video_path) {
    try {
      video_url = await createPresignedGet(imagesBucket(), current.video_path, 3600);
    } catch {
      video_url = null;
    }
  }

  return jsonOk({
    project: {
      id: current.id,
      name: current.name,
      status: current.status,
      duration_raw_seconds: current.duration_raw_seconds,
      duration_clean_seconds: current.duration_clean_seconds,
      kept_takes: current.kept_takes,
      removed_takes: current.removed_takes,
      transcript_words: current.transcript_words,
      edit_report: current.edit_report,
      error_message: current.error_message,
      created_at: current.created_at,
      clean_audio_url,
      montage_status: current.montage_status,
      montage_error: current.montage_error,
      montage_report: current.montage_report,
      video_url,
    },
  });
}
