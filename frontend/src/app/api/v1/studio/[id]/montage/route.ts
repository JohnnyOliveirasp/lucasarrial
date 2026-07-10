/**
 * POST /api/v1/studio/[id]/montage — Vídeo Estúdio F1: monta o vídeo 9:16 a
 * partir do áudio limpo (F0) + banco de CENAS DE TESTE fixo. Sem cobrança na
 * F1 (pré-produção, só admin). O GET /studio/[id] faz o poll até ready.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { R2_BUCKETS, imagesBucket } from "@/lib/r2/client";
import { createPresignedGet, createPresignedPut } from "@/lib/r2/presigned";
import { runpodSubmitTrain, webhookUrlFor } from "@/lib/runpod/client";
import { handleTechFailure } from "@/lib/support/failure-alert";

type Ctx = { params: Promise<{ id: string }> };

const JOB_EXPIRES_SECONDS = 7200;
/** Banco fixo da F1 (bucket voices, permanente). F3 troca por cenas geradas. */
const TEST_SCENE_KEYS = [1, 2, 3, 4, 5, 6].map((n) => `studio-test-scenes/scene${n}.mp4`);

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const { id } = await ctx.params;

  // Trilha escolhida pelo usuário — ou nenhuma ("Sem música").
  let musicKey: string | null = null;
  try {
    const body = (await request.json()) as { music_key?: unknown };
    if (typeof body.music_key === "string" && body.music_key.startsWith("studio-music/")) {
      musicKey = body.music_key;
    }
  } catch {
    /* sem body = sem música */
  }

  const admin = getAdmin();
  const { data: project, error } = await admin
    .from("studio_projects")
    .select("id, status, montage_status, clean_audio_path, transcript_words")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (error) return serverError("Failed to load studio project");
  if (!project) return notFound("Studio project");
  if (project.status !== "audio_ready" || !project.clean_audio_path) {
    return badRequest("O áudio ainda não está pronto.");
  }
  if (project.montage_status === "processing") {
    return badRequest("A montagem já está em andamento.");
  }
  const words = project.transcript_words ?? [];
  if (!Array.isArray(words) || words.length === 0) {
    return badRequest("Este projeto não tem transcrição — refaça a limpeza do áudio.");
  }

  // Presigned: áudio limpo + cenas de teste (GET) e vídeo final (PUT, permanente)
  const videoKey = `${auth.user_id}/studio/${id}/video.mp4`;
  let audioUrl: string;
  let sceneUrls: string[];
  let videoPutUrl: string;
  let musicUrl: string | null = null;
  try {
    audioUrl = await createPresignedGet(R2_BUCKETS.generations, project.clean_audio_path, JOB_EXPIRES_SECONDS);
    sceneUrls = await Promise.all(
      TEST_SCENE_KEYS.map((k) => createPresignedGet(R2_BUCKETS.voices, k, JOB_EXPIRES_SECONDS)),
    );
    videoPutUrl = await createPresignedPut(imagesBucket(), videoKey, "video/mp4", JOB_EXPIRES_SECONDS);
    if (musicKey) {
      musicUrl = await createPresignedGet(R2_BUCKETS.voices, musicKey, JOB_EXPIRES_SECONDS);
    }
  } catch {
    return serverError("Não consegui preparar os arquivos da montagem.");
  }

  let jobId: string;
  try {
    const job = await runpodSubmitTrain(
      {
        type: "montage",
        audio_url: audioUrl,
        words,
        scene_urls: sceneUrls,
        output_upload_url: videoPutUrl,
        captions: true,
        music_url: musicUrl,
      },
      { webhook: webhookUrlFor("generation") },
    );
    jobId = job.id;
  } catch (e) {
    await handleTechFailure({
      feature: "Vídeo Estúdio (início da montagem F1)",
      userId: auth.user_id,
      refId: id,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Falha ao iniciar a montagem.");
  }

  await admin
    .from("studio_projects")
    .update({
      montage_status: "processing",
      montage_job_id: jobId,
      video_path: videoKey,
      montage_error: null,
    } as never)
    .eq("id", id);

  return jsonOk({ montage: { status: "processing" } }, 201);
}
