/**
 * Camada de serviço de créditos. Envolve as funções atômicas do Postgres
 * (debit_credits / grant_subscription_credits / add_extra_credits) — toda a
 * lógica de saldo e concorrência vive no banco; aqui só chamamos via RPC.
 *
 * Usar SEMPRE no servidor (service_role). NUNCA no client.
 */
import { getAdmin } from "@/lib/db/admin";

export type Balance = {
  subscription: number;
  extra: number;
  total: number;
};

export type DebitResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "insufficient" | "no_profile" | "error"; balance: number };

type RpcResult = {
  ok: boolean;
  balance?: number;
  reason?: string;
};

/** Resolve o user_id pelo e-mail (lowercase). Usado pelo webhook de pagamento. */
export async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();
  return data?.id ?? null;
}

/** Saldo atual (assinatura + avulso). */
export async function getBalance(userId: string): Promise<Balance> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("credits_subscription, credits_extra")
    .eq("id", userId)
    .maybeSingle();
  const subscription = data?.credits_subscription ?? 0;
  const extra = data?.credits_extra ?? 0;
  return { subscription, extra, total: subscription + extra };
}

/**
 * Debita créditos de forma atômica (assinatura primeiro, depois avulso).
 * Retorna ok:false com reason 'insufficient' se não houver saldo — NÃO debita.
 */
export async function debitCredits(args: {
  userId: string;
  amount: number;
  kind: "generation" | "training" | "adjustment";
  refType?: string;
  refId?: string;
  note?: string;
}): Promise<DebitResult> {
  const { data, error } = await getAdmin().rpc("debit_credits", {
    p_user_id: args.userId,
    p_amount: args.amount,
    p_kind: args.kind,
    p_ref_type: args.refType ?? null,
    p_ref_id: args.refId ?? null,
    p_note: args.note ?? null,
  });
  if (error) return { ok: false, reason: "error", balance: 0 };

  const r = (data ?? {}) as RpcResult;
  if (r.ok) return { ok: true, balance: r.balance ?? 0 };
  const reason = r.reason === "insufficient" || r.reason === "no_profile" ? r.reason : "error";
  return { ok: false, reason, balance: r.balance ?? 0 };
}

/** Recarrega os créditos da assinatura (reset, não acumula). Chamar no ciclo aprovado. */
export async function grantSubscriptionCredits(args: {
  userId: string;
  amount: number;
  refType?: string;
  refId?: string;
}): Promise<{ ok: boolean; balance: number }> {
  const { data, error } = await getAdmin().rpc("grant_subscription_credits", {
    p_user_id: args.userId,
    p_amount: args.amount,
    p_ref_type: args.refType ?? null,
    p_ref_id: args.refId ?? null,
  });
  if (error) return { ok: false, balance: 0 };
  const r = (data ?? {}) as RpcResult;
  return { ok: r.ok, balance: r.balance ?? 0 };
}

/** Credita um pacote avulso (acumula, não expira). */
export async function addExtraCredits(args: {
  userId: string;
  amount: number;
  refType?: string;
  refId?: string;
}): Promise<{ ok: boolean; balance: number }> {
  const { data, error } = await getAdmin().rpc("add_extra_credits", {
    p_user_id: args.userId,
    p_amount: args.amount,
    p_ref_type: args.refType ?? null,
    p_ref_id: args.refId ?? null,
  });
  if (error) return { ok: false, balance: 0 };
  const r = (data ?? {}) as RpcResult;
  return { ok: r.ok, balance: r.balance ?? 0 };
}
