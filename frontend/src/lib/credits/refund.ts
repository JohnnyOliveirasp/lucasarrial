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
 * A migration 108 é ESPELHO: fica commitada e só entra no banco quando o Johnny
 * aprova o DDL (regra 21). Entre o merge deste código e a aplicação da migration
 * existe uma janela em que a função NÃO EXISTE — e é nela que mora a armadilha:
 * "função inexistente" é erro PERMANENTE, e tratá-lo como falha transitória faz
 * o webhook devolver 500 pra TODO estorno, a Hotmart reenviar em laço e o evento
 * nunca fechar (processed_at eterno em NULL).
 *
 * Então separamos os dois tipos de falha:
 *   - função ausente (42883 / PGRST202) → NÃO lança. Vira ok:false com motivo
 *     explícito, o caller grava em payment_events.error e o evento FECHA. O
 *     acesso já foi revogado normalmente; o que fica pendente é só o saldo.
 *   - qualquer outra falha (rede, lock, permissão) → LANÇA → 500 → a Hotmart
 *     reenvia, e reenviar de fato resolve (a função é idempotente).
 *
 * ⚠️ Enquanto a 108 não for aplicada, NENHUM crédito é zerado — só registrado.
 * O erro em payment_events.error é a lista do que precisa de acerto manual
 * depois que a migration subir; ele é a diferença entre "pendente e visível" e
 * o bug original, que era "não acontece e ninguém vê".
 */
const RPC_AUSENTE = new Set(["42883", "PGRST202"]);

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
  if (error) {
    if (RPC_AUSENTE.has(error.code ?? "")) {
      return {
        ok: false,
        reason:
          "migration 108 não aplicada no banco (zero_subscription_credits_on_refund não existe) " +
          "— crédito NÃO zerado, precisa de acerto manual depois que o DDL subir",
      };
    }
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
