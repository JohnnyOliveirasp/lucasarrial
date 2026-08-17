/**
 * Cliente do Apify pro "Vídeos Virais".
 *
 * Decisão do Johnny (14/08): QUEM RODA A BUSCA É ELE, no console do Apify —
 * a plataforma não dispara execução (evita gastar crédito sem querer). Aqui
 * a gente só LÊ o que ele já rodou e importa pro acervo.
 *
 * Actor: apidojo/tiktok-scraper ("Pay Per Result", US$0,30/1k, 99,1% de
 * sucesso nos últimos 30 dias). O famoso clockworks foi descartado: 12x mais
 * caro e 7,7% de falha.
 */
import { score } from "./tipos";

/**
 * ⚠️ TROCA DE MOTOR 14/08, decidida por TESTE do Johnny (não por estatística).
 *
 * O `apidojo/tiktok-scraper` (5K30i8aFccKNF5ICs) é 12x mais barato e tem
 * melhor taxa de sucesso NA MÉDIA — mas na busca real dele
 * ("church translation, church interpreter, live translation church")
 * devolveu literalmente `{"noResults": true}` nos 3 termos. O
 * `clockworks/tiktok-scraper`, na MESMA busca, trouxe vídeos com legenda,
 * link, likes, views, data, autor e capa.
 *
 * Ou seja: o barato só é barato quando acha alguma coisa. Motor padrão passa
 * a ser o clockworks; o apidojo fica documentado como alternativa econômica
 * (US$0,30/1k contra US$3,70/1k no free tier) pra nichos onde ele responda.
 */
const ACTOR_ID = "GdWCkxBtKWOsKjdch"; // clockworks/tiktok-scraper
const ACTOR_ECONOMICO = "5K30i8aFccKNF5ICs"; // apidojo — vazio no nicho do Johnny
export const CUSTO_POR_VIDEO_USD = 0.0037; // clockworks, free tier
const API = "https://api.apify.com/v2";

export function apifyToken(): string {
  return (process.env.APIFY_TOKEN || process.env.API_Token || "").trim();
}

export type RunApify = {
  id: string;
  status: string;
  iniciado_em: string | null;
  terminado_em: string | null;
  dataset_id: string | null;
  itens: number | null;
};

type RunBruto = {
  id: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  defaultDatasetId?: string;
  stats?: { itemCount?: number };
};

async function pedir<T>(caminho: string): Promise<T> {
  const token = apifyToken();
  if (!token) throw new Error("sem_token");
  const resp = await fetch(`${API}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (resp.status === 401 || resp.status === 403) throw new Error("token_invalido");
  if (!resp.ok) throw new Error(`apify_http_${resp.status}`);
  return (await resp.json()) as T;
}

/** Períodos que o actor aceita (enum do schema dele). */
export const PERIODOS = [
  { id: "THIS_WEEK", rotulo: "Últimos 7 dias" },
  { id: "THIS_MONTH", rotulo: "Último mês" },
  { id: "LAST_THREE_MONTHS", rotulo: "Últimos 3 meses" },
  { id: "LAST_SIX_MONTHS", rotulo: "Últimos 6 meses" },
  { id: "ALL_TIME", rotulo: "Qualquer data" },
] as const;

export type Periodo = (typeof PERIODOS)[number]["id"];

/** Nosso período → o rótulo que o clockworks espera em videoSearchDateFilter. */
const JANELA: Record<string, string> = {
  THIS_WEEK: "this week",
  THIS_MONTH: "this month",
  LAST_THREE_MONTHS: "last 3 months",
  LAST_SIX_MONTHS: "last 6 months",
};

/**
 * Como buscar. O actor aceita palavra-chave (keywords) OU uma URL de
 * partida (perfil, hashtag, som, local, busca).
 * ⚠️ A ORDENAÇÃO por mais curtidos só vale na busca por PALAVRA — a doc do
 * actor é explícita: "Only works with keyword search — does not apply to
 * startUrls". Nos outros modos vem na ordem do TikTok e a gente reordena
 * pelo score aqui.
 */
/**
 * Os campos se SOMAM: dá pra buscar só por palavra, só por perfil, ou por
 * palavra + 3 perfis + 2 hashtags de uma vez. O actor aceita `keywords` e
 * `startUrls` na mesma execução.
 */
export type PedidoBusca = {
  /** Palavras/nichos. Ex.: ["handyman", "home repair"] */
  nichos: string[];
  /** @ dos perfis, com ou sem arroba. */
  perfis: string[];
  /** Hashtags, com ou sem #. */
  hashtags: string[];
  /** URLs do TikTok já prontas (perfil, tag, som, local, busca). */
  links: string[];
  periodo: Periodo;
  /** Teto de vídeos: é o que define o custo (US$0,30 por 1.000). */
  maxItems: number;
  /**
   * País de onde "olhar" o TikTok. ⚠️ IGNORADO desde 17/08 (provado em teste
   * A/B/C): `proxyCountryCode:"BR"` fazia o actor devolver ~12 resultados de
   * fome — foi a busca do Lucas. A palavra no idioma certo já puxa o conteúdo
   * do país sem proxy nenhum. Campo mantido no tipo só pra não quebrar
   * chamadas antigas; o builder NÃO o envia mais.
   */
  pais?: string;
};

/** "@fulano", "tiktok.com/@fulano" ou "fulano" → URL do perfil. */
export function urlDePerfil(entrada: string): string | null {
  const user = entrada
    .trim()
    .replace(/^https?:\/\/[^/]*\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
  return user ? `https://www.tiktok.com/@${encodeURIComponent(user)}` : null;
}

/** "#tag", "tiktok.com/tag/x" ou "tag" → URL da hashtag. */
export function urlDeHashtag(entrada: string): string | null {
  const tag = entrada
    .trim()
    .replace(/^https?:\/\/[^/]*\/tag\//i, "")
    .replace(/^#/, "")
    .split(/[/?#]/)[0];
  return tag ? `https://www.tiktok.com/tag/${encodeURIComponent(tag)}` : null;
}

/** Quebra o que a pessoa digitou (vírgula, ponto-e-vírgula ou linha). */
export function separarLista(texto: string): string[] {
  return texto
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Dispara a busca no Apify e devolve o id da execução. NÃO espera terminar:
 * uma busca de centenas de vídeos leva minutos e seguraria a requisição.
 * A tela pergunta o status depois e importa quando ficar pronto.
 */
export async function dispararBusca(p: PedidoBusca): Promise<RunApify> {
  const token = apifyToken();
  if (!token) throw new Error("sem_token");
  // Campos do clockworks: cada tipo tem o SEU campo (não é tudo startUrls).
  const input: Record<string, unknown> = {
    resultsPerPage: p.maxItems,
    excludePinnedPosts: true,
    shouldDownloadVideos: false, // nós baixamos só o que for marcado
    shouldDownloadCovers: false,
  };
  if (p.nichos.length > 0) {
    input.searchQueries = p.nichos;
    input.searchSection = "/video"; // só vídeo; sem isso mistura perfis
    // Ordenação e janela de data só valem na seção /video.
    input.videoSearchSorting = "Most liked";
    if (p.periodo !== "ALL_TIME") input.videoSearchDateFilter = JANELA[p.periodo];
  }
  if (p.hashtags.length > 0) {
    input.hashtags = p.hashtags.map((h) => h.trim().replace(/^#/, "")).filter(Boolean);
  }
  if (p.perfis.length > 0) {
    input.profiles = p.perfis.map((u) => u.trim().replace(/^@/, "")).filter(Boolean);
  }
  const urls = p.links
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\/(www\.)?tiktok\.com\//i.test(l));
  if (urls.length > 0) input.postURLs = urls;

  if (!input.searchQueries && !input.hashtags && !input.profiles && !input.postURLs) {
    throw new Error("nada_pra_buscar");
  }
  // proxyCountryCode NÃO vai mais (17/08): ver o comentário no tipo `pais`.

  const resp = await fetch(`${API}/acts/${ACTOR_ID}/runs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  if (resp.status === 401 || resp.status === 403) throw new Error("token_invalido");
  if (!resp.ok) throw new Error(`apify_http_${resp.status}`);
  const json = (await resp.json()) as { data?: RunBruto };
  const r = json.data;
  if (!r?.id) throw new Error("apify_sem_run");
  return {
    id: r.id,
    status: r.status,
    iniciado_em: r.startedAt ?? null,
    terminado_em: r.finishedAt ?? null,
    dataset_id: r.defaultDatasetId ?? null,
    itens: r.stats?.itemCount ?? null,
  };
}

/** Status de uma execução — a tela pergunta de tempos em tempos. */
export async function verRun(runId: string): Promise<RunApify> {
  const json = await pedir<{ data?: RunBruto }>(`/actor-runs/${runId}`);
  const r = json.data;
  if (!r?.id) throw new Error("apify_run_sumiu");
  return {
    id: r.id,
    status: r.status,
    iniciado_em: r.startedAt ?? null,
    terminado_em: r.finishedAt ?? null,
    dataset_id: r.defaultDatasetId ?? null,
    itens: r.stats?.itemCount ?? null,
  };
}

/** As últimas execuções do scraper — é a lista que a tela oferece pra importar. */
export async function listarRuns(limite = 10): Promise<RunApify[]> {
  const json = await pedir<{ data?: { items?: RunBruto[] } }>(
    `/acts/${ACTOR_ID}/runs?limit=${limite}&desc=true`,
  );
  return (json.data?.items ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    iniciado_em: r.startedAt ?? null,
    terminado_em: r.finishedAt ?? null,
    dataset_id: r.defaultDatasetId ?? null,
    itens: r.stats?.itemCount ?? null,
  }));
}

/**
 * Item do clockworks (formato provado no dataset real do Johnny 14/08).
 * Nomes BEM diferentes do apidojo — por isso o normalizador aceita os dois.
 */
type ItemClockworks = {
  id?: string;
  text?: string;
  webVideoUrl?: string;
  diggCount?: number;
  playCount?: number;
  commentCount?: number;
  shareCount?: number;
  collectCount?: number;
  createTimeISO?: string;
  createTime?: number;
  hashtags?: Array<string | { name?: string }>;
  mediaUrls?: string[];
  searchQuery?: string;
  authorMeta?: {
    name?: string;
    nickName?: string;
    fans?: number;
    profileUrl?: string;
  };
  videoMeta?: {
    duration?: number;
    coverUrl?: string;
    originalCoverUrl?: string;
  };
};

/** Item cru do actor apidojo (nomes conforme o README oficial dele). */
type ItemApify = {
  id?: string;
  title?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  bookmarks?: number;
  hashtags?: Array<string | { name?: string }>;
  uploadedAtFormatted?: string;
  uploadedAt?: number;
  postPage?: string;
  channel?: { username?: string; followers?: number };
  video?: { duration?: number; url?: string; cover?: string; thumbnail?: string };
};

export type ViralImportado = {
  plataforma: "tiktok";
  video_id: string;
  url: string;
  autor: string | null;
  autor_seguidores: number | null;
  legenda: string | null;
  likes: number;
  views: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  publicado_em: string | null;
  duracao_seg: number | null;
  thumb_url: string | null;
  video_url: string | null;
  hashtags: string[];
  score: number;
};

function dataDoItem(it: ItemApify): string | null {
  if (it.uploadedAtFormatted) {
    const t = Date.parse(it.uploadedAtFormatted);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  if (typeof it.uploadedAt === "number" && it.uploadedAt > 0) {
    // O actor manda em segundos; alguns builds mandam em ms.
    const ms = it.uploadedAt > 1e12 ? it.uploadedAt : it.uploadedAt * 1000;
    return new Date(ms).toISOString();
  }
  return null;
}

/** Converte o item do clockworks pro nosso formato. */
function normalizarClockworks(it: ItemClockworks): ViralImportado | null {
  const videoId = it.id ? String(it.id) : "";
  const url = it.webVideoUrl ?? "";
  if (!videoId || !url) return null;
  const publicado =
    it.createTimeISO ??
    (typeof it.createTime === "number" && it.createTime > 0
      ? new Date(it.createTime * 1000).toISOString()
      : null);
  const base = {
    likes: Number(it.diggCount ?? 0) || 0,
    views: Number(it.playCount ?? 0) || null,
    comentarios: Number(it.commentCount ?? 0) || null,
    compartilhamentos: Number(it.shareCount ?? 0) || null,
    publicado_em: publicado,
  };
  return {
    plataforma: "tiktok",
    video_id: videoId,
    url,
    autor: it.authorMeta?.name ?? null,
    autor_seguidores: Number(it.authorMeta?.fans ?? 0) || null,
    legenda: (it.text ?? "").trim() || null,
    duracao_seg: typeof it.videoMeta?.duration === "number" ? it.videoMeta.duration : null,
    thumb_url: it.videoMeta?.coverUrl ?? it.videoMeta?.originalCoverUrl ?? null,
    // mediaUrls é o mp4 direto; expira, mas serve pro player e pro download.
    video_url: it.mediaUrls?.[0] ?? null,
    hashtags: (it.hashtags ?? [])
      .map((h) => (typeof h === "string" ? h : h?.name ?? ""))
      .filter(Boolean)
      .slice(0, 20),
    ...base,
    score: score({ ...base, plataforma: "tiktok" } as never),
  };
}

function normalizar(it: ItemApify): ViralImportado | null {
  const videoId = it.id ? String(it.id) : "";
  const url = it.postPage ?? "";
  if (!videoId || !url) return null;
  const base = {
    likes: Number(it.likes ?? 0) || 0,
    views: Number(it.views ?? 0) || null,
    comentarios: Number(it.comments ?? 0) || null,
    compartilhamentos: Number(it.shares ?? 0) || null,
    publicado_em: dataDoItem(it),
  };
  return {
    plataforma: "tiktok",
    video_id: videoId,
    url,
    autor: it.channel?.username ?? null,
    autor_seguidores: Number(it.channel?.followers ?? 0) || null,
    legenda: (it.title ?? "").trim() || null,
    duracao_seg: typeof it.video?.duration === "number" ? it.video.duration : null,
    thumb_url: it.video?.cover ?? it.video?.thumbnail ?? null,
    video_url: it.video?.url ?? null,
    hashtags: (it.hashtags ?? [])
      .map((h) => (typeof h === "string" ? h : h?.name ?? ""))
      .filter(Boolean)
      .slice(0, 20),
    ...base,
    score: score({ ...base, plataforma: "tiktok" } as never),
  };
}

/** Baixa os itens do dataset de uma execução e devolve já normalizados. */
export async function itensDoRun(datasetId: string, teto = 1000): Promise<ViralImportado[]> {
  const json = await pedir<ItemApify[]>(
    `/datasets/${datasetId}/items?clean=true&limit=${teto}`,
  );
  const lista = Array.isArray(json) ? json : [];
  const normalizados = lista
    .map((it) => {
      const bruto = it as ItemApify & ItemClockworks & { noResults?: boolean };
      // O apidojo grava {"noResults": true} quando a busca não achou nada.
      if (bruto?.noResults) return null;
      // Cada actor usa nomes próprios: o campo da URL diz qual é qual.
      return bruto?.webVideoUrl ? normalizarClockworks(bruto) : normalizar(bruto);
    })
    .filter((v): v is ViralImportado => v !== null);
  // Mesmo vídeo pode vir 2x quando a busca cruza hashtag e keyword.
  return [...new Map(normalizados.map((v) => [v.video_id, v])).values()];
}
