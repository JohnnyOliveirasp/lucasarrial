/**
 * POST /api/v1/video-clone/import-take
 *   { take_key } → { audio_key, duration_seconds, text }
 *
 * Ponte do wizard Vídeo Edição (W3): o take gravado na estação de Áudio mora
 * no bucket VOICES (`${uid}/recorder-test/...`), mas o POST /video-clone só
 * aceita áudio do bucket GENERATIONS com prefixo `${uid}/video-clone/uploads/`
 * (presigned e Whisper apontam pra lá, hardcoded). Em vez de flexibilizar a
 * API do clone, copiamos o take pro lugar que ela espera — mesmo padrão do
 * images/import (único CopyObject do repo). O take já é MP3 normalizado
 * (loudnorm no upload do recorder-test), então é diretamente consumível.
 */
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { transcribeUploadedAudio } from "@/lib/video/transcribe";
import { CLONE_MAX_AUDIO_SECONDS } from "@/lib/video-clone/config";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { take_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const takeKey = typeof body.take_key === "string" ? body.take_key.trim() : "";
  // Ownership por prefixo — mesmo contrato do heygen/videos com take.
  if (!takeKey.startsWith(`${auth.user_id}/recorder-test/`) || takeKey.includes("..")) {
    return badRequest("Gravação inválida.");
  }

  const destKey = `${auth.user_id}/video-clone/uploads/${randomUUID()}.mp3`;
  try {
    await r2.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKETS.generations,
        // CopySource = "bucket/chave" com a chave URL-encodada.
        CopySource: `${R2_BUCKETS.voices}/${encodeURIComponent(takeKey)}`,
        Key: destKey,
      }),
    );
  } catch (e) {
    console.error("[video-clone/import-take] copy falhou:", e instanceof Error ? e.message : e);
    return serverError("Não consegui preparar essa gravação. Tente novamente.");
  }

  try {
    const t = await transcribeUploadedAudio(destKey);
    if (t.durationSeconds <= 0) return badRequest("Não conseguimos ler a duração dessa gravação.");
    if (t.durationSeconds > CLONE_MAX_AUDIO_SECONDS + 0.5) {
      return badRequest(
        `A gravação tem ${Math.round(t.durationSeconds)}s — o máximo é ${CLONE_MAX_AUDIO_SECONDS}s (1min30s).`,
      );
    }
    return jsonOk({ audio_key: destKey, duration_seconds: t.durationSeconds, text: t.text });
  } catch {
    return serverError("Não conseguimos processar essa gravação. Tente novamente.");
  }
}
