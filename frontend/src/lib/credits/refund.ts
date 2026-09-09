/**
 * Estorno zera o crédito de mensalidade — regra do Johnny 18/08:
 * quem pediu o dinheiro de volta (refund/chargeback/protesto) não fica com o
 * crédito; quem pagou e CANCELOU mantém. credits_extra NUNCA é tocado (nesse
 * grupo é reembolso por falha nossa/cortesia — dívida nossa com o aluno).
 *
 * Toda a decisão de saldo é atômica no banco (zero_subscription_credits_on_refund,
 * mig 108): row lock no profile + o próprio lançamento no livro-razão como
 * marcador de idempotência (user_id + ref_type='estorno' + ref_id=transação).
 * Evento reentregue não lança duas vezes; recompra DEPOIS do estorno não é
 * apagada por reprocessamento do evento antigo.
 *
 * Chamado pelo webhook da Hotmart SÓ nos eventos de dinheiro devolvido.
 * Server-only (service_role). NUNCA importar no client.
 */
import { getAdmin } from "@/lib/db/admin";

export type RefundZeroSummary =
  | { ok: true; already_processed: boolean; debited: number; balance?: number }
  | { ok: false; reason: string };

/**
 * Zera credits_subscription do usuário por dinheiro devolvido.
 * Falha de RPC LANÇA — o webhook responde 500 e a Hotmart reenvia (seguro:
 * a função é idempotente). Resposta com ok:false (ex.: no_profile) NÃO lança;
 * o caller registra em payment_events.error (reenviar não resolveria).
 */
export async function zeroSubscriptionCreditsOnRefund(args: {
  userId: string;
  refId: string;
  eventType: string;
}): Promise<RefundZeroSummary> {
  const { data, error } = await getAdmin().rpc("zero_subscription_credits_on_refund", {
    p_user_id: args.userId,
    p_ref_id: args.refId,
    p_event_type: args.eventType,
  });
  if (error) throw new Error(`zero_subscription_credits_on_refund: ${error.message}`);
  const r = data as Partial<RefundZeroSummary> | null;
  if (!r || typeof r.ok !== "boolean") {
    throw new Error(
      `zero_subscription_credits_on_refund devolveu resposta inesperada: ${JSON.stringify(data)}`,
    );
  }
  return r as RefundZeroSummary;
}
