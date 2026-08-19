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

/** Ratios que os modelos de vídeo do Kie aceitam; fora disso cai no vertical. */
const VIDEO_RATIOS = new Set(["9:16", "16:9", "1:1", "4:3", "3:4"]);

/**
 * Ratio do vídeo a partir do ratio da IMAGEM de origem (Animar Imagem): segue a
 * foto quando o modelo aceita, senão vertical. Usado tanto no despacho quanto
 * na contingência — antes o fallback mandava "9:16" fixo, o que passava batido
 * com Hailuo (que ignora o campo) mas viraria vídeo torto agora que Prata/Gold
 * caem em Kling/Seedance, que RESPEITAM o ratio.
 */
export function pickVideoAspectRatio(imageAspectRatio: string | null | undefined): string {
  return imageAspectRatio && VIDEO_RATIOS.has(imageAspectRatio)
    ? imageAspectRatio
    : VIDEO_ASPECT_RATIO;
}

/** Custo de "Improve Prompt" (LLM reescreve o prompt de UMA cena). */
export const IMPROVE_PROMPT_COST = 1;

/** Vídeo Vendas TikTok: cada ação de IA (análise / roteiro / refazer / varinha)
 *  custa 15 créditos — travado com o Johnny 2026-07-06. Edição manual é grátis. */
export const SALES_AI_COST = 15;

/** Teto de fala do Vídeo Vendas (foco TikTok): 60s (pipeline aguenta 90). */
export const SALES_MAX_AUDIO_SECONDS = 60;

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

/** Ritmo de fala usado pra estimar duração sem áudio (pt-BR, narração de vídeo curto). */
const WORDS_PER_MINUTE = 150;

/**
 * Quanto tempo esse roteiro duraria falado, em segundos.
 *
 * Serve pro caso sem narração: desde 18/08 a voz é OPCIONAL no Vídeo Vendas
 * (dá pra entregar só com legenda, ou mudo pra pessoa legendar depois), e sem
 * áudio não há `audio_duration_seconds` pra dizer quantas cenas gerar. É a
 * mesma régua que o roteiro já usa do outro lado — ~140 palavras ≈ 55s.
 */
export function spokenSecondsFromScript(script: string): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return (words / WORDS_PER_MINUTE) * 60;
}
