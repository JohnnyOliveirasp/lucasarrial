/**
 * Constantes do sistema de créditos. Valores de negócio travados em 2026-06-08.
 * (1 crédito = 1 caractere, espaços e pontuação contam — igual ElevenLabs.)
 */

/** Créditos recarregados a cada ciclo da assinatura (R$97/mês). */
export const PLAN_MONTHLY_CREDITS = 100_000;

/** Custo de clonar/treinar uma voz. */
export const TRAINING_CREDIT_COST = 10_000;

/** Mínimo cobrado por geração (cobre o cold-start da GPU serverless). */
export const GENERATION_MIN_CREDITS = 400;

/**
 * Vídeo Estúdio F0 — limpeza de áudio (whisper + edição na GPU).
 * Preço F5 (método Vídeo Clone): custo GPU medido ~R$0,15/job × margem 2×
 * ≈ R$0,30 → 550 créditos. Estorno automático em falha. Os demais preços
 * do Estúdio ficam em lib/studio/pricing.ts.
 */
export const STUDIO_CLEAN_COST = 550;

/** Custo em créditos de uma geração = nº de caracteres, com piso. */
export function generationCreditCost(text: string): number {
  return Math.max(GENERATION_MIN_CREDITS, text.length);
}

/**
 * Pacotes de créditos avulsos — vendidos via STRIPE (pagamento único).
 * Definidos inline aqui (preço em centavos de BRL); o Stripe usa price_data
 * dinâmico, então NÃO é preciso cadastrar produtos no painel do Stripe.
 * Regra de preço: sempre acima de R$0,54/mil (preço da assinatura) p/ não
 * canibalizar — ver [[project-credits-model]].
 */
export type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  priceCents: number; // em centavos de BRL (R$19 = 1900)
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "p25", label: "+25.000 créditos", credits: 25_000, priceCents: 1_900 },
  { id: "p60", label: "+60.000 créditos", credits: 60_000, priceCents: 4_200 },
  { id: "p120", label: "+120.000 créditos", credits: 120_000, priceCents: 7_800 },
];

export function findCreditPackage(id: string): CreditPackage | null {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}
