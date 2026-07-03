/**
 * Presets de legenda do vídeo final (Fase 5) — fonte de verdade pra UI
 * (galeria com preview) e pra validação na API. O DESENHO real (ASS) vive em
 * `render/subtitles.mjs` (worker) e ESPELHA estes ids — manter em sincronia.
 *
 * Fontes embarcadas em `public/assets/subtitle-fonts/` (OFL/Apache, grátis
 * comercial) — o worker usa via `fontsdir` (não precisa instalar no SO) e a
 * UI usa via @font-face pro preview.
 */

export type SubtitlePosition = "bottom" | "center" | "top";
export type SubtitleSize = "normal" | "large";

export type SubtitlePreset = {
  id: string;
  /** Emoji + nome curto na galeria. */
  label: string;
  desc: string;
  /** Preview (CSS): fonte, cor base, cor da palavra ativa, fundo, contorno. */
  css: {
    fontFamily: string;
    color: string;
    activeColor?: string;
    background?: string;
    textShadow?: string;
    uppercase?: boolean;
  };
  /** Posição padrão quando o usuário não escolhe. */
  defaultPosition: SubtitlePosition;
};

export const SUBTITLE_PRESETS: readonly SubtitlePreset[] = [
  {
    id: "hormozi",
    label: "🔥 Hormozi",
    desc: "Extra-bold, palavra ativa amarela com pop",
    css: {
      fontFamily: "'Montserrat Black', sans-serif",
      color: "#FFFFFF",
      activeColor: "#FFD400",
      textShadow: "2px 2px 0 #000, -1px -1px 0 #000, 0 0 6px rgba(0,0,0,.8)",
      uppercase: true,
    },
    defaultPosition: "bottom",
  },
  {
    id: "hormozi_green",
    label: "💰 Hormozi Verde",
    desc: "Mesmo estilo, destaque verde (negócios)",
    css: {
      fontFamily: "'Montserrat Black', sans-serif",
      color: "#FFFFFF",
      activeColor: "#00FF3C",
      textShadow: "2px 2px 0 #000, -1px -1px 0 #000, 0 0 6px rgba(0,0,0,.8)",
      uppercase: true,
    },
    defaultPosition: "bottom",
  },
  {
    id: "beast",
    label: "💥 Beast",
    desc: "Cartoon vibrante, cores alternando por palavra",
    css: {
      fontFamily: "'Luckiest Guy', sans-serif",
      color: "#FFFFFF",
      activeColor: "#FF3B30",
      textShadow: "2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
      uppercase: true,
    },
    defaultPosition: "bottom",
  },
  {
    id: "one_word",
    label: "⚡ Uma Palavra",
    desc: "Uma palavra gigante por vez, no centro",
    css: {
      fontFamily: "'Archivo Black', sans-serif",
      color: "#FFFFFF",
      textShadow: "3px 3px 0 #000, -1px -1px 0 #000",
      uppercase: true,
    },
    defaultPosition: "center",
  },
  {
    id: "karaoke",
    label: "🎤 Karaokê",
    desc: "Palavra acende em amarelo ao ser falada",
    css: {
      fontFamily: "'Anton', sans-serif",
      color: "#FFFFFF",
      activeColor: "#FFD400",
      textShadow: "2px 2px 0 #000, -1px -1px 0 #000",
      uppercase: false,
    },
    defaultPosition: "bottom",
  },
  {
    id: "clean",
    label: "⚪ Clean",
    desc: "Frase branca com contorno, discreta",
    css: {
      fontFamily: "'Poppins SemiBold', sans-serif",
      color: "#FFFFFF",
      textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 0 0 4px rgba(0,0,0,.9)",
    },
    defaultPosition: "bottom",
  },
  {
    id: "boxed",
    label: "⬛ Boxed",
    desc: "Texto branco sobre faixa preta translúcida",
    css: {
      fontFamily: "'Poppins SemiBold', sans-serif",
      color: "#FFFFFF",
      background: "rgba(0,0,0,0.6)",
    },
    defaultPosition: "bottom",
  },
  {
    id: "neon",
    label: "🟢 Neon",
    desc: "Verde-limão com contorno escuro (hype/gaming)",
    css: {
      fontFamily: "'Anton', sans-serif",
      color: "#B4FF00",
      textShadow: "0 0 8px rgba(180,255,0,.55), 2px 2px 0 #0A2A00, -1px -1px 0 #0A2A00",
      uppercase: true,
    },
    defaultPosition: "bottom",
  },
  {
    id: "bangers",
    label: "🎪 Bangers",
    desc: "Cartoon impacto, tipo quadrinhos",
    css: {
      fontFamily: "'Bangers', sans-serif",
      color: "#FFFFFF",
      textShadow: "3px 3px 0 #000, -1px -1px 0 #000",
      uppercase: true,
    },
    defaultPosition: "bottom",
  },
  {
    id: "sobrio",
    label: "✍️ Sóbrio",
    desc: "Pequeno e elegante, conteúdo profissional",
    css: {
      fontFamily: "'Poppins SemiBold', sans-serif",
      color: "rgba(255,255,255,0.95)",
      textShadow: "1px 1px 2px rgba(0,0,0,.85)",
    },
    defaultPosition: "bottom",
  },
] as const;

export const SUBTITLE_PRESET_IDS = SUBTITLE_PRESETS.map((p) => p.id);
export const SUBTITLE_POSITIONS: readonly SubtitlePosition[] = ["bottom", "center", "top"];
export const SUBTITLE_SIZES: readonly SubtitleSize[] = ["normal", "large"];

export function getSubtitlePreset(id: string | null | undefined): SubtitlePreset {
  return SUBTITLE_PRESETS.find((p) => p.id === id) ?? SUBTITLE_PRESETS[4]; // karaoke
}
