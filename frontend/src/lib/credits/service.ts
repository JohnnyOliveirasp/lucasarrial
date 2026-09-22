/**
 * Camada de serviço de créditos. Envolve as funções atômicas do Postgres
 * (debit_credits / grant_subscription_credits / add_extra_credits) — toda a
 * lógica de saldo e concorrência vive no banco; aqui só chamamos via RPC.
 *
 * Usar SEMPRE no servidor (service_role). NUNCA no client.
 */
import { getAdmin } from "@/lib/db/admin";
import { destravarAvisoDeCredito } from "@/lib/voices/destravar-aviso-credito";
import { montarAvisoDebitoFalho } from "./debito-onboarding-falho";

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

  // ⚠️ Os dois retornos `ok:false` daqui eram MUDOS, e os dois chamadores
  // (`onboarding/treino.ts`, `onboarding/avatares.ts`) descartavam o retorno.
  // Como o material é entregue ANTES do débito, a combinação entregava o
  // clone, não cobrava, não gravava linha no razão e não deixava rastro —
  // dívida invisível. Pior, o `error.message` da RPC era descartado inteiro,
  // então "error" não dizia se foi timeout, permissão ou função ausente.
  // Este log é o sensor que faltava (mesmo papel do aviso de `went_negative`
  // logo abaixo). NÃO é trava: travar aqui reverteria a decisão do Johnny de
  // 21/08. Ver `debito-onboarding-falho.ts` para a medição que delimita o
  // alcance real disto.
  if (error) {
    console.error(
      montarAvisoDebitoFalho({
        userId: args.userId,
        amount: args.amount,
        kind: args.kind,
        refType: args.refType,
        refId: args.refId,
        reason: "error",
        detalhe: error.message,
      }),
    );
    return { ok: false, reason: "error", balance: 0 };
  }

  const r = (data ?? {}) as RpcResult & { went_negative?: boolean };
  if (r.ok) {
    // O negativo é AUTORIZADO aqui (mig 88) — mas nunca deveria ser SILENCIOSO.
    // Ele só é sadio sob a premissa de que os 100k da assinatura chegam depois
    // e absorvem a dívida. Quando a premissa falha, o aluno fica impedido e
    // ninguém fica sabendo: foi assim que 14 perfis do SGP chegaram a -10.525
    // sem disparar nada (medido 09/09). Este log é o sensor que faltava.
    //
    // ⚠️ NÃO é uma trava: travar aqui reverteria a decisão do Johnny de 21/08
    // para o fluxo da PLANILHA, onde o negativo é adiantamento legítimo. A
    // trava de verdade seria no `debit_credits_onboarding` (SQL) e exige
    // migration + decisão de negócio.
    if (r.went_negative === true) {
      console.error(
        `[credits] onboarding deixou saldo NEGATIVO: user=${args.userId} ` +
          `saldo=${r.balance ?? 0} amount=-${args.amount} kind=${args.kind} ` +
          `ref=${args.refType ?? "-"}:${args.refId ?? "-"} — ` +
          `só é sadio se a assinatura vier depois e absorver a dívida.`,
      );
    }
    return { ok: true, balance: r.balance ?? 0, wentNegative: r.went_negative === true };
  }
  const reason = r.reason === "no_profile" ? "no_profile" : "error";
  console.error(
    montarAvisoDebitoFalho({
      userId: args.userId,
      amount: args.amount,
      kind: args.kind,
      refType: args.refType,
      refId: args.refId,
      reason,
      // A RPC respondeu; o detalhe útil aqui é o que ELA disse, não um erro
      // de transporte (que já foi tratado acima).
      detalhe: r.reason && r.reason !== reason ? `rpc_reason=${r.reason}` : null,
    }),
  );
  return { ok: false, reason, balance: r.balance ?? 0 };
}

/**
 * QUANTO DESTE TREINO AINDA NÃO FOI DEVOLVIDO? Olha o extrato INTEIRO, não o
 * perfil do aluno — e não só a perna do débito.
 *
 * As linhas procuradas são as que `start-training` e `onboarding/treino.ts`
 * gravam com o MESMO shape (`kind='training'`, `ref_type='voice'`,
 * `ref_id=<voiceId>`, `amount` negativo) e as que o estorno grava
 * (`ref_type='voice_train_refund'`, mesmo `ref_id`) — é justamente essa
 * igualdade de shape que os arquivos documentam como contrato.
 *
 * Existe porque `bypassesBilling` deixou de ser um proxy confiável de "houve
 * cobrança": o onboarding do SGP entrega treino SEM debitar. Inferir cobrança
 * a partir de quem é o aluno passaria a CONCEDER crédito em vez de devolver.
 *
 * ⚠️ POR QUE É SALDO E NÃO EXISTÊNCIA (incidente #469). Até 22/09 esta pergunta
 * era `houveDebitoDeTreino` — de EXISTÊNCIA ("há débito?"). Existência não se
 * gasta: quando o treino da MESMA voz falha duas vezes ela responde `true` nas
 * DUAS, e a casa estorna 10.000 contra um débito de 10.000 que já tinha sido
 * estornado. Medido em produção na voz `600173a6` (18/09): 1 débito de −10.000
 * às 14:43:26Z e DOIS estornos de +10.000 (14:44:28Z e 15:31:18Z) — 10.000
 * créditos criados do nada, e a guarda que existia pra impedir exatamente isso
 * passou batido porque perguntava a coisa errada. Saldo SE GASTA: o segundo
 * estorno encontra 0 e não acontece. A simetria de 17/08 documentada em
 * `onboarding-cobranca.ts` fica intacta — a decisão continua saindo do extrato.
 *
 * Conservador no erro: se qualquer das duas consultas falhar, responde `0`
 * (não estorna). Deixar de devolver é reclamação que o suporte resolve;
 * conceder crédito que nunca saiu é dinheiro criado do nada e ninguém percebe.
 * ⚠️ Nunca inverta para "na dúvida, devolve" — e repare que o erro perigoso é
 * o da perna dos ESTORNOS: sem saber o que já voltou, devolver é apostar.
 */
export async function saldoDeTreinoPendente(
  userId: string,
  voiceId: string,
): Promise<number> {
  const admin = getAdmin();

  const { data: debitos, error: errDeb } = await admin
    .from("credit_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("kind", "training")
    .eq("ref_type", "voice")
    .eq("ref_id", voiceId)
    .lt("amount", 0);
  if (errDeb) {
    console.error("[credits] saldoDeTreinoPendente/debitos falhou:", errDeb.message);
    return 0;
  }

  const { data: estornos, error: errEst } = await admin
    .from("credit_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("ref_type", "voice_train_refund")
    .eq("ref_id", voiceId)
    .gt("amount", 0);
  if (errEst) {
    console.error("[credits] saldoDeTreinoPendente/estornos falhou:", errEst.message);
    return 0;
  }

  const cobrado = (debitos ?? []).reduce((s, l) => s + Math.abs(Number(l.amount) || 0), 0);
  const devolvido = (estornos ?? []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  return Math.max(0, cobrado - devolvido);
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
