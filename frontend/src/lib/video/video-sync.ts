/**
 * Finaliza/sincroniza o CLIPE de vídeo de uma cena com o Kie — espelha
 * image-sync, mas grava em `video_scenes` (colunas video_*). Baixa o mp4 do Kie
 * e guarda no R2 (permanente; vira insumo da montagem final), servido via
 * presigned GET. Usado pelo poll (GET .../videos) e pelo webhook. Server-only.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, imagesBucket } from "@/lib/r2/client";
import { getAdmin } from "@/lib/db/admin";
import { kieGetTask, friendlyKieError } from "@/lib/kie/client";

function pickExt(url: string, contentType: string | null): string {
  if (contentType?.includes("webm")) return "webm";
  if (contentType?.includes("quicktime") || contentType?.includes("mov")) return "mov";
  const m = url.split("?")[0].match(/\.([a-z0-9]+)$/i);
  const ext = m?.[1]?.toLowerCase();
  if (ext && ["mp4", "webm", "mov"].includes(ext)) return ext;
  return "mp4";
}

function contentTypeFor(ext: string): string {
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "video/mp4";
}

/** Key permanente do clipe da cena no R2. */
export function sceneVideoKey(userId: string, projectId: string, sceneId: string, ext: string): string {
  return `${userId}/videos/${projectId}/scenes/${sceneId}/clip.${ext}`;
}

/** Baixa o resultado (Kie), sobe pro R2 e marca a cena como ready. Lança em erro. */
export async function finalizeSceneVideo(
  sceneId: string,
  userId: string,
  projectId: string,
  resultUrl: string,
): Promise<void> {
  const res = await fetch(resultUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`download result ${res.status}`);

  const contentType = res.headers.get("content-type");
  const ext = pickExt(resultUrl, contentType);
  const bytes = Buffer.from(await res.arrayBuffer());
  const key = sceneVideoKey(userId, projectId, sceneId, ext);

  await r2.send(
    new PutObjectCommand({
      Bucket: imagesBucket(),
      Key: key,
      Body: bytes,
      ContentType: contentTypeFor(ext),
    }),
  );

  await getAdmin()
    .from("video_scenes")
    .update({ video_status: "ready", video_path: key, video_error: null })
    .eq("id", sceneId);
}

/** Marca o vídeo da cena como falha. */
export async function failSceneVideo(sceneId: string, message: string): Promise<void> {
  await getAdmin()
    .from("video_scenes")
    .update({ video_status: "failed", video_error: message.slice(0, 500) })
    .eq("id", sceneId);
}

/** Consulta o Kie e atualiza o vídeo da cena (poll/webhook). */
export async function syncSceneVideo(
  sceneId: string,
  userId: string,
  projectId: string,
  taskId: string,
): Promise<void> {
  const info = await kieGetTask(taskId);

  if (info.state === "success") {
    const url = info.resultUrls[0];
    if (!url) {
      await failSceneVideo(sceneId, "Kie retornou sucesso sem vídeo");
      return;
    }
    try {
      await finalizeSceneVideo(sceneId, userId, projectId, url);
    } catch (e) {
      await failSceneVideo(
        sceneId,
        e instanceof Error ? `salvar resultado: ${e.message}` : "salvar resultado falhou",
      );
    }
    return;
  }

  if (info.state === "fail") {
    await failSceneVideo(sceneId, friendlyKieError(info.failMsg || info.failCode || "geração falhou"));
    return;
  }

  if (info.state === "generating") {
    await getAdmin()
      .from("video_scenes")
      .update({ video_status: "generating" })
      .eq("id", sceneId)
      .in("video_status", ["pending"]);
  }
}
