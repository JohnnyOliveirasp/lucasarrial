/**
 * Camada de serviço de créditos. Envolve as funções atômicas do Postgres
 * (debit_credits / grant_subscription_credits / add_extra_credits) — toda a
 * lógica de saldo e concorrência vive no banco; aqui só chamamos via RPC.
 *
 * Usar SEMPRE no servidor (service_role). NUNCA no client.
 */
import { getAdmin } from "@/lib/db/admin";
import { destravarAvisoDeCredito } from "@/lib/voices/destravar-aviso-credito";

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
  kind: "generation" | "training" | "image" | "video" | "adjustment";
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

/**
 * Débito EXCLUSIVO do onboarding pela planilha — pode deixar o aluno NEGATIVO.
 *
 * Decisão do Johnny (21/08): a linha da planilha chega antes de o aluno
 * assinar, e pela regra geral nada roda sem saldo. No onboarding a gente faz
 * mesmo assim; a dívida cai em `credits_extra` (sobrevive ao reset da
 * assinatura) e é descontada sozinha quando os 100k entrarem.
 *
 * ⚠️ NUNCA chamar fora de `lib/onboarding/`. A `debitCredits` normal mantém a
 * trava — é ela que segura o resto do sistema. RPC: migration 88.
 */
export async function debitCreditsOnboarding(args: {
  userId: string;
  amount: number;
  kind: "training" | "image";
  refType?: string;
  refId?: string;
  note?: string;
}): Promise<DebitResult & { wentNegative?: boolean }> {
  const { data, error } = await getAdmin().rpc("debit_credits_onboarding" as never, {
    p_user_id: args.userId,
    p_amount: args.amount,
    p_kind: args.kind,
    p_ref_type: args.refType ?? null,
    p_ref_id: args.refId ?? null,
    p_note: args.note ?? null,
  } as never);
  if (error) return { ok: false, reason: "error", balance: 0 };

  const r = (data ?? {}) as RpcResult & { went_negative?: boolean };
  if (r.ok) return { ok: true, balance: r.balance ?? 0, wentNegative: r.went_negative === true };
  return { ok: false, reason: r.reason === "no_profile" ? "no_profile" : "error", balance: r.balance ?? 0 };
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
  // ⚠️ O aviso de "você tem 0" fica gravado na voz e NAO se atualiza sozinho.
  // Aqui e o unico instante em que ele pode ter virado mentira. Nao lanca.
  if (r.ok) {
    await perdoarNegativoDoOnboarding(args.userId);
    await destravarAvisoDeCredito(args.userId, r.balance ?? 0);
  }
  return { ok: r.ok, balance: r.balance ?? 0 };
}

/**
 * QUEM ASSINA NÃO ENTRA DEVENDO (decisão do Johnny, 30/08/2026).
 *
 * O onboarding (planilha e agora o SGP) debita o material entregue — treino de
 * voz 10k + avatares 525 cada — e deixa o saldo NEGATIVO de propósito: o aluno
 * só usa a plataforma depois de assinar (mig 88). O buraco estava no encontro
 * das duas regras: `grant_subscription_credits` credita em
 * `credits_subscription`, e o negativo mora em `credits_extra`. Resultado: a
 * pessoa pagava R$97, recebia 100.000 e via **88.425** — "paguei e vieram menos
 * créditos", que é exatamente a reclamação que ninguém consegue responder bem.
 *
 * Medido em 30/08: 41 alunos da planilha travados nessa situação, 345.125
 * créditos no total (~R$186 a preço de venda). O saldo deles foi perdoado de
 * uma vez (`_Bugs/_correcoes/_perdoar_negativo_onboarding.cjs`); esta função é
 * a metade que impede o caso de voltar a nascer.
 *
 * Só zera o que está NEGATIVO e só quando a origem é o onboarding — não é
 * bônus: ninguém ganha crédito positivo por aqui. Best-effort de propósito:
 * falhar aqui não pode derrubar a liberação de uma assinatura paga.
 */
async function perdoarNegativoDoOnboarding(userId: string): Promise<void> {
  try {
    const admin = getAdmin();
    const { data: prof } = await admin
      .from("profiles")
      .select("credits_subscription, credits_extra")
      .eq("id", userId)
      .maybeSingle();
    const extra = (prof as { credits_extra?: number } | null)?.credits_extra ?? 0;
    if (extra >= 0) return;

    // A origem tem que ser o onboarding — negativo de outra causa não é nosso
    // pra perdoar, e virar regra cega aqui esconderia bug de cobrança.
    const { data: doOnboarding } = await admin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", userId)
      .ilike("note", "%onboarding%")
      .limit(1);
    if (!doOnboarding?.length) return;

    const subscription = (prof as { credits_subscription?: number } | null)?.credits_subscription ?? 0;
    const { error } = await admin
      .from("profiles")
      .update({ credits_extra: 0, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) return;

    await admin.from("credit_transactions").insert({
      user_id: userId,
      kind: "adjustment",
      amount: -extra,
      balance_after: subscription,
      ref_type: "perdao_negativo_onboarding",
      ref_id: userId,
      note:
        "Perdao do saldo negativo do onboarding no momento da assinatura " +
        "(decisao do Johnny, 30/08/2026): o material entregue no onboarding nao " +
        "pode ser descontado de quem acabou de pagar a mensalidade.",
    } as never);
    console.log(`[credits] negativo do onboarding perdoado ao assinar: ${userId} (+${-extra})`);
  } catch (e) {
    console.error("[credits] perdao do onboarding falhou:", e instanceof Error ? e.message : e);
  }
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
  // Mesma limpeza do grant: recarga/estorno tambem torna o aviso obsoleto.
  if (r.ok) await destravarAvisoDeCredito(args.userId, r.balance ?? 0);
  return { ok: r.ok, balance: r.balance ?? 0 };
}
