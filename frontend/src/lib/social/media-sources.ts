/**
 * Resolve a mídia de uma publicação a partir do CONTEÚDO da plataforma.
 * O client manda só {kind, id}; aqui validamos que o item é DO usuário e
 * derivamos bucket+path (vira "r2://…", assinado na hora de publicar).
 * Nunca aceitamos bucket/path crus do client — senão um aluno publicaria
 * arquivo de outro.
 */
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";

export type PublishSource = { kind: "image"; id: string };

export type ResolvedMedia = {
  mediaUrl: string; // r2://bucket/path
  mediaType: "image" | "reel" | "story";
  context: string | null; // pro "✨ Gerar legenda"
};

export async function resolvePublishSource(
  userId: string,
  source: PublishSource,
): Promise<ResolvedMedia | { error: string }> {
  if (source.kind === "image") {
    const { data } = await getAdmin()
      .from("image_generations")
      .select("id, image_path, status, prompt")
      .eq("id", source.id)
      .eq("user_id", userId)
      .maybeSingle();
    const row = data as { image_path: string | null; status: string; prompt: string | null } | null;
    if (!row || row.status !== "ready" || !row.image_path) {
      return { error: "Imagem não encontrada ou ainda não está pronta" };
    }
    return {
      mediaUrl: `r2://${imagesBucket()}/${row.image_path}`,
      mediaType: "image",
      context: row.prompt,
    };
  }
  return { error: "Tipo de conteúdo não suportado ainda" };
}
