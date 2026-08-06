/**
 * Resolve a mídia de uma publicação a partir do CONTEÚDO da plataforma.
 * O client manda só {kind, id}; aqui validamos que o item é DO usuário e
 * derivamos bucket+path (vira "r2://…", assinado na hora de publicar).
 * Nunca aceitamos bucket/path crus do client — senão um aluno publicaria
 * arquivo de outro.
 */
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";

export type PublishSource =
  | { kind: "image"; id: string }
  | { kind: "upload"; key: string; media_type?: "image" | "reel" | "story" };

export type ResolvedMedia = {
  mediaUrl: string; // r2://bucket/path
  mediaType: "image" | "reel" | "story";
  context: string | null; // pro "✨ Gerar legenda"
};

export async function resolvePublishSource(
  userId: string,
  source: PublishSource,
): Promise<ResolvedMedia | { error: string }> {
  // Upload do computador (social-uploads/): a POSSE está no prefixo da chave —
  // só aceitamos chave dentro da pasta do próprio usuário.
  if (source.kind === "upload") {
    const key = (source.key ?? "").trim();
    if (!key.startsWith(`${userId}/social-uploads/`) || key.includes("..")) {
      return { error: "Arquivo enviado inválido" };
    }
    return {
      mediaUrl: `r2://${imagesBucket()}/${key}`,
      mediaType: source.media_type ?? (key.toLowerCase().endsWith(".mp4") ? "reel" : "image"),
      context: null,
    };
  }
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
