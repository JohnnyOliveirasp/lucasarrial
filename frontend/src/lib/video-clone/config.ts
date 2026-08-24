/**
 * Vídeo Clone (lip-sync InfiniteTalk no NOSSO RunPod serverless).
 * Preço por SEGUNDO de áudio. REPRECIFICADO 2026-07-09 (Johnny): margem alvo
 * ~100% (2× o custo de GPU) pra ficar competitivo com HeyGen-likes.
 * Custos medidos (L40S US$0,99/h, ~1,05s GPU/frame no V1; V2/V3 = 4 steps ≈ 0,6×):
 * V1 480p ≈ R$0,045/s áudio · V2/V3 ≈ R$0,0275/s.
 * Crédito da plataforma = R$97/180.000 = R$0,000539.
 * REPRECIFICADO 08/08 (Johnny): Padrão 2.0 = 105 cr/s · Turbo = 80 cr/s
 * ("margem menor mas seguro o aluno").
 */

/** HD (720p) REMOVIDO 04/08 (decisão Johnny): preço ao aluno (465 cr/s)
 *  empatava com o varejo do HeyGen e o fluxo nunca rodou estável (3 falhas
 *  >45min com áudio longo). Jobs antigos no histórico mostram o id cru. */
export type CloneTierId = "480p" | "480p-v2" | "480p-v3";

export type CloneTier = {
  id: CloneTierId;
  label: string;
  blurb: string;
  /** Qual template de workflow usar (V1 = GGUF/7 steps; V2 = fp8/4 steps;
   *  V3 = fluxo InfiniteTalkV2 do Johnny, candidato a novo Padrão). */
  flow: "v1" | "v2" | "v3";
  /** Pré-produção: só admins veem/usam (some da UI e a API recusa). */
  adminOnly?: boolean;
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

/** Padrão V1 (GGUF/7 steps, 170 cr/s) APOSENTADO 08/08 (decisão Johnny):
 *  substituído pelo Padrão 2.0 (fluxo InfiniteTalkV2 dele, validado em
 *  pré-produção 07/08). Jobs antigos no histórico mostram o id cru "480p". */
export const CLONE_TIERS: readonly CloneTier[] = [
  {
    id: "480p-v3",
    label: "Padrão 2.0",
    blurb:
      "Novo motor padrão: repetível — a mesma foto com o mesmo áudio gera sempre o mesmo vídeo. Em áudios longos (acima de ~40s) o rosto pode se afastar da foto ao longo do vídeo: prefira vídeos curtos.",
    flow: "v3",
    creditsPerSecond: 105,
    width: 480,
    height: 832,
    // Modelos fixos no template V3 — campos não usados.
    ggufModel: "",
    lora: "",
  },
  {
    id: "480p-v2",
    label: "Turbo",
    blurb: "Opção econômica no mesmo motor: corta o vídeo exatamente no fim do áudio; cada geração varia um pouco.",
    flow: "v2",
    creditsPerSecond: 80,
    width: 480,
    height: 832,
    // Modelos fixos no template V2 (fp8 + rank128) — campos não usados.
    ggufModel: "",
    lora: "",
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

/**
 * Teto de execução do job no RunPod (policy.executionTimeout), dimensionado
 * pro PIOR caso medido nos logs de 2026-07-12: worker L40S frio ≈ 10min só
 * carregando modelos + V1 480p ≈ 2,5min por janela de ~72 frames (7 steps ×
 * ~19,5s/step). O default do endpoint (15min) matava QUALQUER áudio >20s no
 * V1 — e até jobs de 11s quando caíam num L40S frio. O teto é rede de
 * segurança, não meta — job saudável termina bem antes.
 */
export function cloneExecutionTimeoutMs(tier: CloneTier, seconds: number): number {
  const billed = Math.max(CLONE_MIN_BILLED_SECONDS, Math.ceil(seconds));
  // Segundos de GPU por segundo de áudio, com folga pra GPU mais lenta da fila.
  const perAudioSecond = tier.flow === "v1" ? 60 : 30;
  return (20 * 60 + billed * perAudioSecond) * 1000;
}
