/**
 * Motor do estorno idempotente POR CONTAGEM — extraído de
 * `lib/support/failure-alert.ts` (22/09, card do react_refund) SEM mudança de
 * comportamento, para poder ser testado sem subir o Next: o client do banco e
 * o creditador entram por parâmetro. Produção passa `getAdmin()` e
 * `addExtraCredits` (a RPC `add_extra_credits` — mexe no saldo E grava a linha
 * do extrato numa transação só; INSERT na mão em `credit_transactions` NÃO
 * mexe no saldo e cria extrato que não bate). Teste passa fakes
 * (`lib/react/estorno.test.ts`).
 *
 * A regra (a mesma que sempre viveu no failure-alert): devolve enquanto houver
 * mais débitos que estornos no par (ref_id) — fluxos com refId único por
 * tentativa estornam 1x por falha, e evento reentregue (webhook repetido,
 * corrida de polls) não devolve duas vezes. Quem não foi cobrado
 * (equipe/admin via bypassesBilling) não tem débito no extrato → nada a
 * devolver.
 *
 * ⚠️ O VALOR sai do DÉBITO no extrato, nunca é recalculado da tabela de preço:
 * se o débito foi só a taxa fixa (HeyGen no React: 300, porque o vídeo sai da
 * conta do próprio aluno), devolve 300 — recalcular por `custoDoReact` pagaria
 * segundos que nunca foram cobrados. Extrato é a verdade; preço é intenção.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** Assinatura de `addExtraCredits` (lib/credits/service.ts) — o creditador real. */
export type Creditar = (args: {
  userId: string;
  amount: number;
  refType?: string;
  refId?: string;
}) => Promise<{ ok: boolean; balance: number }>;

export async function estornarDebitoIdempotente(
  deps: { db: SupabaseClient<Database>; creditar: Creditar },
  args: { userId: string; refId: string; debitRefType: string; refundRefType: string },
): Promise<string> {
  const { data: debits, count: debitCount } = await deps.db
    .from("credit_transactions")
    .select("amount", { count: "exact" })
    .eq("user_id", args.userId)
    .eq("ref_type", args.debitRefType)
    .eq("ref_id", args.refId)
    .lt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(1);
  const debit = (debits as { amount: number }[] | null)?.[0];
  if (!debit) return "nada cobrado (sem débito no extrato)";

  const { count: refundCount } = await deps.db
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", args.userId)
    .eq("ref_type", args.refundRefType)
    .eq("ref_id", args.refId);
  if ((refundCount ?? 0) >= (debitCount ?? 1)) return "estorno já aplicado anteriormente";

  const amount = Math.abs(debit.amount);
  const r = await deps.creditar({
    userId: args.userId,
    amount,
    refType: args.refundRefType,
    refId: args.refId,
  });
  return r.ok
    ? `estorno de ${amount.toLocaleString("pt-BR")} créditos aplicado automaticamente`
    : "ESTORNO FALHOU — aplicar manualmente!";
}
