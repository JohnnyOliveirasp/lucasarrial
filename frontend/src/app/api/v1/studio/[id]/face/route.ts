/**
 * POST /api/v1/studio/[id]/face — Vídeo Estúdio F4: gera a presença do aluno
 * (InfiniteTalk Turbo) nos pontos-âncora: hook (1ª frase) e fechamento
 * (última). Body: { image_key } (foto do aluno via /studio/upload-url).
 * O GET /studio/[id] sincroniza os jobs até ready. Sem cobrança na F4
 * (pré-produção, só admin) — preço vem na F5.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { startFaceGeneration } from "@/lib/studio/face";
import { handleTechFailure } from "@/lib/support/failure-alert";
import type { StudioTranscriptWord } from "@/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const { id } = await ctx.params;

  let imageKey = "";
  try {
    const body = (await request.json()) as { image_key?: unknown };
    imageKey = typeof body.image_key === "string" ? body.image_key.trim() : "";
  } catch {
    /* sem body */
  }
  if (!imageKey.startsWith(`${auth.user_id}/studio/uploads/`)) {
    return badRequest("Foto inválida.");
  }

  const admin = getAdmin();
  const { data: project, error } = await admin
    .from("studio_projects")
    .select("id, status, face_status, clean_audio_path, transcript_words")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (error) return serverError("Failed to load studio project");
  if (!project) return notFound("Studio project");
  if (project.status !== "audio_ready" || !project.clean_audio_path) {
    return badRequest("O áudio ainda não está pronto.");
  }
  if (project.face_status === "processing") {
    return badRequest("A geração do rosto já está em andamento.");
  }
  const words = (project.transcript_words ?? []) as StudioTranscriptWord[];
  if (words.length === 0) return badRequest("Este projeto não tem transcrição.");

  try {
    const segments = await startFaceGeneration({
      projectId: id,
      userId: auth.user_id,
      cleanAudioPath: project.clean_audio_path,
      imageKey,
      words,
    });
    await admin
      .from("studio_projects")
      .update({
        face_status: "processing",
        face_image_path: imageKey,
        face_segments: segments,
      } as never)
      .eq("id", id);
    return jsonOk({ face: { status: "processing", segments: segments.length } }, 201);
  } catch (e) {
    await admin
      .from("studio_projects")
      .update({ face_status: "failed" } as never)
      .eq("id", id);
    await handleTechFailure({
      feature: "Vídeo Estúdio (início do rosto F4)",
      userId: auth.user_id,
      refId: id,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Falha ao iniciar a geração do rosto.");
  }
}
