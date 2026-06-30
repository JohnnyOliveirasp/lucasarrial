/**
 * Configuração de negócio do wizard de geração de vídeo.
 * Valores travados com o Lucas (ver memória project-video-wizard).
 */

/** Teto do áudio que vira vídeo: 1min30s. */
export const MAX_AUDIO_SECONDS = 90;

/** Cada cena/clipe de vídeo tem 5 segundos fixos. */
export const SECONDS_PER_SCENE = 5;

/** Tudo é vertical (Instagram/Reels/TikTok). */
export const VIDEO_ASPECT_RATIO = "9:16";

/** Custo de "Improve Prompt" (LLM reescreve o prompt de UMA cena). */
export const IMPROVE_PROMPT_COST = 1;

/**
 * Nº de cenas a partir da duração do áudio.
 * Regra de arredondamento pelo resto da divisão por 5:
 *   resto 1–2 → baixo; resto 3–4 → cima. (mínimo 1 cena)
 * Ex.: 81–82s → 16 cenas; 83–84s → 17 cenas.
 */
export function sceneCountForDuration(durationSeconds: number): number {
  const full = Math.floor(durationSeconds / SECONDS_PER_SCENE);
  const remainder = durationSeconds - full * SECONDS_PER_SCENE;
  const count = remainder >= 3 ? full + 1 : full;
  return Math.max(1, count);
}
