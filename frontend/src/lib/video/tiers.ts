/**
 * Tiers de geração de vídeo (image-to-video via Kie). Valores travados com o
 * Lucas: preço ao usuário = 2× o custo do Kie (mesma regra da imagem).
 *
 * Os 3 modelos são exemplificados por vídeos de amostra em
 * /assets/video-samples/{grok,kling,seedance}.mp4 — a pessoa compara e escolhe
 * qual chegou mais perto do prompt antes de gastar créditos.
 */

export type VideoTierId = "bronze" | "prata" | "gold";

export type VideoTier = {
  id: VideoTierId;
  /** Medalha + rótulo curto exibido na UI. */
  medal: string;
  label: string;
  /** Modelo cru enviado ao Kie (createTask). */
  kieModel: string;
  /** Custo do Kie por clipe (referência interna). */
  kieCost: number;
  /** Preço ao usuário por clipe (= 2× kieCost). */
  creditsPerClip: number;
  /** Vídeo de amostra (público) pra comparação. */
  sampleSrc: string;
  /** Frase curta de posicionamento. */
  blurb: string;
};

export const VIDEO_TIERS: readonly VideoTier[] = [
  {
    id: "bronze",
    medal: "🥉",
    label: "Bronze",
    kieModel: "grok-imagine-video-1-5-preview",
    kieCost: 15,
    creditsPerClip: 30,
    sampleSrc: "/assets/video-samples/grok.mp4",
    blurb: "Rápido e econômico. Bom pra volume.",
  },
  {
    id: "prata",
    medal: "🥈",
    label: "Prata",
    kieModel: "kling/v3-turbo-image-to-video",
    kieCost: 90,
    creditsPerClip: 180,
    sampleSrc: "/assets/video-samples/kling.mp4",
    blurb: "Movimento mais natural e estável.",
  },
  {
    id: "gold",
    medal: "🥇",
    label: "Gold",
    kieModel: "bytedance/seedance-2-mini",
    kieCost: 103,
    creditsPerClip: 206,
    sampleSrc: "/assets/video-samples/seedance.mp4",
    blurb: "Máxima qualidade e fidelidade.",
  },
] as const;

/** Custo em créditos da varinha ✨ de vídeo: Sonnet COM VISÃO re-escreve o
 *  prompt olhando a imagem (mais caro que a de imagem). NÃO inclui o clipe. */
export const VIDEO_PROMPT_WAND_COST = 15;

/** Todos os clipes têm 4s, 9:16, 720p (= SECONDS_PER_SCENE; 4s é o mínimo
 *  comum aos 3 modelos — Seedance não desce de 4). */
export const VIDEO_DURATION_SECONDS = 4;
export const VIDEO_RESOLUTION = "720p";

/** Prompt de movimento padrão quando o Sonnet (visão) falha — mantém o fluxo. */
export const FALLBACK_MOVEMENT_PROMPT_PT =
  "Animação sutil e realista do sujeito da imagem: leve movimento de cabeça, piscadas, micro-expressões e um gesto natural, com um lento dolly-in de câmera. Pele com textura natural e poros visíveis, grão de filme sutil, sem filtro de beleza. Mantém identidade, roupa, iluminação e fundo.";
export const FALLBACK_MOVEMENT_PROMPT_EN =
  "Subtle, lifelike animation of the subject from the image: gentle head movement, natural blinking, micro-expressions and a small hand gesture, with a slow cinematic dolly-in. Natural skin texture with visible pores, subtle film grain, no beauty filter, no 3D render, no cartoon, no VFX look. Keep identity, clothing, lighting and background stable.";

export function getTier(id: string | null | undefined): VideoTier | null {
  return VIDEO_TIERS.find((t) => t.id === id) ?? null;
}

export function tierCreditsPerClip(id: string | null | undefined): number {
  return getTier(id)?.creditsPerClip ?? 0;
}

/**
 * Prompt de referência (o MESMO usado nos 3 vídeos de amostra). Exibido em
 * pt-BR na tela de comparação pra pessoa entender o que cada modelo entregou.
 */
export const SAMPLE_VIDEO_PROMPT_PT =
  "Retrato em plano médio fechado de um jovem (do primeiro fotograma) com um suéter " +
  "de tricô creme, em um ambiente interno aconchegante. Ação: ele mantém contato " +
  "visual com a câmera, abre um sorriso genuíno e caloroso e começa a falar com o " +
  "público com uma linguagem corporal confiante e acolhedora, acrescentando um gesto " +
  "sutil com a mão. Animação facial natural e realista — movimento dos lábios, " +
  "piscadas, leve movimento da cabeça — mantendo sua identidade e vestimenta " +
  "originais. Iluminação e fundo permanecem estáveis e realistas. Câmera: dolly-in " +
  "cinematográfico lento. Estilo: vídeo vertical curto, fotorrealista e com alto " +
  "nível de detalhes.";
