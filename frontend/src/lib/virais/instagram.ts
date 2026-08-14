/**
 * Provedor Instagram do buscador de virais.
 *
 * Usa o mesmo endpoint web que a própria instagram.com chama quando você abre
 * uma hashtag (`/api/v1/tags/web_info/`). Ele devolve, numa tacada, os posts
 * TOP e RECENTES da tag já com like_count/play_count/comment_count/taken_at —
 * que é exatamente o que a busca por "viral do nicho" precisa. Provado na mão
 * 14/08 com a tag handyman: 24 mídias, likes e views corretos.
 *
 * Requisito: cookie de uma sessão logada em INSTAGRAM_WEB_COOKIES (formato
 * "sessionid=...; ds_user_id=...; csrftoken=..."). Sem login o endpoint
 * responde 401/redireciona — Instagram fechou hashtag pública.
 * ⚠️ Use uma conta DESCARTÁVEL: leitura automatizada pode derrubar a conta.
 */
import type { BuscaParams, Provedor, ResultadoPlataforma, VideoViral } from "./tipos";
import { filtrarEOrdenar, score } from "./tipos";

const IG_APP_ID = "936619743392459";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const TIMEOUT_MS = 25_000;

type IgMedia = {
  code?: string;
  pk?: string | number;
  id?: string;
  like_count?: number;
  play_count?: number;
  ig_play_count?: number;
  comment_count?: number;
  taken_at?: number;
  media_type?: number;
  product_type?: string;
  video_duration?: number;
  user?: { username?: string };
  caption?: { text?: string } | null;
  image_versions2?: { candidates?: Array<{ url?: string }> };
};

type IgSection = { layout_content?: { medias?: Array<{ media?: IgMedia }> } };

/** Só o que é vídeo: reel (clips) ou media_type 2. Foto não serve de fundo. */
function ehVideo(m: IgMedia): boolean {
  return m.product_type === "clips" || m.media_type === 2;
}

function normalizar(m: IgMedia): VideoViral | null {
  const code = m.code;
  if (!code || !ehVideo(m)) return null;
  const publicado = m.taken_at ? new Date(m.taken_at * 1000).toISOString() : null;
  const base = {
    likes: Number(m.like_count ?? 0) || 0,
    views: Number(m.play_count ?? m.ig_play_count ?? 0) || null,
    comentarios: Number(m.comment_count ?? 0) || null,
    compartilhamentos: null,
    publicado_em: publicado,
  };
  return {
    plataforma: "instagram",
    video_id: String(m.pk ?? m.id ?? code),
    url: `https://www.instagram.com/reel/${code}/`,
    autor: m.user?.username ?? "",
    legenda: (m.caption?.text ?? "").trim(),
    duracao_seg: m.video_duration ? Math.round(m.video_duration) : null,
    thumb: m.image_versions2?.candidates?.[0]?.url ?? null,
    ...base,
    score: score(base),
  };
}

function extrairMedias(secoes: IgSection[] | undefined): IgMedia[] {
  if (!Array.isArray(secoes)) return [];
  return secoes.flatMap((s) =>
    (s?.layout_content?.medias ?? []).map((x) => x?.media).filter(Boolean) as IgMedia[],
  );
}

/** "#Marcenaria Fina" → "marcenariafina" (a API aceita só o slug da tag). */
export function slugDaTag(nicho: string): string {
  return nicho
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function buscarTag(tag: string, cookies: string): Promise<IgMedia[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(
      `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${encodeURIComponent(tag)}`,
      {
        headers: {
          "x-ig-app-id": IG_APP_ID,
          "user-agent": UA,
          accept: "*/*",
          referer: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`,
          cookie: cookies,
        },
        signal: ctrl.signal,
      },
    );
    if (resp.status === 401 || resp.status === 403) {
      throw new Error("sessao_invalida");
    }
    if (resp.status === 429) throw new Error("limite_instagram");
    if (!resp.ok) throw new Error(`http_${resp.status}`);
    const json = (await resp.json()) as {
      data?: { top?: { sections?: IgSection[] }; recent?: { sections?: IgSection[] } };
    };
    return [
      ...extrairMedias(json.data?.top?.sections),
      ...extrairMedias(json.data?.recent?.sections),
    ];
  } finally {
    clearTimeout(timer);
  }
}

function motivoLegivel(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "sessao_invalida")
    return "A sessão do Instagram expirou — renove INSTAGRAM_WEB_COOKIES.";
  if (msg === "limite_instagram")
    return "O Instagram limitou as consultas por agora (429). Tente de novo em alguns minutos.";
  if (msg.includes("abort")) return "O Instagram demorou demais pra responder.";
  return `Falha ao consultar o Instagram (${msg}).`;
}

export const provedorInstagram: Provedor = {
  plataforma: "instagram",
  async buscar(params: BuscaParams): Promise<ResultadoPlataforma> {
    const cookies = (process.env.INSTAGRAM_WEB_COOKIES || "").trim();
    if (!cookies) {
      return {
        plataforma: "instagram",
        videos: [],
        varridos: 0,
        indisponivel:
          "Falta a sessão do Instagram no servidor (INSTAGRAM_WEB_COOKIES).",
      };
    }
    const tag = slugDaTag(params.nicho);
    if (!tag) {
      return { plataforma: "instagram", videos: [], varridos: 0, indisponivel: "Nicho vazio." };
    }
    try {
      const medias = await buscarTag(tag, cookies);
      const normalizados = medias
        .map(normalizar)
        .filter((v): v is VideoViral => v !== null);
      // Dedup por video_id: top e recent repetem o mesmo post.
      const unicos = [...new Map(normalizados.map((v) => [v.video_id, v])).values()];
      return {
        plataforma: "instagram",
        videos: filtrarEOrdenar(unicos, params),
        varridos: medias.length,
      };
    } catch (e) {
      console.error("[virais/instagram]", e instanceof Error ? e.message : e);
      return { plataforma: "instagram", videos: [], varridos: 0, indisponivel: motivoLegivel(e) };
    }
  },
};
