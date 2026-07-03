/**
 * Configuração de negócio do wizard de geração de vídeo.
 * Valores travados com o Lucas (ver memória project-video-wizard).
 */

/** Teto do áudio que vira vídeo: 1min30s. */
export const MAX_AUDIO_SECONDS = 90;

/** Cada cena/clipe de vídeo tem 4 segundos fixos (mínimo aceito pelos 3
 *  modelos Kie: Grok 1–15s, Kling 3–15s, Seedance 4–15s). */
export const SECONDS_PER_SCENE = 4;

/** Tudo é vertical (Instagram/Reels/TikTok). */
export const VIDEO_ASPECT_RATIO = "9:16";

/** Custo de "Improve Prompt" (LLM reescreve o prompt de UMA cena). */
export const IMPROVE_PROMPT_COST = 1;

/**
 * Nº de cenas a partir da duração do áudio.
 * Arredonda pro mais próximo pelo resto da divisão por SECONDS_PER_SCENE (4):
 *   resto 0–1 → baixo; resto 2–3 → cima. (mínimo 1 cena)
 * Ex.: 89s → 22 cenas; 90s → 23 cenas.
 */
export function sceneCountForDuration(durationSeconds: number): number {
  const full = Math.floor(durationSeconds / SECONDS_PER_SCENE);
  const remainder = durationSeconds - full * SECONDS_PER_SCENE;
  const count = remainder >= SECONDS_PER_SCENE / 2 ? full + 1 : full;
  return Math.max(1, count);
}
