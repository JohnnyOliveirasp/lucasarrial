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
