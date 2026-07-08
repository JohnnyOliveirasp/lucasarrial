/**
 * Configuração do gerador de imagem (Kie — gpt-image-2-image-to-image).
 * Valores de negócio (custo por resolução) e os parâmetros traduzidos pra UI.
 */

/** Modelo image-to-image do Kie usado pra gerar o clone visual. */
export const KIE_IMAGE_MODEL = "gpt-image-2-image-to-image";

/**
 * Proporções expostas ao usuário (subconjunto curado do que o Kie aceita).
 * `value` vai cru pro Kie; `label` é o que a pessoa lê.
 */
export const ASPECT_RATIOS = [
  { value: "auto", label: "Automático", hint: "O modelo escolhe a melhor proporção (sai em 1K)." },
  { value: "1:1", label: "Quadrado (1:1)", hint: "Feed, perfil, avatar." },
  { value: "4:5", label: "Retrato (4:5)", hint: "Post vertical de feed (Instagram)." },
  { value: "9:16", label: "Vertical (9:16)", hint: "Stories, Reels, TikTok." },
  { value: "16:9", label: "Horizontal (16:9)", hint: "Capa, YouTube, apresentação." },
  { value: "3:2", label: "Paisagem (3:2)", hint: "Foto clássica deitada." },
  { value: "2:3", label: "Pôster (2:3)", hint: "Foto clássica em pé." },
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number]["value"];
export const ASPECT_VALUES = ASPECT_RATIOS.map((a) => a.value) as readonly string[];

/**
 * Resoluções e o custo em créditos de cada uma.
 * REPRECIFICADO 2026-07-08 (Johnny): lucro ≥70% sobre o custo REAL do Kie.
 * Conta: custo Kie (créditos Kie × US$0,005 × câmbio 5,5) × 1,7 ÷ valor do
 * crédito da plataforma (R$97/180.000 = R$0,000539). Kie: 1K=6, 2K=11, 4K=15
 * créditos Kie. Antes era 12/22/30 (≈25× abaixo do custo — prejuízo).
 */
export const RESOLUTIONS = [
  { value: "1K", label: "1K", credits: 525, hint: "Padrão — rápido e barato. Ótimo pra redes sociais." },
  { value: "2K", label: "2K", credits: 960, hint: "Mais nitidez. Bom pra impressão pequena." },
  { value: "4K", label: "4K", credits: 1320, hint: "Máxima resolução. Indisponível em quadrado (1:1) e automático." },
] as const;

export type Resolution = (typeof RESOLUTIONS)[number]["value"];
export const RESOLUTION_VALUES = RESOLUTIONS.map((r) => r.value) as readonly string[];

/** Menor custo possível — abaixo disso a pessoa não consegue gerar nada. */
export const IMAGE_MIN_CREDITS = Math.min(...RESOLUTIONS.map((r) => r.credits));

/** Custo em créditos de uma geração de imagem pela resolução escolhida. */
export function imageCreditCost(resolution: string): number {
  return RESOLUTIONS.find((r) => r.value === resolution)?.credits ?? IMAGE_MIN_CREDITS;
}

/**
 * Restrições do modelo: `auto` só sai em 1K; `1:1` não aceita 4K.
 * Retorna a resolução válida (faz o "clamp") pra dada proporção.
 */
export function resolveResolutionForAspect(aspect: string, resolution: string): string {
  if (aspect === "auto") return "1K";
  if (aspect === "1:1" && resolution === "4K") return "2K";
  return RESOLUTION_VALUES.includes(resolution) ? resolution : "1K";
}

/** Resoluções permitidas pra uma dada proporção (pra UI desabilitar opções). */
export function allowedResolutions(aspect: string): string[] {
  if (aspect === "auto") return ["1K"];
  if (aspect === "1:1") return ["1K", "2K"];
  return [...RESOLUTION_VALUES];
}
