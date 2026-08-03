/**
 * 🧪 Lab · Gravador pelo Celular — lista dos takes da sessão (poll do desktop
 * e conferência no celular). Auth = mesmo token stateless da sessão.
 */
import type { NextRequest } from "next/server";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { verifyRecorderToken } from "@/lib/recorder-test/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-recorder-token") ?? "";
  const userId = verifyRecorderToken(token);
  if (!userId) return jsonError("unauthorized", "Sessão expirada — gere um novo link no computador.", 401);

  try {
    // TODOS os takes do usuário (qualquer sessão) — "precisa aparecer lá",
    // ponto (Johnny 03/08). A sessão só organiza a PASTA do upload.
    const out = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKETS.voices,
      Prefix: `${userId}/recorder-test/`,
      MaxKeys: 200,
    }));
    const objects = (out.Contents ?? []).sort(
      (a, b) => (a.LastModified?.getTime() ?? 0) - (b.LastModified?.getTime() ?? 0),
    );
    const takes = await Promise.all(objects.map(async (o) => ({
      key: o.Key!,
      name: o.Key!.split("/").pop()!,
      size: o.Size ?? 0,
      at: o.LastModified?.toISOString() ?? null,
      url: await createPresignedGet(R2_BUCKETS.voices, o.Key!, 3600),
    })));
    return jsonOk({ takes });
  } catch {
    return serverError("Falha ao listar os takes.");
  }
}

/** DELETE ?key= — apaga UM take (só dentro da pasta recorder-test do dono). */
export async function DELETE(request: NextRequest) {
  const token = request.headers.get("x-recorder-token") ?? "";
  const userId = verifyRecorderToken(token);
  if (!userId) return jsonError("unauthorized", "Sessão expirada — gere um novo link no computador.", 401);

  const key = new URL(request.url).searchParams.get("key") ?? "";
  // Autorização: a chave TEM que morar na pasta de teste do próprio usuário.
  if (!key.startsWith(`${userId}/recorder-test/`) || key.includes("..")) {
    return badRequest("Chave inválida.");
  }
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKETS.voices, Key: key }));
  } catch {
    return serverError("Falha ao apagar o take.");
  }
  return jsonOk({ deleted: key });
}
