/**
 * Quem recebe o crédito mensal quando a cobrança da assinatura chega — a
 * decisão que o webhook errava.
 *
 * POR QUE ESTE ARQUIVO EXISTE (medido em 21/09/2026):
 * O webhook da Hotmart (route.ts) resolvia o dono da compra SÓ pelo
 * `buyer_email` (`resolveUserIdByEmail`). Quando o aluno compra com um e-mail
 * e cria a conta com OUTRO (empresa × pessoal), esse lookup devolve NULL e o
 * crédito do ciclo era PULADO — mesmo com o vínculo certo já gravado em
 * `entitlements.user_id` (feito à mão, pelo claim do login, ou pela
 * reconciliação). O dado certo estava no banco e o código não olhava pra ele.
 *
 * O contraste que denuncia o bug: `claim.ts` (resgate no login) busca os
 * entitlements por `user_id` — o caminho do LOGIN usa o vínculo. Só o caminho
 * do PAGAMENTO usava e-mail.
 *
 * Consequência medida em 21/09: 6 assinantes ATIVOS com buyer_email ≠ e-mail
 * da conta; em 4 o ciclo pago atual não foi creditado; 2 (Marcio Fernandes,
 * trx HP1509025099, e Fernanda Franzolin, trx HP0304698101) pagaram um mês
 * inteiro com ZERO linha no ledger — logaram uma vez, viram a conta vazia e
 * nunca mais voltaram. E o `avisarCompraOrfa` disparava "compra paga SEM
 * conta" para cliente com conta ativa e vinculada: alarme com diagnóstico
 * errado gastando humano.
 *
 * A regra, em uma frase: **o e-mail resolve primeiro; quando não resolve, o
 * dono do entitlement da MESMA assinatura resolve; só é órfã de verdade quando
 * NENHUM dos dois existe.**
 *
 * O que este arquivo NÃO muda (de propósito):
 *  - A chave de idempotência do crédito continua sendo a TRANSAÇÃO
 *    (`transactionId ?? externalId`). Na assinatura o externalId é o código do
 *    assinante e é o MESMO em toda renovação — usá-lo como chave faria a
 *    cobrança de setembro parecer repetição da de julho e o aluno pagaria sem
 *    receber nada. A deduplicação em si é do RPC `grant_subscription_credits`
 *    (dedupe por refId): reentrega do MESMO evento gera o MESMO refId e não
 *    credita duas vezes.
 *  - Crédito só no PURCHASE_APPROVED (decisão de 10/08): o COMPLETE da mesma
 *    cobrança chega ~7,8 dias depois e creditar nos dois dava 2 lotes por
 *    pagamento (484 cobranças medidas em dobro).
 *
 * Mora num arquivo próprio, sem nenhum import, de propósito: `route.ts`
 * importa por alias (`@/lib/...`), que o runner nativo não resolve sem loader
 * — mesma limitação documentada em `vinculo.ts`. Aqui a decisão fica sob teste
 * de verdade em vez de sob leitura de fonte.
 */

export type CreditoDaAssinatura = {
  /** quem é o dono do ciclo (recebe crédito/bônus). NULL = ninguém conhecido. */
  userId: string | null;
  /** true = chamar grantSubscriptionCredits para `userId` com `refId`. */
  creditar: boolean;
  /** chave de idempotência do crédito — SEMPRE a transação quando ela existe. */
  refId: string;
  /** true = compra órfã DE VERDADE (nem e-mail nem entitlement têm dono). */
  avisarOrfa: boolean;
};

/**
 * Decide o destino do crédito mensal de um evento de compra da assinatura.
 *
 * @param eventType            evento da Hotmart (só PURCHASE_APPROVED credita)
 * @param userIdDoEmail        dono achado pelo buyer_email (NULL = não achou)
 * @param userIdDoEntitlement  `entitlements.user_id` da MESMA assinatura
 *                             (mesmo provider + external_id; NULL = órfã)
 * @param transactionId        transação da cobrança (chave do crédito)
 * @param externalId           código do assinante (fallback de refId; NUNCA
 *                             preferido à transação — ver cabeçalho)
 */
export function decidirCreditoDaAssinatura(input: {
  eventType: string;
  userIdDoEmail: string | null;
  userIdDoEntitlement: string | null;
  transactionId: string | null;
  externalId: string;
}): CreditoDaAssinatura {
  // String vazia vinda de linha corrompida é ausência, não dono (mesma guarda
  // de `donoDoEntitlement` em vinculo.ts).
  const doEmail = input.userIdDoEmail || null;
  const doEntitlement = input.userIdDoEntitlement || null;

  // E-mail primeiro (comportamento de sempre, preservado); o entitlement só
  // entra quando o e-mail não resolve — ele ADICIONA um caminho, não troca a
  // titularidade de quem o e-mail já resolvia.
  const userId = doEmail ?? doEntitlement;

  return {
    userId,
    creditar: userId !== null && input.eventType === "PURCHASE_APPROVED",
    refId: input.transactionId || input.externalId,
    avisarOrfa: userId === null,
  };
}
