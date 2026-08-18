/**
 * Vigia noturno — REGISTRO de detectores e teto por tabela.
 *
 * A espinha (run.ts) não sabe o que cada detector faz: ela só itera esta
 * lista, isola exceções, aplica o teto e junta o resultado. Detector novo =
 * uma entrada aqui, nada mais muda.
 *
 * ONDA 1 pendente (ordem de 18/08): card 2 (filas paradas — reaproveitar os
 * limiares provados de _frank/ferramentas/varredura_travados.cjs) e card 6
 * (cron morto — a Fast ficou 2 dias muda em 08/08 e ninguém soube).
 *
 * Exemplo de registro (card 2):
 *   DETECTORS.push({
 *     name: "filas-paradas-voices",
 *     table: "voices",
 *     ttlHours: 0.5,
 *     expectRows: true,
 *     run: async ({ db }) => { ... return { checked, findings }; },
 *   });
 */
import type { NightWatchDetector } from "./types";

export const DETECTORS: NightWatchDetector[] = [];

/**
 * Teto de findings NOVOS por tabela por rodada — pra rodada de madrugada não
 * brigar com o tráfego do dia nem virar um dump de milhares de linhas.
 * Itens já vistos (night_watch_seen) NÃO consomem o teto: foi a armadilha de
 * 18/08 — o item insolúvel voltava toda rodada, comia o teto e escondia o
 * resolvível.
 */
const TABLE_CAPS: Record<string, number> = {
  voices: 50,
  generations: 50,
  image_generations: 50,
  video_clones: 50,
  react_jobs: 50,
  training_jobs: 50,
};

const DEFAULT_CAP = 30;

export function capForTable(table: string): number {
  return TABLE_CAPS[table] ?? DEFAULT_CAP;
}
