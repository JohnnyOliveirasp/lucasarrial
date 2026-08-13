/**
 * 🚧 Vídeo Edição 2.0 — "Vídeos gerados" (bug Johnny 13/08: o vídeo de ontem
 * sumia — o wizard só guarda o rascunho ATUAL no localStorage).
 * GET → histórico dos vídeos MONTADOS do usuário, juntando 2 fontes que já
 * existem (sem tabela nova):
 *   a) vídeos EDITADOS do wizard no R2 (`{user}/edicao/{captions,broll}/…`);
 *   b) montagens prontas do Estúdio (studio_projects.montage_status='ready').
 * Tudo com URL presignada de 1h, mais novo primeiro.
 */
import type { NextRequest } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { r2, imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export const dynamic = "force-dynamic";

type VideoGerado = {
  /** "edicao" (editado no wizard, publica por key) ou "cenas" (montagem, por id). */
  tipo: "edicao" | "cenas";
  key: string | null;
  id: string | null;
  name: string;
  at: string | null;
  url: string;
};

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const bucket = imagesBucket();
  try {
    // a) editados do wizard (legenda e/ou b-roll) direto do R2
    const prefixos = [`${auth.user_id}/edicao/captions/`, `${auth.user_id}/edicao/broll/`];
    const listas = await Promise.all(
      prefixos.map((Prefix) =>
        r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix, MaxKeys: 60 })),
      ),
    );
    const editados: VideoGerado[] = await Promise.all(
      listas
        .flatMap((out) => out.Contents ?? [])
        .filter((o) => o.Key && o.Key.endsWith(".mp4"))
        .map(async (o) => ({
          tipo: "edicao" as const,
          key: o.Key!,
          id: null,
          name: o.Key!.includes("/captions/") ? "Vídeo com legenda" : "Vídeo com b-roll",
          at: o.LastModified?.toISOString() ?? null,
          url: await createPresignedGet(bucket, o.Key!, 3600),
        })),
    );

    // b) montagens prontas do Estúdio (caminho Cenas do wizard)
    const { data: rows, error } = await getAdmin()
      .from("studio_projects")
      .select("id, name, video_path, created_at")
      .eq("user_id", auth.user_id)
      .eq("montage_status", "ready")
      .not("video_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return serverError("Falha ao listar as montagens.");
    const montagens: VideoGerado[] = await Promise.all(
      (rows ?? []).map(async (p) => ({
        tipo: "cenas" as const,
        key: null,
        id: p.id as string,
        name: (p.name as string | null) || "Montagem de cenas",
        at: (p.created_at as string | null) ?? null,
        url: await createPresignedGet(bucket, p.video_path as string, 3600),
      })),
    );

    const videos = [...editados, ...montagens].sort(
      (a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime(),
    );
    return jsonOk({ videos });
  } catch {
    return serverError("Falha ao listar os vídeos gerados.");
  }
}
