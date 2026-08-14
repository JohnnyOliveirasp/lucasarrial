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

const ACTOR_ID = "5K30i8aFccKNF5ICs"; // apidojo/tiktok-scraper
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

export type PedidoBusca = {
  nicho: string;
  periodo: Periodo;
  /** Teto de vídeos: é o que define o custo (US$0,30 por 1.000). */
  maxItems: number;
  /** País de onde "olhar" o TikTok — o nicho handyman é dos EUA. */
  pais: string;
};

/**
 * Dispara a busca no Apify e devolve o id da execução. NÃO espera terminar:
 * uma busca de centenas de vídeos leva minutos e seguraria a requisição.
 * A tela pergunta o status depois e importa quando ficar pronto.
 */
export async function dispararBusca(p: PedidoBusca): Promise<RunApify> {
  const token = apifyToken();
  if (!token) throw new Error("sem_token");
  const input: Record<string, unknown> = {
    keywords: [p.nicho],
    sortType: "MOST_LIKED", // o que a gente quer é viral, não relevância
    dateRange: p.periodo,
    maxItems: p.maxItems,
    includeSearchKeywords: true,
  };
  if (p.pais) input.location = p.pais;

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
    .map(normalizar)
    .filter((v): v is ViralImportado => v !== null);
  // Mesmo vídeo pode vir 2x quando a busca cruza hashtag e keyword.
  return [...new Map(normalizados.map((v) => [v.video_id, v])).values()];
}
