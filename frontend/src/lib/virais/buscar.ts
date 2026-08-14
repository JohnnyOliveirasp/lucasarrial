/**
 * Orquestrador da busca de virais: pergunta às plataformas escolhidas EM
 * PARALELO e devolve tudo junto, já ordenado. Uma plataforma indisponível não
 * derruba a outra — o motivo sobe pra tela.
 */
import { provedorInstagram } from "./instagram";
import { provedorTiktok } from "./tiktok";
import type { BuscaParams, Plataforma, ResultadoPlataforma, VideoViral } from "./tipos";

export const PLATAFORMAS: Plataforma[] = ["instagram", "tiktok"];

const PROVEDORES = {
  instagram: provedorInstagram,
  tiktok: provedorTiktok,
} as const;

export const LIMITES = {
  minLikesPadrao: 50_000,
  diasPadrao: 60,
  limitePadrao: 30,
  limiteMax: 100,
  diasMax: 365,
} as const;

export type RespostaBusca = {
  videos: VideoViral[];
  porPlataforma: ResultadoPlataforma[];
};

export async function buscarVirais(
  params: BuscaParams,
  plataformas: Plataforma[],
): Promise<RespostaBusca> {
  const alvos = plataformas.length > 0 ? plataformas : PLATAFORMAS;
  const resultados = await Promise.all(
    alvos.map(async (p): Promise<ResultadoPlataforma> => {
      try {
        return await PROVEDORES[p].buscar(params);
      } catch (e) {
        console.error(`[virais/${p}]`, e instanceof Error ? e.message : e);
        return {
          plataforma: p,
          videos: [],
          varridos: 0,
          indisponivel: "Falha inesperada nessa plataforma.",
        };
      }
    }),
  );

  const videos = resultados
    .flatMap((r) => r.videos)
    .sort((a, b) => b.score - a.score);

  return { videos, porPlataforma: resultados };
}

/** Normaliza o que veio do corpo da requisição, com tetos sãos. */
export function lerParams(body: Record<string, unknown>): {
  params: BuscaParams;
  plataformas: Plataforma[];
} {
  const nicho = typeof body.nicho === "string" ? body.nicho.trim().slice(0, 80) : "";
  const minLikes = inteiro(body.min_likes, LIMITES.minLikesPadrao, 0, 100_000_000);
  const dias = inteiro(body.dias, LIMITES.diasPadrao, 0, LIMITES.diasMax);
  const limite = inteiro(body.limite, LIMITES.limitePadrao, 1, LIMITES.limiteMax);
  const pedidas = Array.isArray(body.plataformas) ? body.plataformas : [];
  const plataformas = PLATAFORMAS.filter((p) => pedidas.includes(p));
  return {
    params: { nicho, minLikes, dias, limite },
    plataformas: plataformas.length > 0 ? plataformas : PLATAFORMAS,
  };
}

function inteiro(v: unknown, padrao: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
