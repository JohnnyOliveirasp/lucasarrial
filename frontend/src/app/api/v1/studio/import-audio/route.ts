/**
 * POST /api/v1/studio/import-audio
 *   { generation_id | take_key } → { audio_key }
 *
 * Ponte do wizard Vídeo Edição (W4): o Estúdio só aceita áudio com prefixo
 * `${uid}/studio/uploads/` (bucket generations). O áudio da estação 2 mora
 * em outro lugar — geração TTS (generations.audio_path) ou take gravado
 * (bucket voices, `${uid}/recorder-test/...`). Copiamos pro lugar que o
 * POST /studio espera — mesmo padrão do video-clone/import-take (W3).
 */
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { generation_id?: unknown; take_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const genId = typeof body.generation_id === "string" ? body.generation_id.trim() : "";
  const takeKey = typeof body.take_key === "string" ? body.take_key.trim() : "";

  // Origem → (bucket, key). Ownership sempre validada.
  let sourceBucket: string;
  let sourceKey: string;
  if (takeKey) {
    if (!takeKey.startsWith(`${auth.user_id}/recorder-test/`) || takeKey.includes("..")) {
      return badRequest("Gravação inválida.");
    }
    sourceBucket = R2_BUCKETS.voices;
    sourceKey = takeKey;
  } else if (genId) {
    const { data } = await getAdmin()
      .from("generations")
      .select("audio_path, status, user_id")
      .eq("id", genId)
      .maybeSingle();
    const gen = data as { audio_path: string | null; status: string; user_id: string } | null;
    if (!gen || gen.user_id !== auth.user_id || gen.status !== "ready" || !gen.audio_path) {
      return badRequest("Áudio não encontrado (a geração precisa estar pronta).");
    }
    sourceBucket = R2_BUCKETS.generations;
    sourceKey = gen.audio_path;
  } else {
    return badRequest("Informe generation_id ou take_key.");
  }

  const ext = (sourceKey.split(".").pop() || "mp3").toLowerCase().slice(0, 5);
  const destKey = `${auth.user_id}/studio/uploads/${randomUUID()}.${ext}`;
  try {
    await r2.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKETS.generations,
        // CopySource = "bucket/chave" com a chave URL-encodada.
        CopySource: `${sourceBucket}/${encodeURIComponent(sourceKey)}`,
        Key: destKey,
      }),
    );
  } catch (e) {
    console.error("[studio/import-audio] copy falhou:", e instanceof Error ? e.message : e);
    return serverError("Não consegui preparar esse áudio. Tente novamente.");
  }

  return jsonOk({ audio_key: destKey });
}
