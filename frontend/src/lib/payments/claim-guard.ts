/**
 * Quando o layout do /app deve chamar `claimPurchasesOnLogin` — incidente #283
 * (cced114f), medido em 06/09/2026.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O `claim` é o ÚNICO caminho que concede a recarga do ciclo a quem o webhook
 * da Hotmart não creditou. Ele tinha dois pontos de entrada e os dois deixavam
 * passar uma classe real de pagante:
 *
 *   1. `app/[locale]/app/layout.tsx` só chamava quando
 *      `!profile || !profile.plan || plan === 'free'` — isso detecta ACESSO
 *      faltando, nunca CRÉDITO faltando. Conta com `plan='pro'` e saldo 0
 *      nunca mais era resgatada.
 *   2. `auth/callback/route.ts` chama sem guarda, mas só é atravessado por
 *      OAuth/magic-link. Quem já tem senha entra por e-mail+senha e nunca
 *      passa por lá.
 *
 * Caso que provou: `gestao@qooqi.com.br`, pagante confirmado, ficou com
 * `plan='pro'` e ZERO crédito de 21/07 a 06/09 — 47 dias. Mais 8 contas do
 * lote SGP de 04/09 caíram no mesmo buraco (restituídas na mão).
 *
 * A ARMADILHA QUE ESTA REGRA EVITA
 * "Saldo 0" sozinho NÃO significa "nunca recebeu": o aluno que recebeu os
 * 100.000 do ciclo e GASTOU legitimamente também chega a 0. Se o gatilho fosse
 * só o saldo, esse aluno chamaria o `claim` em TODA renderização do /app (o
 * layout roda em cada page load) — o `claim` é idempotente, então não credita
 * em dobro, mas o custo e a latência seriam permanentes e inúteis.
 *
 * O que separa os dois casos é a EXISTÊNCIA de qualquer linha
 * `credit_transactions.kind = 'subscription_grant'` para o usuário: quem
 * recebeu tem ao menos uma (a RPC `grant_subscription_credits` sempre grava);
 * quem nunca recebeu não tem nenhuma. Por isso a decisão é assíncrona — mas a
 * consulta é INJETADA e só é chamada no ramo de saldo zero, o que mantém o
 * caminho comum (99% dos page loads) sem query nenhuma.
 *
 * Módulo puro de propósito (sem imports): dá pra testar com `node --test` sem
 * banco. Rodar:  node --test src/lib/payments/claim-guard.test.ts
 */

/** O recorte de `profiles` que a decisão usa — já vem no select do layout. */
export type PerfilParaResgate = {
  plan: string | null;
  credits_subscription: number | null;
  credits_extra: number | null;
} | null | undefined;

/** Saldo total (assinatura + extra), tratando NULL como 0. */
export function saldoTotal(profile: PerfilParaResgate): number {
  return (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
}

/**
 * Guarda original: sem perfil, sem plano ou plano `free` = acesso faltando.
 * Caso dreduardosilva (22/07, 6 dias travado). Não custa query.
 */
export function semPlanoPago(profile: PerfilParaResgate): boolean {
  return !profile || !profile.plan || profile.plan === "free";
}

export type DecisaoResgate = {
  profile: PerfilParaResgate;
  /** `bypassesBilling(email)`: equipe/admin não consome crédito — saldo 0 neles é decorativo. */
  bypassaCobranca: boolean;
  /**
   * Já existe alguma `credit_transactions` com `kind='subscription_grant'`
   * para este usuário? Só é chamada no ramo de saldo zero. Em caso de erro o
   * chamador deve responder `true` (falha fechada: na dúvida, não resgata).
   */
  jaRecebeuRecarga: () => Promise<boolean>;
};

/**
 * Deve chamar `claimPurchasesOnLogin` agora?
 *
 * Ordem pensada pra fazer o mínimo de trabalho possível — os três primeiros
 * ramos decidem sem tocar no banco:
 *   1. sem plano pago            → SIM  (guarda original)
 *   2. equipe/admin              → NÃO
 *   3. tem saldo                 → NÃO  (caminho comum)
 *   4. plano pago + saldo 0      → SIM só se NUNCA houve recarga (1 consulta)
 */
export async function precisaResgatarCompras({
  profile,
  bypassaCobranca,
  jaRecebeuRecarga,
}: DecisaoResgate): Promise<boolean> {
  if (semPlanoPago(profile)) return true;
  if (bypassaCobranca) return false;
  if (saldoTotal(profile) > 0) return false;
  return !(await jaRecebeuRecarga());
}
