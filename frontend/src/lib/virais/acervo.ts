/**
 * Acervo de vídeos virais no banco (tabela viral_videos, migração 72).
 * Import idempotente: rodar a mesma busca duas vezes não duplica card.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { ViralImportado } from "./apify";
import { contagemUso, estadosPessoais, idsDescartados, idsReservados } from "./pessoal";

type Admin = SupabaseClient<Database>;

/** Como a grade ordena. "score" = engajamento amortecido pela idade. */
export type OrdemAcervo = "score" | "likes" | "views" | "recentes";

const COLUNA_ORDEM: Record<OrdemAcervo, string> = {
  score: "score",
  likes: "likes",
  views: "views",
  recentes: "publicado_em",
};

export type FiltroAcervo = {
  minLikes: number;
  dias: number;
  termo: string;
  /** Termo que trouxe o vídeo — é o "tema" das fichas da tela. */
  tema: string;
  ordem: OrdemAcervo;
  /** Só o que EU reservei = a tela "Meus Virais" (mig 75). */
  apenasReservados: boolean;
  limite: number;
};

export const FILTRO_PADRAO: FiltroAcervo = {
  minLikes: 0,
  dias: 0,
  termo: "",
  tema: "",
  ordem: "score",
  apenasReservados: false,
  limite: 120,
};

export function normalizarOrdem(v: string | null): OrdemAcervo {
  return v === "likes" || v === "views" || v === "recentes" ? v : "score";
}

/**
 * Grava os vídeos de uma execução. Conflito em (plataforma, video_id) =
 * atualiza as métricas, mas NUNCA mexe na seleção, no download nem no
 * descarte — senão reimportar apagaria a curadoria e traria de volta o que
 * o usuário já jogou fora. O upsert só escreve as colunas que estão no
 * payload; `selecionado`, `download_status` e `descartado` ficam de fora
 * de propósito.
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

/**
 * A lista da tela: mais quentes primeiro (ou como o usuário pedir).
 *
 * A partir da migração 75 o catálogo é COMUM e a curadoria é PESSOAL: o que
 * ESTE usuário descartou some só da grade dele, e `selecionado` da linha
 * (legado global) deu lugar a `reservado` por pessoa.
 *
 * `apenasReservados` = a tela "Meus Virais".
 */
export async function listarAcervo(admin: Admin, f: FiltroAcervo, userId: string) {
  // Descarte pessoal primeiro: sem isso o que a pessoa jogou fora voltaria.
  const [descartados, reservados] = await Promise.all([
    idsDescartados(admin, userId),
    f.apenasReservados ? idsReservados(admin, userId) : Promise.resolve<string[]>([]),
  ]);
  if (f.apenasReservados && reservados.length === 0) return [];

  let q = admin
    .from("viral_videos")
    .select(
      "id, plataforma, video_id, url, autor, autor_seguidores, legenda, likes, views, comentarios, publicado_em, duracao_seg, thumb_url, video_url, hashtags, score, termo_busca, exclusivo_ate, garimpado_por",
    )
    // descarte GLOBAL legado (mig 73) — mantido pra não ressuscitar o que já
    // tinha sido jogado fora antes da curadoria virar pessoal.
    .eq("descartado", false)
    // nullsFirst: false senão o vídeo sem data/views sobe no topo da grade.
    .order(COLUNA_ORDEM[f.ordem], { ascending: false, nullsFirst: false })
    .limit(Math.min(300, Math.max(1, f.limite)));

  if (f.apenasReservados) q = q.in("id", reservados);
  if (descartados.length > 0) q = q.not("id", "in", `(${descartados.join(",")})`);
  if (f.minLikes > 0) q = q.gte("likes", f.minLikes);
  if (f.dias > 0) {
    q = q.gte("publicado_em", new Date(Date.now() - f.dias * 86_400_000).toISOString());
  }
  if (f.tema) q = q.eq("termo_busca", f.tema);
  if (f.termo) {
    const t = f.termo.replace(/[%,]/g, " ").trim();
    if (t) q = q.or(`legenda.ilike.%${t}%,autor.ilike.%${t}%,termo_busca.ilike.%${t}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const linhas = data ?? [];

  // Pinta a grade: o que é meu e quantos já usaram cada vídeo.
  const ids = linhas.map((v) => (v as { id: string }).id);
  const [meus, uso] = await Promise.all([
    estadosPessoais(admin, userId, ids),
    contagemUso(admin, ids),
  ]);
  const agora = Date.now();
  return linhas.map((v) => {
    const l = v as Record<string, unknown> & { id: string; exclusivo_ate: string | null; garimpado_por: string | null };
    const meu = meus.get(l.id);
    return {
      ...l,
      reservado: meu?.reservado ?? false,
      usado: meu?.usado ?? false,
      download_status: meu?.download_status ?? "nao_baixado",
      r2_key: meu?.r2_key ?? null,
      usando: uso.get(l.id) ?? 0,
      /** Garimpo de outra pessoa ainda no prazo de 7 dias (mig 75). */
      exclusivo_de_outro:
        Boolean(l.exclusivo_ate) &&
        new Date(l.exclusivo_ate as string).getTime() > agora &&
        l.garimpado_por !== userId,
    };
  });
}

export type TemaAcervo = { tema: string; total: number; marcados: number };

/**
 * Fichas de tema da tela (migração 74). Agrupa no Postgres — contar no Node
 * exigiria puxar o acervo inteiro pra memória.
 */
export async function listarTemas(admin: Admin): Promise<TemaAcervo[]> {
  const { data, error } = await admin.rpc("virais_temas" as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as TemaAcervo[];
}

/**
 * Faxina do acervo. Uma busca pode trazer 1.000 vídeos e a maioria é lixo —
 * depois de marcar o que presta, isso limpa o resto (pedido do Johnny 14/08).
 *
 * REGRA DURA: o que está MARCADO nunca é apagado, em nenhum escopo. É a
 * curadoria dele; perder isso seria pior do que não ter a faxina.
 */
/**
 * DESCARTE LÓGICO, não DELETE (correção 14/08 — o Johnny perguntou o óbvio:
 * "se eu repetir a busca, ele traz o mesmo vídeo de novo?"). Sim, trazia:
 * apagar de verdade não deixava memória. Agora o vídeo some da tela e o
 * import — que faz upsert só das colunas que envia, e não envia `descartado`
 * — reimporta as métricas sem ressuscitar o card.
 */
export async function apagarPorIds(admin: Admin, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { error, count } = await admin
    .from("viral_videos")
    .update({ descartado: true, descartado_em: new Date().toISOString() } as never, {
      count: "exact",
    })
    .in("id", ids.slice(0, 500))
    .eq("descartado", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function limparAcervo(
  admin: Admin,
  escopo: "nao_marcados" | "termo",
  termo: string | null,
): Promise<number> {
  let q = admin
    .from("viral_videos")
    .update({ descartado: true, descartado_em: new Date().toISOString() } as never, {
      count: "exact",
    })
    .eq("selecionado", false)
    .eq("descartado", false);
  if (escopo === "termo") {
    if (!termo) return 0;
    q = q.eq("termo_busca", termo);
  }
  const { error, count } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
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
