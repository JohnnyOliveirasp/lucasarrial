/**
 * Finaliza/sincroniza o VÍDEO de uma imagem do Gerador de Imagem com o Kie —
 * espelha video/video-sync.ts, mas grava em `image_generations` (colunas
 * video_*, migration 28). Baixa o mp4 do Kie e guarda no R2 (permanente),
 * servido via presigned GET. Usado pelo poll (GET /images/[id]) e pelo
 * webhook. Server-only.
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

/** Key permanente do vídeo animado da imagem no R2. */
export function imageVideoKey(userId: string, imageId: string, ext: string): string {
  return `${userId}/images/${imageId}/video.${ext}`;
}

/** Baixa o resultado (Kie), sobe pro R2 e marca o vídeo como ready. Lança em erro. */
export async function finalizeImageVideo(
  imageId: string,
  userId: string,
  resultUrl: string,
): Promise<void> {
  const res = await fetch(resultUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`download result ${res.status}`);

  const contentType = res.headers.get("content-type");
  const ext = pickExt(resultUrl, contentType);
  const bytes = Buffer.from(await res.arrayBuffer());
  const key = imageVideoKey(userId, imageId, ext);

  await r2.send(
    new PutObjectCommand({
      Bucket: imagesBucket(),
      Key: key,
      Body: bytes,
      ContentType: contentTypeFor(ext),
    }),
  );

  await getAdmin()
    .from("image_generations")
    .update({ video_status: "ready", video_path: key, video_error: null })
    .eq("id", imageId);
}

/** Marca o vídeo da imagem como falha. */
export async function failImageVideo(imageId: string, message: string): Promise<void> {
  await getAdmin()
    .from("image_generations")
    .update({ video_status: "failed", video_error: message.slice(0, 500) })
    .eq("id", imageId);
}

/** Consulta o Kie e atualiza o vídeo da imagem (poll/webhook). */
export async function syncImageVideo(
  imageId: string,
  userId: string,
  taskId: string,
): Promise<void> {
  const info = await kieGetTask(taskId);

  if (info.state === "success") {
    const url = info.resultUrls[0];
    if (!url) {
      await failImageVideo(imageId, "Kie retornou sucesso sem vídeo");
      return;
    }
    try {
      await finalizeImageVideo(imageId, userId, url);
    } catch (e) {
      await failImageVideo(
        imageId,
        e instanceof Error ? `salvar resultado: ${e.message}` : "salvar resultado falhou",
      );
    }
    return;
  }

  if (info.state === "fail") {
    await failImageVideo(imageId, friendlyKieError(info.failMsg || info.failCode || "geração falhou"));
    return;
  }

  if (info.state === "generating") {
    await getAdmin()
      .from("image_generations")
      .update({ video_status: "generating" })
      .eq("id", imageId)
      .in("video_status", ["pending"]);
  }
}
