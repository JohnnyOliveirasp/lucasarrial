/**
 * GET /api/v1/heygen/videos/[id] — poll do vídeo Avatar IV (BYOK).
 *
 * processing → consulta o status no HeyGen com a key do aluno; quando
 * completa, BAIXA o mp4 (URL deles expira) e guarda no NOSSO R2 → ready.
 * ready → devolve URL presignada de reprodução. Transição idempotente
 * (claim por status) pra aguentar poll concorrente de duas abas.
 */
import type { NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { authenticate } from "@/lib/api/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { decryptApiKey } from "@/lib/heygen/crypto";
import { getVideoStatus, friendlyHeygenError, HeygenError } from "@/lib/heygen/client";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import type { HeygenAccountRow, HeygenVideoRow } from "@/lib/db/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await params;

  const admin = getAdmin();
  const { data } = await admin
    .from("heygen_videos")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  const row = data as HeygenVideoRow | null;
  if (!row) return jsonError("not_found", "Vídeo não encontrado", 404);

  if (row.status === "processing" && row.heygen_video_id) {
    const { data: accData } = await admin
      .from("heygen_accounts")
      .select("api_key_encrypted, status")
      .eq("user_id", auth.user_id)
      .maybeSingle();
    const acc = accData as Pick<HeygenAccountRow, "api_key_encrypted" | "status"> | null;
    if (acc?.status === "active") {
      try {
        const apiKey = decryptApiKey(acc.api_key_encrypted);
        const st = await getVideoStatus(apiKey, row.heygen_video_id);
        if (st.status === "completed" && st.video_url) {
          // claim: só quem sair de processing copia pro R2 (poll concorrente)
          const { data: claimed } = await admin
            .from("heygen_videos")
            .update({ status: "ready", updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("status", "processing")
            .select("id");
          if ((claimed ?? []).length > 0) {
            const res = await fetch(st.video_url, { cache: "no-store" });
            if (res.ok) {
              const key = `${auth.user_id}/heygen/${id}.mp4`;
              await r2.send(
                new PutObjectCommand({
                  Bucket: R2_BUCKETS.generations,
                  Key: key,
                  Body: Buffer.from(await res.arrayBuffer()),
                  ContentType: "video/mp4",
                }),
              );
              await admin
                .from("heygen_videos")
                .update({ video_path: key, updated_at: new Date().toISOString() })
                .eq("id", id);
              row.video_path = key;
            } else {
              await admin
                .from("heygen_videos")
                .update({ status: "failed", error_message: "download do vídeo falhou" })
                .eq("id", id);
              row.status = "failed";
            }
          }
          row.status = row.status === "failed" ? "failed" : "ready";
        } else if (st.status === "failed") {
          await admin
            .from("heygen_videos")
            .update({
              status: "failed",
              error_message: st.error ?? "geração falhou no HeyGen",
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("status", "processing");
          row.status = "failed";
          row.error_message = st.error ?? "geração falhou no HeyGen";
        }
      } catch (e) {
        // key inválida no meio do caminho → orienta reconectar, sem matar o job
        if (e instanceof HeygenError && (e.status === 401 || e.status === 403)) {
          return jsonError("heygen_auth", friendlyHeygenError(e), 400);
        }
        // erro transitório de rede: mantém processing; o próximo poll tenta de novo
      }
    }
  }

  const playUrl =
    row.status === "ready" && row.video_path
      ? await createPresignedGet(R2_BUCKETS.generations, row.video_path, 3600)
      : null;
  return jsonOk({
    id: row.id,
    status: row.status,
    title: row.title,
    error_message: row.error_message,
    video_url: playUrl,
    created_at: row.created_at,
  });
}
