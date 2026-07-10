/**
 * GET /api/v1/studio/music — lista as trilhas disponíveis do Vídeo Estúdio.
 * Banco de músicas = objetos em R2 voices/studio-music/ (subir .mp3 licenciados
 * lá; o nome do arquivo vira o rótulo). O usuário escolhe a trilha na montagem
 * — ou "Sem música".
 */
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { isAdmin } from "@/lib/admin/guard";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);

  try {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKETS.voices,
        Prefix: "studio-music/",
        MaxKeys: 100,
      }),
    );
    const tracks = (res.Contents ?? [])
      .filter((o) => o.Key && /\.(mp3|m4a|wav)$/i.test(o.Key))
      .map((o) => ({
        key: o.Key as string,
        label: (o.Key as string)
          .replace(/^studio-music\//, "")
          .replace(/\.(mp3|m4a|wav)$/i, "")
          .replace(/[_-]+/g, " ")
          .trim(),
      }));
    return jsonOk({ tracks });
  } catch {
    return serverError("Failed to list music tracks");
  }
}
