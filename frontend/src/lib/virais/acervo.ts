/**
 * Acervo de vídeos virais no banco (tabela viral_videos, migração 72).
 * Import idempotente: rodar a mesma busca duas vezes não duplica card.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { ViralImportado } from "./apify";

type Admin = SupabaseClient<Database>;

export type FiltroAcervo = {
  minLikes: number;
  dias: number;
  termo: string;
  apenasSelecionados: boolean;
  limite: number;
};

export const FILTRO_PADRAO: FiltroAcervo = {
  minLikes: 0,
  dias: 0,
  termo: "",
  apenasSelecionados: false,
  limite: 60,
};

/**
 * Grava os vídeos de uma execução. Conflito em (plataforma, video_id) =
 * atualiza as métricas, mas NUNCA mexe na seleção nem no download — senão
 * reimportar apagaria a curadoria já feita.
 */
export async function importarVideos(
  admin: Admin,
  videos: ViralImportado[],
  ctx: { termo: string | null; runId: string | null },
): Promise<{ gravados: number; erro: string | null }> {
  if (videos.length === 0) return { gravados: 0, erro: null };
  const linhas = videos.map((v) => ({
    ...v,
    termo_busca: ctx.termo,
    origem_run_id: ctx.runId,
  }));
  const { error, count } = await admin
    .from("viral_videos")
    .upsert(linhas as never, {
      onConflict: "plataforma,video_id",
      ignoreDuplicates: false,
      count: "exact",
    });
  if (error) return { gravados: 0, erro: error.message };
  return { gravados: count ?? linhas.length, erro: null };
}

/** A lista da tela: mais quentes primeiro. */
export async function listarAcervo(admin: Admin, f: FiltroAcervo) {
  let q = admin
    .from("viral_videos")
    .select(
      "id, plataforma, video_id, url, autor, autor_seguidores, legenda, likes, views, comentarios, publicado_em, duracao_seg, thumb_url, video_url, hashtags, score, termo_busca, selecionado, download_status, r2_key",
    )
    .order("score", { ascending: false })
    .limit(Math.min(200, Math.max(1, f.limite)));

  if (f.minLikes > 0) q = q.gte("likes", f.minLikes);
  if (f.dias > 0) {
    q = q.gte("publicado_em", new Date(Date.now() - f.dias * 86_400_000).toISOString());
  }
  if (f.termo) {
    const t = f.termo.replace(/[%,]/g, " ").trim();
    if (t) q = q.or(`legenda.ilike.%${t}%,autor.ilike.%${t}%,termo_busca.ilike.%${t}%`);
  }
  if (f.apenasSelecionados) q = q.eq("selecionado", true);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Marca/desmarca "quero baixar este" — é o que segura o R2 de virar lixão. */
export async function marcarSelecao(
  admin: Admin,
  id: string,
  selecionado: boolean,
  userId: string,
) {
  const { error } = await admin
    .from("viral_videos")
    .update({
      selecionado,
      selecionado_por: selecionado ? userId : null,
      selecionado_em: selecionado ? new Date().toISOString() : null,
    } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
