/**
 * Resolve a mídia de uma publicação a partir do CONTEÚDO da plataforma.
 * O client manda só {kind, id}; aqui validamos que o item é DO usuário e
 * derivamos bucket+path (vira "r2://…", assinado na hora de publicar).
 * Nunca aceitamos bucket/path crus do client — senão um aluno publicaria
 * arquivo de outro.
 */
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";

export type PublishSource =
  | { kind: "image"; id: string }
  | { kind: "upload"; key: string; media_type?: "image" | "reel" | "story" }
  // W6 (wizard Vídeo Edição): vídeos prontos da plataforma, por id
  | { kind: "clone-padrao"; id: string }
  | { kind: "clone-heygen"; id: string }
  | { kind: "cenas"; id: string }
  // W6: vídeo EDITADO do wizard (legenda/b-roll) — key com posse no prefixo
  | { kind: "edicao"; key: string };

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
  // Vídeo editado no wizard (caption_burn/broll_overlay): a key é escolhida
  // pelo servidor nos POSTs da edição — aqui, como no upload, a POSSE está no
  // prefixo do próprio usuário.
  if (source.kind === "edicao") {
    const key = (source.key ?? "").trim();
    const dono =
      key.startsWith(`${userId}/edicao/captions/`) || key.startsWith(`${userId}/edicao/broll/`);
    if (!dono || key.includes("..")) return { error: "Vídeo editado inválido" };
    return { mediaUrl: `r2://${imagesBucket()}/${key}`, mediaType: "reel", context: null };
  }
  if (source.kind === "clone-padrao") {
    const { data } = await getAdmin()
      .from("video_clones")
      .select("id, video_path, status, name")
      .eq("id", source.id)
      .eq("user_id", userId)
      .maybeSingle();
    const row = data as { video_path: string | null; status: string; name: string | null } | null;
    if (!row || row.status !== "ready" || !row.video_path) {
      return { error: "Vídeo clone não encontrado ou ainda não está pronto" };
    }
    return { mediaUrl: `r2://${imagesBucket()}/${row.video_path}`, mediaType: "reel", context: row.name };
  }
  if (source.kind === "clone-heygen") {
    const { data } = await getAdmin()
      .from("heygen_videos")
      .select("id, video_path, status, title")
      .eq("id", source.id)
      .eq("user_id", userId)
      .maybeSingle();
    const row = data as { video_path: string | null; status: string; title: string | null } | null;
    if (!row || row.status !== "ready" || !row.video_path) {
      return { error: "Vídeo HeyGen não encontrado ou ainda não está pronto" };
    }
    return {
      mediaUrl: `r2://${R2_BUCKETS.generations}/${row.video_path}`,
      mediaType: "reel",
      context: row.title,
    };
  }
  if (source.kind === "cenas") {
    const { data } = await getAdmin()
      .from("studio_projects")
      .select("id, status, montage_status, video_path, edited_video_path, script_text")
      .eq("id", source.id)
      .eq("user_id", userId)
      .maybeSingle();
    const row = data as {
      status: string;
      montage_status: string | null;
      video_path: string | null;
      edited_video_path: string | null;
      script_text: string | null;
    } | null;
    if (!row) return { error: "Projeto do Estúdio não encontrado" };
    // Preferência: vídeo EDITADO (CapCut automático, bucket generations);
    // senão a montagem de cenas (bucket de imagens/vídeos).
    if (row.status === "video_ready" && row.edited_video_path) {
      return {
        mediaUrl: `r2://${R2_BUCKETS.generations}/${row.edited_video_path}`,
        mediaType: "reel",
        context: row.script_text,
      };
    }
    if (row.montage_status === "ready" && row.video_path) {
      return {
        mediaUrl: `r2://${imagesBucket()}/${row.video_path}`,
        mediaType: "reel",
        context: row.script_text,
      };
    }
    return { error: "O vídeo do projeto ainda não está pronto" };
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
