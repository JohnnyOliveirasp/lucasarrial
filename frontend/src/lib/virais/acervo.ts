/**
 * Acervo de vídeos virais no banco (tabela viral_videos, migração 72).
 * Import idempotente: rodar a mesma busca duas vezes não duplica card.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { ViralImportado } from "./apify";
import { contagemUso, estadosPessoais, idsDescartados, idsReservados } from "./pessoal";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { guardarThumb } from "./thumb";

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
  /** Paginação (17/08): TODO o acervo é alcançável, página a página. */
  offset: number;
};

export const FILTRO_PADRAO: FiltroAcervo = {
  minLikes: 0,
  dias: 0,
  termo: "",
  tema: "",
  ordem: "score",
  apenasReservados: false,
  limite: 120,
  offset: 0,
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
  // A miniatura vira NOSSA já na entrada — é aqui que a `thumb_url` do TikTok
  // ainda está válida, e é a única janela barata pra copiar (depois ela vence
  // e só o oEmbed salva). Best-effort e em lotes: miniatura é enfeite, não
  // pode travar nem derrubar a importação da busca.
  // O que JÁ tem cópia continua valendo: sem isto, reimportar um vídeo cuja
  // cópia falhasse agora gravaria null por cima e perderíamos a miniatura boa
  // (o upsert escreve toda coluna que vai no payload).
  const jaCopiados = new Map<string, string>();
  const { data: existentes } = await admin
    .from("viral_videos")
    .select("plataforma, video_id, thumb_r2_key")
    .in("video_id", videos.map((v) => v.video_id))
    .not("thumb_r2_key", "is", null);
  for (const e of (existentes ?? []) as Array<{ plataforma: string; video_id: string; thumb_r2_key: string }>) {
    jaCopiados.set(`${e.plataforma}|${e.video_id}`, e.thumb_r2_key);
  }

  const capas = new Map<string, string>(jaCopiados);
  for (let i = 0; i < videos.length; i += 8) {
    await Promise.all(
      videos.slice(i, i + 8).map(async (v) => {
        if (jaCopiados.has(`${v.plataforma}|${v.video_id}`)) return; // já é nosso
        const key = await guardarThumb({
          plataforma: v.plataforma,
          videoId: v.video_id,
          urlDoVideo: v.url ?? null,
          thumbUrl: v.thumb_url ?? null,
        }).catch(() => null);
        if (key) capas.set(`${v.plataforma}|${v.video_id}`, key);
      }),
    );
  }
  const linhas = videos.map((v) => ({
    ...v,
    thumb_r2_key: capas.get(`${v.plataforma}|${v.video_id}`) ?? null,
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
  if (f.apenasReservados && reservados.length === 0) return { videos: [], total: 0 };

  // Paginação (17/08, regra do Johnny): NENHUM vídeo fica inalcançável — a
  // tela pagina. `count: exact` devolve o TOTAL do filtro junto da página,
  // numa consulta só (o range não afeta a contagem).
  const limite = Math.min(300, Math.max(1, f.limite));
  const offset = Math.max(0, f.offset ?? 0);
  let q = admin
    .from("viral_videos")
    .select(
      "id, plataforma, video_id, url, autor, autor_seguidores, legenda, likes, views, comentarios, publicado_em, duracao_seg, thumb_url, thumb_r2_key, video_url, hashtags, score, termo_busca, exclusivo_ate, garimpado_por",
      { count: "exact" },
    )
    // descarte GLOBAL legado (mig 73) — mantido pra não ressuscitar o que já
    // tinha sido jogado fora antes da curadoria virar pessoal.
    .eq("descartado", false)
    // nullsFirst: false senão o vídeo sem data/views sobe no topo da grade.
    .order(COLUNA_ORDEM[f.ordem], { ascending: false, nullsFirst: false })
    .range(offset, offset + limite - 1);

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

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const linhas = data ?? [];

  // Pinta a grade: o que é meu e quantos já usaram cada vídeo.
  const ids = linhas.map((v) => (v as { id: string }).id);
  const [meus, uso] = await Promise.all([
    estadosPessoais(admin, userId, ids),
    contagemUso(admin, ids),
  ]);
  const agora = Date.now();
  // A miniatura sai do NOSSO R2 sempre que existir cópia. A `thumb_url` do
  // TikTok é assinada e vence — servir ela direto é o que fazia a galeria ir
  // apagando sozinha (22/08). Quem ainda não foi copiado cai no endereço
  // antigo, que funciona até vencer.
  const capas = new Map<string, string>();
  await Promise.all(
    linhas.map(async (v) => {
      const l = v as { id: string; thumb_r2_key?: string | null };
      if (!l.thumb_r2_key) return;
      const url = await createPresignedGet(imagesBucket(), l.thumb_r2_key, 6 * 3600).catch(() => null);
      if (url) capas.set(l.id, url);
    }),
  );
  const videos = linhas.map((v) => {
    const l = v as Record<string, unknown> & { id: string; exclusivo_ate: string | null; garimpado_por: string | null };
    const meu = meus.get(l.id);
    return {
      ...l,
      thumb_url: capas.get(l.id) ?? (l.thumb_url as string | null) ?? null,
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
  return { videos, total: count ?? videos.length };
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
