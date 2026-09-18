/**
 * Estorno zera o crédito de mensalidade — regra do Johnny 18/08:
 * quem pediu o dinheiro de volta (refund/chargeback/protesto) não fica com o
 * crédito; quem pagou e CANCELOU mantém. credits_extra NUNCA é tocado (nesse
 * grupo é reembolso por falha nossa/cortesia — dívida nossa com o aluno).
 *
 * Toda a decisão de saldo é atômica no banco (zero_subscription_credits_on_refund,
 * scripts/111 — nasceu "mig 108" no PR #189 e foi RENUMERADA antes de entrar;
 * hoje a 108 é `emails_enviados`, então o ponteiro antigo mandava quem fosse
 * investigar ESTE incidente abrir o arquivo errado): row lock no profile + o
 * próprio lançamento no livro-razão como
 * marcador de idempotência (user_id + ref_type='estorno' + ref_id=transação).
 * Evento reentregue não lança duas vezes; recompra DEPOIS do estorno não é
 * apagada por reprocessamento do evento antigo.
 *
 * Chamado pelo webhook da Hotmart SÓ nos eventos de dinheiro devolvido.
 * Server-only (service_role). NUNCA importar no client.
 */
import { getAdmin } from "@/lib/db/admin";
// Decisão pura "este erro é 'função ausente'?" — mora fora daqui porque este
// módulo é server-only e o teste dela roda no `node --test` sem o alias `@/`.
import { MOTIVO_RPC_AUSENTE, RPC_ESTORNO, rpcFuncaoAusente } from "./refund-erro.ts";

export type RefundZeroSummary =
  | { ok: true; already_processed: boolean; debited: number; balance?: number }
  | { ok: false; reason: string };

/**
 * Zera credits_subscription do usuário por dinheiro devolvido.
 * Falha de RPC LANÇA — o webhook responde 500 e a Hotmart reenvia (seguro:
 * a função é idempotente). Resposta com ok:false (ex.: no_profile) NÃO lança;
 * o caller registra em payment_events.error (reenviar não resolveria).
 *
 * ⚠️ PONTE TEMPORÁRIA (#446) — a ÚNICA exceção ao "falha de RPC LANÇA": a
 * FUNÇÃO NÃO EXISTIR no banco não é falha transitória, e reenviar 5× contra uma
 * função ausente não a cria. O commit 0776768 (14/09) subiu este chamador sem a
 * DDL que cria a função (`scripts/111_estorno_zera_credito.sql`, parada
 * aguardando aval do Johnny porque mexe em dinheiro de aluno). Medido em
 * produção: 2 de 2 eventos de dinheiro devolvido desde 14/09 derrubaram o
 * webhook e ficaram com `processed_at` NULL pra sempre.
 * Nesse caso — e SÓ nesse, reconhecido de forma ESTREITA em `refund-erro.ts` —
 * devolvemos `ok:false` com `reason` `rpc_ausente:…`: o evento é processado, o
 * erro fica gravado em `payment_events.error` e o webhook avisa a casa.
 * Qualquer outro erro (rede, timeout, permissão, deadlock) CONTINUA LANÇANDO.
 * Quando a 111 for aplicada, este caminho vira código morto — remover.
 */
export async function zeroSubscriptionCreditsOnRefund(args: {
  userId: string;
  refId: string;
  eventType: string;
}): Promise<RefundZeroSummary> {
  const { data, error } = await getAdmin().rpc(RPC_ESTORNO, {
    p_user_id: args.userId,
    p_ref_id: args.refId,
    p_event_type: args.eventType,
  });
  if (error) {
    // PONTE #446: função ausente não lança (ver o bloco acima).
    if (rpcFuncaoAusente(error)) return { ok: false, reason: MOTIVO_RPC_AUSENTE };
    throw new Error(`zero_subscription_credits_on_refund: ${error.message}`);
  }
  const r = data as Partial<RefundZeroSummary> | null;
  if (!r || typeof r.ok !== "boolean") {
    throw new Error(
      `zero_subscription_credits_on_refund devolveu resposta inesperada: ${JSON.stringify(data)}`,
    );
  }
  return r as RefundZeroSummary;
}
