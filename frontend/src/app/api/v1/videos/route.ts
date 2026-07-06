/**
 * /api/v1/videos
 *   GET    → lista os projetos de vídeo do usuário (o board "Vídeo História")
 *   POST   → cria um projeto a partir de:
 *              { generation_id }  áudio gerado (TTS), OU
 *              { uploaded_key }   áudio PRÓPRIO enviado (via /videos/upload-audio);
 *                                 transcrito com Whisper (o roteiro das cenas
 *                                 nasce do texto) e com a duração REAL validada
 *                                 no servidor (teto de 90s, à prova de burla)
 *   DELETE → apaga em lote { ids: string[] }
 *
 * Fase 1 do wizard de vídeo. Um projeto nasce do áudio escolhido pelo usuário;
 * os estágios seguintes (cenas/imagens/vídeos/render) preenchem o resto.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { MAX_AUDIO_SECONDS } from "@/lib/video/config";
import { transcribeUploadedAudio } from "@/lib/video/transcribe";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("video_projects")
    .select(
      "id, name, status, audio_duration_seconds, scene_count, video_tier, final_video_path, error_message, created_at",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list video projects");

  return jsonOk({ projects: rows ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { generation_id?: unknown; uploaded_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const generationId = typeof body.generation_id === "string" ? body.generation_id.trim() : "";
  const uploadedKey = typeof body.uploaded_key === "string" ? body.uploaded_key.trim() : "";
  if (!generationId && !uploadedKey) return badRequest("Selecione um áudio para começar.");

  const admin = getAdmin();

  // ── Caminho 2: áudio PRÓPRIO enviado pelo usuário ──────────────────────────
  if (uploadedKey) {
    // A chave é do próprio usuário? (prefixo garante dono + pasta certa)
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

    // Validação DEFINITIVA do teto (o browser valida antes, mas aqui é a real).
    if (duration <= 0) return badRequest("Não conseguimos ler a duração desse áudio.");
    if (duration > MAX_AUDIO_SECONDS + 0.5) {
      return badRequest(
        `O áudio tem ${Math.round(duration)}s — o máximo é ${MAX_AUDIO_SECONDS}s (1min30s).`,
      );
    }
    if (!text) {
      return badRequest("Não encontramos fala nesse áudio — as cenas nascem do que é falado.");
    }

    const { data: created, error: insErr } = await admin
      .from("video_projects")
      .insert({
        user_id: auth.user_id,
        status: "draft",
        source_generation_id: null,
        audio_path: uploadedKey,
        audio_duration_seconds: duration,
        script_text: text,
      })
      .select("id, status")
      .single();

    if (insErr || !created) return serverError("Failed to create video project");
    return jsonOk({ id: created.id, status: created.status }, 201);
  }

  // ── Caminho 1: áudio gerado (TTS) ──────────────────────────────────────────

  // O áudio precisa ser do próprio usuário, estar pronto e ter <= 90s.
  const { data: gen, error: genErr } = await admin
    .from("generations")
    .select("id, status, audio_path, duration_seconds, text_raw")
    .eq("id", generationId)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (genErr) return serverError("Failed to load audio");
  if (!gen) return badRequest("Áudio não encontrado.");
  if (gen.status !== "ready" || !gen.audio_path) {
    return badRequest("Este áudio ainda não está pronto.");
  }
  if (gen.duration_seconds == null || gen.duration_seconds > MAX_AUDIO_SECONDS) {
    return badRequest(`O áudio precisa ter no máximo ${MAX_AUDIO_SECONDS} segundos.`);
  }

  const { data: created, error: insErr } = await admin
    .from("video_projects")
    .insert({
      user_id: auth.user_id,
      status: "draft",
      source_generation_id: gen.id,
      audio_path: gen.audio_path,
      audio_duration_seconds: gen.duration_seconds,
      script_text: gen.text_raw,
    })
    .select("id, status")
    .single();

  if (insErr || !created) return serverError("Failed to create video project");

  return jsonOk({ id: created.id, status: created.status }, 201);
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { ids?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return badRequest("Nenhum vídeo selecionado");

  const admin = getAdmin();
  // Fase 1 não tem assets de vídeo no R2 ainda; nas fases seguintes a limpeza de
  // clipes/render entra aqui (deleteByPrefix do bucket de vídeo).
  const { data: deleted, error } = await admin
    .from("video_projects")
    .delete()
    .eq("user_id", auth.user_id)
    .in("id", ids)
    .select("id");
  if (error) return serverError("Failed to delete video projects");

  return jsonOk({ deleted: (deleted ?? []).length });
}
