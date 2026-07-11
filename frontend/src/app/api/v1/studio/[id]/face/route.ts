/**
 * POST /api/v1/studio/[id]/face — Vídeo Estúdio F4: gera a presença do aluno
 * (InfiniteTalk Turbo) nos pontos-âncora: hook (1ª frase) e fechamento
 * (última). Body: { image_key } (foto do aluno via /studio/upload-url).
 * O GET /studio/[id] sincroniza os jobs até ready. F5: cobra como o Vídeo
 * Clone Turbo (105 cr/s dos trechos de hook+fechamento, mín. 5s cada);
 * estorno automático se a tentativa falhar (syncFaceSegments).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { studioFaceCost } from "@/lib/studio/pricing";
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

  // Gate F5: mesma conta da UI (hook + fechamento, preço do Clone Turbo).
  const cost = studioFaceCost(words);
  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost,
    action: "gerar sua presença no vídeo",
  });
  if (!gate.ok) return gate.deny;

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
    // Débito depois dos jobs no ar (padrão da casa); ref = job do hook —
    // único por tentativa, é a chave do estorno automático em falha.
    if (gate.billed && cost > 0) {
      await debitCredits({
        userId: auth.user_id,
        amount: cost,
        kind: "video",
        refType: "studio_face",
        refId: segments[0]?.job_id ?? id,
        note: "Vídeo Estúdio — presença (rosto) no hook e fechamento",
      });
    }
    return jsonOk({ face: { status: "processing", segments: segments.length, cost: gate.billed ? cost : 0 } }, 201);
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
