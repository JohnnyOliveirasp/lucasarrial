/**
 * Trial vencido — regra do Johnny 18/08 (_frank/ordens/2026-08-18_regra_do_trial.md):
 * o trial dá os 100.000 créditos com VALIDADE de 10 dias (7 de teste + 3 de
 * carência). Sem pagamento de verdade até o dia 10, o crédito de MENSALIDADE
 * (credits_subscription) zera. credits_extra NUNCA é tocado. Classificação por
 * PESSOA (e-mail), MESMO critério do painel (admin_trial_stats, mig 63):
 * compra recurrence 1 com valor 0.
 *
 * Toda a decisão e a escrita são atômicas no banco (expire_trial_credits,
 * mig 80): o marcador em trial_credit_expirations dá idempotência — quem foi
 * resolvido sai da varredura pra sempre, e o débito só lança quando
 * credits_subscription > 0 depois do row lock. Rodar de novo é no-op barato.
 *
 * Chamado pelo sweep de 5min (sweep-clones), mesmo caminho da cortesia.
 * Server-only (service_role). NUNCA importar no client.
 */
import { getAdmin } from "@/lib/db/admin";

export type TrialExpirySummary = {
  ok: true;
  checked: number;
  zeroed: number;
  credits_zeroed: number;
  marked_paid: number;
  skipped_no_account: number;
  skipped_active_access: number;
};

/** Roda a varredura no banco e devolve o resumo. Falha LANÇA — quem chama decide como expor. */
export async function expireTrialCredits(): Promise<TrialExpirySummary> {
  const { data, error } = await getAdmin().rpc("expire_trial_credits");
  if (error) throw new Error(`expire_trial_credits: ${error.message}`);
  const s = data as Partial<TrialExpirySummary> | null;
  if (!s || s.ok !== true || typeof s.checked !== "number") {
    throw new Error(`expire_trial_credits devolveu resposta inesperada: ${JSON.stringify(data)}`);
  }
  return s as TrialExpirySummary;
}
