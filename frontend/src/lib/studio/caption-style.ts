/**
 * Ponte preset→worker dos estilos de legenda da MONTAGEM do Estúdio (13/08).
 *
 * A UI usa os mesmos SUBTITLE_PRESETS do Vídeo História (preview idêntico);
 * aqui cada preset vira o dicionário `caption_style` que o worker de montagem
 * entende (finish.parse_caption_style): fonte via URL pública dos assets,
 * cores em hex, faixa (box), posição e tamanho. O desenho é PIL (PNG overlay),
 * então textShadow vira contorno — aproximação assumida.
 */
import type { SubtitlePosition, SubtitleSize } from "@/lib/video/subtitle-presets";
import { SUBTITLE_PRESET_IDS } from "@/lib/video/subtitle-presets";

/** Arquivo TTF de cada preset (public/assets/subtitle-fonts). */
const FONT_FILE: Record<string, string> = {
  hormozi: "Montserrat-Black.ttf",
  hormozi_green: "Montserrat-Black.ttf",
  beast: "LuckiestGuy-Regular.ttf",
  one_word: "ArchivoBlack-Regular.ttf",
  karaoke: "Anton-Regular.ttf",
  neon: "Anton-Regular.ttf",
  clean: "Poppins-SemiBold.ttf",
  boxed: "Poppins-SemiBold.ttf",
  sobrio: "Poppins-SemiBold.ttf",
  bangers: "Bangers-Regular.ttf",
};

/** Parâmetros de desenho por preset (espelham o css dos SUBTITLE_PRESETS). */
const DRAW: Record<string, Record<string, unknown>> = {
  hormozi: { color: "#FFFFFF", active_color: "#FFD400", stroke: "#000000", uppercase: true },
  hormozi_green: { color: "#FFFFFF", active_color: "#00FF3C", stroke: "#000000", uppercase: true },
  beast: { color: "#FFFFFF", active_color: "#FF3B30", stroke: "#000000", uppercase: true },
  one_word: { color: "#FFFFFF", stroke: "#000000", uppercase: true, max_words: 1, size_mult: 1.5 },
  karaoke: { color: "#FFFFFF", active_color: "#FFD400", stroke: "#000000" },
  clean: { color: "#FFFFFF", stroke: "#000000" },
  boxed: { color: "#FFFFFF", box_rgba: [0, 0, 0, 153] },
  neon: { color: "#B4FF00", stroke: "#0A2A00", uppercase: true },
  bangers: { color: "#FFFFFF", stroke: "#000000", uppercase: true },
  sobrio: { color: "#FFFFFF", stroke: "#000000", size_mult: 0.8 },
};

export function isValidCaptionStyle(id: unknown): id is string {
  return typeof id === "string" && SUBTITLE_PRESET_IDS.includes(id);
}

/**
 * Monta o caption_style do job. `null` = sem estilo custom (visual clássico).
 * O chamador decide captions=false quando styleId === "none".
 */
export function buildCaptionStyle(
  styleId: string,
  position?: SubtitlePosition | null,
  size?: SubtitleSize | null,
): Record<string, unknown> | null {
  const draw = DRAW[styleId];
  const file = FONT_FILE[styleId];
  if (!draw || !file) return null;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
  const base: Record<string, unknown> = { ...draw };
  if (site) base.font_url = `${site}/assets/subtitle-fonts/${file}`;
  if (position) base.position = position;
  if (size === "large") {
    const cur = typeof base.size_mult === "number" ? (base.size_mult as number) : 1.0;
    base.size_mult = Math.round(cur * 1.3 * 100) / 100;
  }
  return base;
}
