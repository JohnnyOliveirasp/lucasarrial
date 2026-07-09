/**
 * Modelo de custo/receita do SaaS (travado com o Lucas). Ver [[project-credits-model]].
 * Tudo em BRL. Server-only (usado nas métricas do /admin).
 */
export const PLAN_PRICE_BRL = 97;

export const COST = {
  /** Custo de geração por 1.000 caracteres (RunPod inferência). */
  GEN_PER_1K_CHARS_BRL: 0.13,
  /** Custo de treinar/clonar 1 voz (RunPod treino). */
  TRAIN_BRL: 2,
  /** Taxa Hotmart: 9,9% + R$1 por venda. */
  HOTMART_PCT: 0.099,
  HOTMART_FIXED_BRL: 1,
} as const;

export const PERIOD_DAYS = {
  day: 1,
  week: 7,
  fortnight: 15,
  month: 30,
} as const;

export type Period = keyof typeof PERIOD_DAYS;

export function genCostBrl(chars: number): number {
  return (chars / 1000) * COST.GEN_PER_1K_CHARS_BRL;
}

export function trainCostBrl(count: number): number {
  return count * COST.TRAIN_BRL;
}

/** Taxa Hotmart sobre um faturamento bruto com `sales` vendas. */
export function hotmartFeeBrl(grossBrl: number, sales: number): number {
  return grossBrl * COST.HOTMART_PCT + sales * COST.HOTMART_FIXED_BRL;
}

// ---------------------------------------------------------------------------
// Custos Kie (imagens + clipes de vídeo), calculados nos CRÉDITOS KIE reais
// de cada operação (não mais derivados do preço ao usuário — a regra antiga
// "créditos/2" morreu na reprecificação de 2026-07-08).
// Kie vende crédito a US$0,005 (kie.ai/pricing).
// ---------------------------------------------------------------------------

/** Câmbio usado pra converter custo Kie (US$) em R$. Ajustar quando variar. */
export const USD_BRL = 5.5;

/** Preço do crédito Kie em US$ (kie.ai/pricing). */
export const KIE_USD_PER_CREDIT = 0.005;

/** Custo REAL no Kie (em créditos Kie) por imagem, por resolução. */
export const KIE_IMAGE_CREDITS_BY_RES: Record<string, number> = { "1K": 6, "2K": 11, "4K": 15 };

/** Custo em R$ de N créditos Kie. */
export function kieCreditsCostBrl(kieCredits: number): number {
  return kieCredits * KIE_USD_PER_CREDIT * USD_BRL;
}

/** Custo Kie em R$ de um lote de imagens agrupado por resolução. */
export function imagesCostBrl(byRes: Array<{ resolution: string; n: number }>): number {
  return byRes.reduce(
    (sum, r) => sum + kieCreditsCostBrl((KIE_IMAGE_CREDITS_BY_RES[r.resolution] ?? 6) * r.n),
    0,
  );
}

// ---------------------------------------------------------------------------
// Vídeo Clone (InfiniteTalk no NOSSO RunPod serverless) — custo de GPU em R$
// por SEGUNDO DE ÁUDIO, por tier. Medidos 2026-07-09 (L40S US$0,99/h):
// V1 ~1,05s GPU/frame (7 steps); Turbo 4 steps ≈ 0,6×; 720p estimado 2,25×
// pixels (nunca medido — ajustar quando rodar o 1º HD real).
// ---------------------------------------------------------------------------
export const CLONE_COST_BRL_PER_AUDIO_SECOND: Record<string, number> = {
  "480p": 0.045,
  "480p-v2": 0.0275,
  "720p": 0.125,
};

/** Custo em R$ de um lote de Vídeo Clones agrupado por tier (seconds = soma). */
export function videoClonesCostBrl(byTier: Array<{ tier: string; seconds: number }>): number {
  return byTier.reduce(
    (sum, t) => sum + (CLONE_COST_BRL_PER_AUDIO_SECOND[t.tier] ?? 0.045) * t.seconds,
    0,
  );
}

// ---------------------------------------------------------------------------
// Custos fixos de infraestrutura (US$/mês) — pró-rateados pelo período visto.
// Ajustar aqui quando o plano mudar. Futuro: puxar o RunPod via API (GraphQL).
// ---------------------------------------------------------------------------
export const INFRA_USD_MONTH = {
  /** Servidor Hetzner (app + workers). */
  hetzner: 25,
  /** RunPod Network Volume (HD dos modelos InfiniteTalk, 80GB EU-NL-1 —
   *  crescido de 60 p/ 80GB em 2026-07-09 pros modelos do Turbo). */
  runpodStorage: 5.6,
} as const;

export const INFRA_TOTAL_USD_MONTH = INFRA_USD_MONTH.hetzner + INFRA_USD_MONTH.runpodStorage;

/** Infra em R$ pró-rateada: dia ≈ mensal/30,44; mês ≈ cheio; ano = 12×. */
export function infraCostBrl(rangeDays: number): number {
  return INFRA_TOTAL_USD_MONTH * USD_BRL * (rangeDays / 30.4375);
}
