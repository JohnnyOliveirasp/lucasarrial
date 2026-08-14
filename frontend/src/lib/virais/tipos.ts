/**
 * "Vídeos Virais" — parte 1: buscar virais por nicho e por likes.
 *
 * Um provedor por plataforma, todos falando o MESMO formato normalizado, pra
 * tela e as etapas seguintes (análise → roteiro reaction → clone) nunca
 * precisarem saber de onde o vídeo veio.
 *
 * Decisão 14/08 (medida, não suposta): a busca pública das duas redes exige
 * sessão. Instagram funciona pelo endpoint web interno com cookie de sessão;
 * o TikTok caiu (TikTok-Api e yt-dlp:tag devolvem vazio de IP sem login).
 * Por isso todo provedor pode se declarar INDISPONÍVEL com um motivo legível,
 * e a tela mostra o motivo em vez de fingir que não há resultado.
 */

export type Plataforma = "instagram" | "tiktok";

/** Um vídeo já normalizado, independente da plataforma de origem. */
export type VideoViral = {
  plataforma: Plataforma;
  video_id: string;
  url: string;
  autor: string;
  legenda: string;
  likes: number;
  views: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  /** ISO 8601 (UTC). */
  publicado_em: string | null;
  duracao_seg: number | null;
  thumb: string | null;
  /** Ordenação: engajamento amortecido pela idade (ver `score`). */
  score: number;
};

export type BuscaParams = {
  /** Nicho como o usuário digita ("handyman", "marcenaria"). */
  nicho: string;
  minLikes: number;
  /** Janela de recência; sem isso vem viral velho acumulado. */
  dias: number;
  /** Teto de itens devolvidos por plataforma. */
  limite: number;
};

export type ResultadoPlataforma = {
  plataforma: Plataforma;
  videos: VideoViral[];
  /** Quantos vieram antes dos filtros — mostra se o filtro é que zerou. */
  varridos: number;
  /** Preenchido quando a plataforma não pôde responder. */
  indisponivel?: string;
};

export type Provedor = {
  plataforma: Plataforma;
  buscar(params: BuscaParams): Promise<ResultadoPlataforma>;
};

/**
 * Score de viralidade: engajamento em escala log, com peso maior pro que
 * exige esforço do espectador (comentar/compartilhar > curtir), dividido pela
 * idade. Vídeo de ontem com 80k likes ganha de vídeo de 6 meses com 200k.
 * Fórmula do relatório de pesquisa (13/08), com views opcional.
 */
export function score(v: {
  likes: number;
  views?: number | null;
  comentarios?: number | null;
  compartilhamentos?: number | null;
  publicado_em?: string | null;
}): number {
  const l = Math.log1p(Math.max(0, v.likes));
  const vi = Math.log1p(Math.max(0, v.views ?? 0));
  const c = 1.5 * Math.log1p(Math.max(0, v.comentarios ?? 0));
  const s = 2 * Math.log1p(Math.max(0, v.compartilhamentos ?? 0));
  const bruto = l + vi + c + s;
  const idadeH = idadeEmHoras(v.publicado_em);
  if (idadeH === null) return bruto;
  return bruto / Math.pow(1 + idadeH, 0.35);
}

function idadeEmHoras(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

/** Aplica os filtros do usuário e ordena pelo score. */
export function filtrarEOrdenar(videos: VideoViral[], params: BuscaParams): VideoViral[] {
  const corte = params.dias > 0 ? Date.now() - params.dias * 86_400_000 : null;
  return videos
    .filter((v) => v.likes >= params.minLikes)
    .filter((v) => {
      if (!corte) return true;
      if (!v.publicado_em) return true; // sem data: não descarta, só não ganha bônus
      const t = Date.parse(v.publicado_em);
      return Number.isNaN(t) ? true : t >= corte;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limite);
}
