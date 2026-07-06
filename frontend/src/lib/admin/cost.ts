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
// Custos Kie (imagens + clipes de vídeo). Regra travada: créditos cobrados do
// usuário = 2× o custo do Kie em créditos Kie → custo Kie = créditos/2.
// Kie vende crédito a US$0,005 (kie.ai/pricing).
// ---------------------------------------------------------------------------

/** Câmbio usado pra converter custo Kie (US$) em R$. Ajustar quando variar. */
export const USD_BRL = 5.5;

/** Preço do crédito Kie em US$ (kie.ai/pricing). */
export const KIE_USD_PER_CREDIT = 0.005;

/** Créditos cobrados do usuário por imagem, por resolução (kie/config.ts). */
export const IMAGE_CREDITS_BY_RES: Record<string, number> = { "1K": 12, "2K": 22, "4K": 30 };

/** Custo Kie em R$ a partir dos créditos cobrados do usuário (regra 2×). */
export function kieCostBrlFromUserCredits(userCredits: number): number {
  return (userCredits / 2) * KIE_USD_PER_CREDIT * USD_BRL;
}

/** Custo Kie em R$ de um lote de imagens agrupado por resolução. */
export function imagesCostBrl(byRes: Array<{ resolution: string; n: number }>): number {
  return byRes.reduce(
    (sum, r) => sum + kieCostBrlFromUserCredits((IMAGE_CREDITS_BY_RES[r.resolution] ?? 12) * r.n),
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
  /** RunPod Network Volume (HD dos modelos). */
  runpodStorage: 15,
} as const;

export const INFRA_TOTAL_USD_MONTH = INFRA_USD_MONTH.hetzner + INFRA_USD_MONTH.runpodStorage;

/** Infra em R$ pró-rateada: dia ≈ mensal/30,44; mês ≈ cheio; ano = 12×. */
export function infraCostBrl(rangeDays: number): number {
  return INFRA_TOTAL_USD_MONTH * USD_BRL * (rangeDays / 30.4375);
}
