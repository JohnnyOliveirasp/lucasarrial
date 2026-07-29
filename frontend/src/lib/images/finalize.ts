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
import { handleTechFailure } from "@/lib/support/failure-alert";

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

/** Mensagem amigável pro Histórico do aluno (o erro cru vai pro suporte). */
function friendlyImageError(raw: string): string {
  const base = /fetch failed|internal error|timeout|try again|temporar/i.test(raw)
    ? "O gerador de imagens ficou sobrecarregado e esta geração falhou."
    : "Não foi possível gerar esta imagem.";
  return `${base} Os créditos cobrados foram devolvidos automaticamente. Tente de novo em alguns minutos.`;
}

/**
 * Marca a geração como falha + ESTORNO AUTOMÁTICO (caso 28/07: 24 falhas
 * cobradas sem devolução desde 01/07 — o TODO desta função finalmente pago).
 * Transição idempotente: só quem tira a row de pending/generating dispara a
 * contingência (não duplica na corrida webhook × poll).
 */
export async function failImageGeneration(id: string, message: string): Promise<void> {
  const { data: claimed } = await getAdmin()
    .from("image_generations")
    .update({ status: "failed", error_message: friendlyImageError(message).slice(0, 500) })
    .eq("id", id)
    .in("status", ["pending", "generating"])
    .select("id, user_id");
  const row = (claimed ?? [])[0] as { id: string; user_id: string } | undefined;
  if (!row) return; // já finalizada por outra via

  await handleTechFailure({
    feature: "Gerador de Imagem (Kie)",
    userId: row.user_id,
    refId: id,
    rawError: message,
    debitRefType: "image_generation",
    refundRefType: "image_refund",
  });
}
