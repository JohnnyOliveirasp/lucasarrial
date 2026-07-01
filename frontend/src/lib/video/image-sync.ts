/**
 * Finaliza/sincroniza a IMAGEM de uma cena de vídeo com o Kie — espelha
 * lib/images/finalize + sync, mas grava em `video_scenes` (colunas image_*).
 *
 * Baixa o resultado do Kie e guarda no R2 (permanente; a imagem vira insumo do
 * vídeo depois), servida via presigned GET. Usado pelo poll (GET .../images) e
 * pelo webhook do Kie. Server-only.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, imagesBucket } from "@/lib/r2/client";
import { getAdmin } from "@/lib/db/admin";
import { kieGetTask } from "@/lib/kie/client";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function pickExt(url: string, contentType: string | null): string {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  const m = url.split("?")[0].match(/\.([a-z0-9]+)$/i);
  const ext = m?.[1]?.toLowerCase();
  return ext && CONTENT_TYPE_BY_EXT[ext] ? ext : "png";
}

/** Key permanente da imagem da cena no R2. */
export function sceneImageKey(userId: string, projectId: string, sceneId: string, ext: string): string {
  return `${userId}/videos/${projectId}/scenes/${sceneId}/image.${ext}`;
}

/** Baixa o resultado (Kie), sobe pro R2 e marca a cena como ready. Lança em erro. */
export async function finalizeSceneImage(
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
  const key = sceneImageKey(userId, projectId, sceneId, ext);

  await r2.send(
    new PutObjectCommand({
      Bucket: imagesBucket(),
      Key: key,
      Body: bytes,
      ContentType: CONTENT_TYPE_BY_EXT[ext] ?? "image/png",
    }),
  );

  await getAdmin()
    .from("video_scenes")
    .update({ image_status: "ready", image_path: key, image_error: null })
    .eq("id", sceneId);
}

/** Marca a imagem da cena como falha. */
export async function failSceneImage(sceneId: string, message: string): Promise<void> {
  await getAdmin()
    .from("video_scenes")
    .update({ image_status: "failed", image_error: message.slice(0, 500) })
    .eq("id", sceneId);
}

/** Consulta o Kie e atualiza a imagem da cena (poll/webhook). */
export async function syncSceneImage(
  sceneId: string,
  userId: string,
  projectId: string,
  taskId: string,
): Promise<void> {
  const info = await kieGetTask(taskId);

  if (info.state === "success") {
    const url = info.resultUrls[0];
    if (!url) {
      await failSceneImage(sceneId, "Kie retornou sucesso sem imagem");
      return;
    }
    try {
      await finalizeSceneImage(sceneId, userId, projectId, url);
    } catch (e) {
      await failSceneImage(
        sceneId,
        e instanceof Error ? `salvar resultado: ${e.message}` : "salvar resultado falhou",
      );
    }
    return;
  }

  if (info.state === "fail") {
    await failSceneImage(sceneId, info.failMsg || info.failCode || "geração falhou");
    return;
  }

  if (info.state === "generating") {
    await getAdmin()
      .from("video_scenes")
      .update({ image_status: "generating" })
      .eq("id", sceneId)
      .in("image_status", ["pending"]);
  }
}
