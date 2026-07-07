/**
 * POST /api/v1/videos/[id]/audio — Vídeo Vendas TikTok: anexa a VOZ ao projeto.
 * Dois caminhos (teto do sales: 60s):
 *   { generation_id } → áudio TTS gerado com voz clonada (o roteiro é o texto);
 *   { uploaded_key }  → áudio PRÓPRIO enviado (via /videos/upload-audio);
 *                       Whisper transcreve e a TRANSCRIÇÃO VIRA o roteiro
 *                       (cenas/legendas casam com o que é realmente falado).
 * Com o áudio anexado o projeto converge pro pipeline normal (cenas → final).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { SALES_MAX_AUDIO_SECONDS } from "@/lib/video/config";
import { transcribeUploadedAudio } from "@/lib/video/transcribe";
import { loadSalesProject } from "@/lib/video/sales";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const project = await loadSalesProject(id, auth.user_id);
  if (!project) return notFound("Video project");
  if (project.status !== "draft") {
    return badRequest("Este projeto já tem áudio definido.");
  }

  let body: { generation_id?: unknown; uploaded_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const generationId = typeof body.generation_id === "string" ? body.generation_id.trim() : "";
  const uploadedKey = typeof body.uploaded_key === "string" ? body.uploaded_key.trim() : "";
  if (!generationId && !uploadedKey) return badRequest("Informe o áudio.");

  const admin = getAdmin();

  // ── Caminho A: TTS com voz clonada ──────────────────────────────────────────
  if (generationId) {
    const { data: gen, error: genErr } = await admin
      .from("generations")
      .select("id, status, audio_path, duration_seconds")
      .eq("id", generationId)
      .eq("user_id", auth.user_id)
      .maybeSingle();
    if (genErr) return serverError("Failed to load audio");
    if (!gen) return badRequest("Áudio não encontrado.");
    if (gen.status !== "ready" || !gen.audio_path) {
      return badRequest("Este áudio ainda não está pronto.");
    }
    if (gen.duration_seconds == null || gen.duration_seconds > SALES_MAX_AUDIO_SECONDS + 0.5) {
      return badRequest(
        `O áudio precisa ter no máximo ${SALES_MAX_AUDIO_SECONDS}s — encurte o roteiro e gere de novo.`,
      );
    }

    const { error } = await admin
      .from("video_projects")
      .update({
        source_generation_id: gen.id,
        audio_path: gen.audio_path,
        audio_duration_seconds: gen.duration_seconds,
      })
      .eq("id", id)
      .eq("user_id", auth.user_id);
    if (error) return serverError("Falha ao anexar o áudio");
    return jsonOk({ ok: true, duration: gen.duration_seconds });
  }

  // ── Caminho B: áudio próprio enviado ────────────────────────────────────────
  if (!uploadedKey.startsWith(`${auth.user_id}/video-uploads/`)) {
    return badRequest("Áudio enviado inválido.");
  }

  let text = "";
  let duration = 0;
  try {
    const t = await transcribeUploadedAudio(uploadedKey);
    text = t.text;
    duration = t.durationSeconds;
  } catch {
    return serverError("Não conseguimos processar esse áudio. Tente novamente.");
  }
  if (duration <= 0) return badRequest("Não conseguimos ler a duração desse áudio.");
  if (duration > SALES_MAX_AUDIO_SECONDS + 0.5) {
    return badRequest(
      `O áudio tem ${Math.round(duration)}s — no Vídeo Vendas o máximo é ${SALES_MAX_AUDIO_SECONDS}s.`,
    );
  }
  if (!text) {
    return badRequest("Não encontramos fala nesse áudio — as cenas nascem do que é falado.");
  }

  const { error } = await admin
    .from("video_projects")
    .update({
      source_generation_id: null,
      audio_path: uploadedKey,
      audio_duration_seconds: duration,
      // O que vale é o que está FALADO: transcrição substitui o roteiro.
      script_text: text,
    })
    .eq("id", id)
    .eq("user_id", auth.user_id);
  if (error) return serverError("Falha ao anexar o áudio");
  return jsonOk({ ok: true, duration, transcript: text });
}
