/**
 * POST /api/v1/video-clone/transcribe
 * Transcreve (Whisper) um áudio RECÉM-ENVIADO pro Vídeo Clone e devolve
 * { text, duration_seconds } — pra pessoa VER o que o áudio fala antes de
 * gastar créditos. A validação definitiva continua no POST /video-clone.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { transcribeUploadedAudio } from "@/lib/video/transcribe";
import { CLONE_MAX_AUDIO_SECONDS } from "@/lib/video-clone/config";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { audio_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const audioKey = typeof body.audio_key === "string" ? body.audio_key.trim() : "";
  if (!audioKey.startsWith(`${auth.user_id}/video-clone/uploads/`)) {
    return badRequest("Áudio inválido.");
  }

  try {
    const t = await transcribeUploadedAudio(audioKey);
    if (t.durationSeconds <= 0) return badRequest("Não conseguimos ler a duração desse áudio.");
    if (t.durationSeconds > CLONE_MAX_AUDIO_SECONDS + 0.5) {
      return badRequest(
        `O áudio tem ${Math.round(t.durationSeconds)}s — o máximo é ${CLONE_MAX_AUDIO_SECONDS}s (1min30s).`,
      );
    }
    return jsonOk({ text: t.text, duration_seconds: t.durationSeconds });
  } catch {
    return serverError("Não conseguimos processar esse áudio. Tente novamente.");
  }
}
