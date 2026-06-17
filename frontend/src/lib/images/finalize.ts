/**
 * Finaliza uma geração de imagem: baixa o resultado do Kie e guarda no R2
 * (permanente), depois marca a row como `ready`.
 *
 * Por que copiar pro R2 em vez de só guardar a URL do Kie: as URLs do Kie
 * expiram. Como a pessoa pode reusar a imagem depois (ex.: gerar vídeo),
 * guardamos o arquivo no nosso bucket e servimos via presigned GET. Server-only.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, imagesBucket } from "@/lib/r2/client";
import { buildImageResultKey } from "@/lib/r2/presigned";
import { getAdmin } from "@/lib/db/admin";

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

/**
 * Baixa `resultUrl` (Kie), sobe pro R2 e marca a geração como ready.
 * Lança em caso de falha — o chamador decide marcar como failed.
 */
export async function finalizeImageSuccess(
  id: string,
  userId: string,
  resultUrl: string,
): Promise<void> {
  const res = await fetch(resultUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`download result ${res.status}`);

  const contentType = res.headers.get("content-type");
  const ext = pickExt(resultUrl, contentType);
  const bytes = Buffer.from(await res.arrayBuffer());
  const key = buildImageResultKey(userId, id, ext);

  await r2.send(
    new PutObjectCommand({
      Bucket: imagesBucket(),
      Key: key,
      Body: bytes,
      ContentType: CONTENT_TYPE_BY_EXT[ext] ?? "image/png",
    }),
  );

  await getAdmin()
    .from("image_generations")
    .update({ status: "ready", image_path: key, error_message: null })
    .eq("id", id);
}

/** Marca a geração como falha com a mensagem dada. */
export async function failImageGeneration(id: string, message: string): Promise<void> {
  await getAdmin()
    .from("image_generations")
    .update({ status: "failed", error_message: message.slice(0, 500) })
    .eq("id", id);
}
