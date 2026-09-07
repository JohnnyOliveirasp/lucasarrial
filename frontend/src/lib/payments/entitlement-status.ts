/**
 * Precedência de status do entitlement — decisão PURA (sem banco), pra existir
 * UM lugar só onde se responde "este evento pode sobrescrever o status atual?".
 *
 * BUG QUE ORIGINOU (apurado 28/08/2026, marlon@bianchitour.com — prova em
 * _frank/prova/2026-08-28_cancelamentos_de_27-08.md):
 *
 *   27/08 14:52  PURCHASE_PROTEST   -> entitlement vira "chargeback"
 *   28/08 07:13  PURCHASE_COMPLETE  -> rec#1 R$0, transação ANTIGA, subscription
 *                                      .status=CANCELED
 *                                      grantAccess regravou "active" e em
 *                                      seguida revokeAccess gravou "canceled"
 *
 * Resultado: a marca da CONTESTAÇÃO sumiu. Quem auditasse depois veria um
 * cancelamento comum. Nenhum payment_events.error foi gravado — do ponto de
 * vista do webhook "deu tudo certo". Webhook não chega em ordem, então a
 * proteção tem que ser por FORÇA do status, não por ordem de chegada.
 *
 * A regra: `refunded` e `chargeback` são TERMINAIS (o dinheiro voltou ou está
 * contestado) e não podem ser rebaixados por um evento mais fraco
 * ("canceled"/"expired"/"active"). A ÚNICA coisa que limpa um terminal é
 * dinheiro NOVO entrando de verdade — ver `resolveGrantStatus`.
 */
import type { EntitlementStatus } from "@/lib/db/types";

/**
 * Força do status, do mais fraco (acesso vivo) ao mais forte (dinheiro voltou).
 * Usado só pra desempatar dois terminais; a regra principal é `isTerminalStatus`.
 */
export const STATUS_RANK: Record<EntitlementStatus, number> = {
  active: 0,
  past_due: 1,
  expired: 2,
  canceled: 3,
  refunded: 4,
  chargeback: 5,
};

/**
 * Terminal = houve disputa de DINHEIRO (estorno feito ou contestação aberta).
 * É a marca que a auditoria precisa enxergar meses depois; apagá-la é perder
 * a prova. `expired`/`canceled` NÃO são terminais: são fim de ciclo normal e
 * podem ser sobrescritos à vontade.
 */
export function isTerminalStatus(status: EntitlementStatus): boolean {
  return status === "refunded" || status === "chargeback";
}

/**
 * Status a gravar num evento de REVOGAÇÃO (cancelamento, estorno, chargeback,
 * expiração), dado o que já está no banco.
 *
 * - sem entitlement ainda (current null) → o que chegou
 * - atual NÃO-terminal → o que chegou (comportamento de sempre)
 * - atual terminal + chegou não-terminal → MANTÉM o atual (é o bug do Marlon)
 * - atual terminal + chegou terminal → o de maior força (chargeback > refunded)
 */
export function resolveRevokeStatus(
  current: EntitlementStatus | null,
  incoming: Exclude<EntitlementStatus, "active">,
): EntitlementStatus {
  if (current === null) return incoming;
  if (!isTerminalStatus(current)) return incoming;
  if (!isTerminalStatus(incoming)) return current;
  return STATUS_RANK[incoming] > STATUS_RANK[current] ? incoming : current;
}

/**
 * Status a gravar num evento de COMPRA (grant), dado o que já está no banco.
 *
 * `newPayment` = este evento representa DINHEIRO NOVO confirmado. Hoje só o
 * PURCHASE_APPROVED com status pago é dinheiro novo; o PURCHASE_COMPLETE é o
 * eco da garantia vencendo ~7,8 dias depois da MESMA cobrança (é ele que
 * chegou 17h depois do protesto do Marlon e apagou a marca).
 *
 * Por que dinheiro novo LIMPA o terminal: se a pessoa contestou em agosto e
 * pagou de novo em setembro, travar o entitlement em "chargeback" deixaria
 * alguém pagando e sem receber nada — o pior desfecho possível, pior que
 * perder a marca. Terminal protege a prova, não vira punição perpétua.
 */
export function resolveGrantStatus(
  current: EntitlementStatus | null,
  newPayment: boolean,
): EntitlementStatus {
  if (current !== null && isTerminalStatus(current) && !newPayment) return current;
  return "active";
}
