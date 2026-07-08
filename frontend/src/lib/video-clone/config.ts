/**
 * Vídeo Clone (lip-sync InfiniteTalk no NOSSO RunPod serverless).
 * Preço por SEGUNDO de áudio, regra 2026-07-08 (Johnny): lucro ≥70% sobre o
 * custo real de GPU. Medido no smoke test: ~40s de GPU por segundo de áudio a
 * 640×850 na L40S (US$0,99/h) ≈ R$0,06/s. 720p ≈ 2,5× isso. Crédito da
 * plataforma = R$97/180.000 = R$0,000539.
 */

export type CloneTierId = "480p" | "720p" | "480p-v2";

export type CloneTier = {
  id: CloneTierId;
  label: string;
  blurb: string;
  /** Qual template de workflow usar (V1 = GGUF/7 steps; V2 = fp8/4 steps). */
  flow: "v1" | "v2";
  /** Créditos por segundo de áudio (arredondado pra cima). */
  creditsPerSecond: number;
  /** Resolução de saída (vertical, múltiplos que o fluxo aceita). */
  width: number;
  height: number;
  /** Arquivos no Network Volume usados pelo workflow (só o fluxo V1 injeta;
   *  no V2 os modelos já estão fixos no template). */
  ggufModel: string;
  lora: string;
};

export const CLONE_TIERS: readonly CloneTier[] = [
  {
    id: "480p",
    label: "Padrão",
    blurb: "Equilíbrio entre qualidade e custo. Ótimo pra redes sociais.",
    flow: "v1",
    creditsPerSecond: 250,
    width: 640,
    height: 850,
    ggufModel: "wan2.1-i2v-14b-480p-Q5_K_M.gguf",
    lora: "lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors",
  },
  {
    id: "480p-v2",
    label: "Turbo",
    blurb: "Motor novo: gera mais rápido, com cores e movimento mais consistentes.",
    flow: "v2",
    creditsPerSecond: 250,
    width: 480,
    height: 832,
    // Modelos fixos no template V2 (fp8 + rank128) — campos não usados.
    ggufModel: "",
    lora: "",
  },
  {
    id: "720p",
    label: "HD",
    blurb: "Mais nitidez e detalhe. Ideal pra anúncios.",
    flow: "v1",
    creditsPerSecond: 625,
    width: 960,
    height: 1280,
    ggufModel: "wan2.1-i2v-14b-720p-Q5_K_M.gguf",
    lora: "lightx2v_I2V_14B_720p_cfg_step_distill_rank64.safetensors",
  },
] as const;

/** Teto de duração do áudio (igual ao upload de voz do wizard). */
export const CLONE_MAX_AUDIO_SECONDS = 90;
/** Cobrança mínima (áudios muito curtos ainda pagam o setup da GPU). */
export const CLONE_MIN_BILLED_SECONDS = 5;
/** FPS do fluxo (InfiniteTalk/Wan 2.1). */
export const CLONE_FPS = 25;
/** Menor custo possível — gate da página (1s não existe; mínimo 5s no Padrão). */
export const CLONE_MIN_CREDITS =
  CLONE_MIN_BILLED_SECONDS * Math.min(...CLONE_TIERS.map((t) => t.creditsPerSecond));

export function getCloneTier(id: string | null | undefined): CloneTier | null {
  return CLONE_TIERS.find((t) => t.id === id) ?? null;
}

/** Créditos cobrados por um áudio de `seconds` no tier dado. */
export function cloneCreditsCost(tier: CloneTier, seconds: number): number {
  const billed = Math.max(CLONE_MIN_BILLED_SECONDS, Math.ceil(seconds));
  return billed * tier.creditsPerSecond;
}
