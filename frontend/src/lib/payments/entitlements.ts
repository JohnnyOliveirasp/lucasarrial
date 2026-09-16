/**
 * Concessão/revogação de acesso pago — compartilhado por todos os provedores
 * (hoje só Hotmart; Mercado Pago plugará aqui depois).
 *
 * Fonte da verdade = tabela `entitlements` (1 linha por compra/assinatura).
 * `profiles` guarda um CACHE (plan/access_until/access_source) pra o gate ser
 * rápido (middleware não precisa varrer entitlements a cada request).
 *
 * Mapeamento comprador↔usuário é por e-mail (lowercase). Se o e-mail da compra
 * não casar com nenhum usuário, o entitlement NASCE "órfão" (user_id NULL) e é
 * reconciliado quando o usuário aparecer (reconcileUserEntitlements).
 *
 * ⚠️ Órfã só NASCE órfã: o lookup por e-mail nunca DESVINCULA uma linha que já
 * tem dono (incidente #222 — ver a guarda em `grantAccess` e `vinculo.ts`).
 *
 * ⚠️ NENHUMA consulta daqui pode errar em silêncio (incidente #282). Até
 * 16/09 as SETE chamadas ao banco deste arquivo descartavam o `error` — e no
 * supabase-js consulta que ERRA volta com `data: null`. O pior caso não era
 * "não fez nada": era `recomputeProfileAccess` lendo com erro, entendendo
 * "este usuário não tem entitlement" e gravando `plan: "free"` no perfil de
 * quem PAGOU. Erro de LEITURA revogava acesso, e o webhook registrava sucesso
 * limpo por cima. Agora todo `error` passa por `exigirSucesso` (registra em
 * `audit` e LANÇA), e a decisão de acesso mora em `entitlements-pure.ts`, sob
 * teste, com uma saída explícita para "não sei" — que NÃO escreve nada.
 */
import { getAdmin } from "@/lib/db/admin";
import { logger } from "@/lib/logger/server";
import { donoDoEntitlement } from "@/lib/payments/vinculo";
import {
  entitlementDaPlataforma,
  produtosDeCurso,
} from "@/lib/payments/acesso-regra";
import { decidirAcessoDoPerfil } from "@/lib/payments/entitlements-pure";
import type {
  EntitlementStatus,
  EntitlementUpdate,
  Json,
  PaymentProvider,
} from "@/lib/db/types";

/** O `error` do supabase-js, no mínimo que este arquivo precisa enxergar. */
type ErroDeBanco = { message?: string | null; code?: string | null } | null;

/**
 * Erro de banco NUNCA passa batido: registra em `audit` (com o bastante pra
 * achar a pessoa depois) e LANÇA.
 *
 * Por que lançar, e não só registrar: o único caller de verdade de
 * `grantAccess`/`revokeAccess` é o webhook da Hotmart, que já trata exceção
 * corretamente — grava o erro em `payment_events.error`, devolve 500, deixa
 * `processed_at` NULL e reprocessa no reenvio (route.ts). Engolir aqui faria o
 * evento ser marcado como PROCESSADO COM SUCESSO sem ter feito nada, que é
 * exatamente como os casos do #282 sumiram. As duas operações são idempotentes,
 * então reprocessar é seguro.
 *
 * Do lado do login, quem chama é `claimPurchasesOnLogin`, que captura tudo por
 * fora (agora registrando) — o login continua não falhando por causa disto.
 */
function exigirSucesso(
  operacao: string,
  error: ErroDeBanco,
  meta: Record<string, unknown>,
): void {
  if (!error) return;
  const detalhe = error.message ?? "sem mensagem";
  logger.error("audit", `entitlements: ${operacao} falhou`, {
    ...meta,
    incidente: "#282",
    code: error.code ?? null,
    message: detalhe,
  });
  throw new Error(`entitlements: ${operacao} falhou: ${detalhe}`);
}

type GrantInput = {
  provider: PaymentProvider;
  buyerEmail: string;
  externalId: string; // assinatura (recorrente) OU transação (único)
  productCode?: string | null;
  offerCode?: string | null;
  accessUntil?: string | null; // ISO; NULL = vitalício (pagamento único)
  rawEvent?: unknown;
};

type RevokeInput = {
  provider: PaymentProvider;
  externalId: string;
  status: Exclude<EntitlementStatus, "active">;
  accessUntil?: string | null; // cancelamento recorrente: manter acesso até o fim do período já pago
  rawEvent?: unknown;
};

/** Libera/renova acesso. Idempotente por (provider, external_id). */
export async function grantAccess(input: GrantInput): Promise<void> {
  const admin = getAdmin();
  const email = input.buyerEmail.trim().toLowerCase();

  // ⚠️ O lookup por e-mail só ADICIONA dono, nunca REMOVE (incidente #222).
  //
  // Quando a compra foi feita com um e-mail que não tem perfil (comprou com um
  // e-mail, criou a conta com outro), `findUserIdByEmail` devolve NULL. Sem a
  // guarda abaixo o upsert gravava esse NULL POR CIMA do dono, desligando a
  // compra da conta no próximo evento da Hotmart daquela assinatura — e, como
  // `userId` ficava null, nem `recomputeProfileAccess` era chamado: o aluno
  // perdia o acesso em silêncio. Era isso que fazia o conserto manual desses
  // casos apodrecer sozinho, então a guarda tem que existir ANTES de vincular
  // órfã na mão.
  //
  // Não achar perfil para o e-mail da compra é ausência de informação, não é
  // a informação "esta compra não tem dono". A decisão mora em `vinculo.ts`,
  // sob teste (`vinculo.test.ts`).
  const userIdDoEmail = await findUserIdByEmail(email);
  let userId = userIdDoEmail;
  if (!userIdDoEmail) {
    const { data: atual, error } = await admin
      .from("entitlements")
      .select("user_id")
      .eq("provider", input.provider)
      .eq("external_id", input.externalId)
      .maybeSingle();
    // ⚠️ É AQUI que o #222 voltaria pela porta do erro: consulta que falha
    // devolve `atual = null`, `donoDoEntitlement(null, null)` devolve null, e o
    // upsert abaixo gravaria `user_id: NULL` POR CIMA do dono — desligando a
    // compra da conta por causa de um blip de rede. A guarda do #222 só protege
    // contra o lookup VAZIO; ela não tem como distinguir "não tem dono" de
    // "não consegui ler".
    exigirSucesso("leitura do dono atual", error, {
      provider: input.provider,
      externalId: input.externalId,
      buyerEmail: email,
    });
    userId = donoDoEntitlement(userIdDoEmail, atual?.user_id ?? null);
  }

  const { error: erroUpsert } = await admin.from("entitlements").upsert(
    {
      user_id: userId,
      buyer_email: email,
      provider: input.provider,
      product_code: input.productCode ?? null,
      offer_code: input.offerCode ?? null,
      external_id: input.externalId,
      status: "active",
      access_until: input.accessUntil ?? null,
      raw_event: (input.rawEvent ?? null) as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,external_id" },
  );
  // Escrita que falha e não lança faz o webhook responder "granted" sem ter
  // liberado nada — e a Hotmart nunca reenvia um evento que voltou 200.
  exigirSucesso("gravação do entitlement", erroUpsert, {
    provider: input.provider,
    externalId: input.externalId,
    buyerEmail: email,
    userId,
  });

  if (userId) await recomputeProfileAccess(userId);
}

export type RevokeResult = {
  /** false = externalId não casa com nenhum entitlement (o caller decide se é erro). */
  found: boolean;
  /** dono do entitlement revogado (null se órfão ou não encontrado). */
  userId: string | null;
};

/**
 * Revoga/suspende acesso. Idempotente.
 * Devolve found:true se um entitlement foi encontrado e atualizado; found:false
 * se o externalId não casa com nenhum (revoke antes do grant, OU id extraído
 * errado do payload — o caller decide se isso é erro e registra). userId vem
 * junto pro caller agir sobre a MESMA pessoa do entitlement (ex.: estorno
 * zera o crédito de mensalidade — mig 108).
 */
export async function revokeAccess(input: RevokeInput): Promise<RevokeResult> {
  const admin = getAdmin();
  const { data: existing, error } = await admin
    .from("entitlements")
    .select("id, user_id")
    .eq("provider", input.provider)
    .eq("external_id", input.externalId)
    .maybeSingle();

  // ⚠️ #282: sem esta linha, "a consulta falhou" e "não existe entitlement com
  // esse external_id" viravam a MESMA resposta (`found: false`) para o caller.
  // O webhook então gravava "externalId não casa com nenhum entitlement" em
  // `payment_events.error` — uma causa ERRADA, que manda o humano procurar
  // defeito na extração do id — e devolvia 200, então a Hotmart nunca
  // reenviava. Um estorno podia ficar sem revogar para sempre, com uma
  // explicação plausível e falsa no lugar.
  exigirSucesso("leitura do entitlement a revogar", error, {
    provider: input.provider,
    externalId: input.externalId,
    status: input.status,
  });

  if (!existing) return { found: false, userId: null }; // nenhum entitlement com esse external_id

  const patch: EntitlementUpdate = {
    status: input.status,
    raw_event: (input.rawEvent ?? null) as Json,
    updated_at: new Date().toISOString(),
  };
  // só sobrescreve access_until quando o caller especifica (cancelamento recorrente).
  if (input.accessUntil !== undefined) patch.access_until = input.accessUntil;

  const { error: erroUpdate } = await admin
    .from("entitlements")
    .update(patch)
    .eq("id", existing.id);
  // Revogação que não gravou não pode devolver `found: true`: o caller usa esse
  // true pra decidir zerar crédito de estorno (mig 108) e pra registrar
  // "revoked" como sucesso.
  exigirSucesso("gravação da revogação", erroUpdate, {
    provider: input.provider,
    externalId: input.externalId,
    status: input.status,
    entitlementId: existing.id,
    userId: existing.user_id ?? null,
  });

  if (existing.user_id) await recomputeProfileAccess(existing.user_id);
  return { found: true, userId: existing.user_id ?? null };
}

/**
 * Vincula entitlements órfãos (user_id NULL) ao usuário pelo e-mail e
 * recalcula o acesso. Chamar no login/callback ou no fluxo de "reivindicar".
 *
 * ⚠️ NÃO adota linha de produto de CURSO (#2d0509b4). O update era cego a
 * `product_code`: casava TODA órfã do e-mail, e o `recomputeProfileAccess`
 * logo abaixo transformava entitlement de curso em `plan=pro` + `access_until`
 * + crédito. Como os eventos de curso de 09/06 passaram pelo `grantAccess`
 * antes de existir o roteamento por produto, eles nasceram `active` com
 * `access_until` NULL — vitalício —, então quem comprou SÓ o curso ganhava a
 * plataforma PARA SEMPRE no primeiro login. Medido em 08/09: 15 linhas, 12
 * pessoas, 11 delas a um login de distância.
 *
 * A órfã de curso continua órfã de propósito: adotá-la sem contá-la no acesso
 * exigiria mexer no `recomputeProfileAccess`, e aí a próxima recomputação
 * RETIRARIA o vitalício de quem já está usando — que é decisão comercial
 * (honrar ou revogar os 15), não minha. Este conserto só fecha a torneira;
 * ele não mexe em ninguém que já tem acesso hoje.
 */
export async function reconcileUserEntitlements(
  userId: string,
  email: string,
): Promise<void> {
  const admin = getAdmin();
  const e = email.trim().toLowerCase();

  const { data: orfas, error } = await admin
    .from("entitlements")
    .select("id, product_code")
    .is("user_id", null)
    .ilike("buyer_email", e);

  // #282: leitura que falha devolve `orfas = null`, e o `?? []` abaixo
  // transformava isso em "este e-mail não tem compra órfã" — que é justamente o
  // modo de falha SILENCIOSO dos 7 pagantes do lote de 04/09 (a função voltava
  // normal e simplesmente não vinculava nada).
  exigirSucesso("leitura das órfãs do e-mail", error, { userId, email: e });

  const cursos = produtosDeCurso();
  const adotaveis = (orfas ?? [])
    .filter((o) => entitlementDaPlataforma(o.product_code, cursos))
    .map((o) => o.id);

  if (adotaveis.length > 0) {
    const { error: erroAdocao } = await admin
      .from("entitlements")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .in("id", adotaveis);
    // Sem isto, a adoção que falha é seguida de um `recomputeProfileAccess`
    // que (corretamente) não acha nada e deixa o pagante em `free` — com a
    // compra ainda órfã e ninguém sabendo. É o #282 de novo, um passo antes.
    exigirSucesso("adoção das órfãs", erroAdocao, {
      userId,
      email: e,
      entitlementIds: adotaveis,
    });
  }

  await recomputeProfileAccess(userId);
}

// ── helpers internos ────────────────────────────────────────────────────────

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await getAdmin()
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  // NULL aqui é lido como "a compra não tem dono" e cria entitlement ÓRFÃO
  // (que só um login futuro, ou um humano, religa). Se o NULL veio de uma
  // consulta que falhou, a compra de quem TEM conta nasce órfã por engano.
  exigirSucesso("busca do perfil pelo e-mail", error, { buyerEmail: email });
  return data?.id ?? null;
}

/**
 * A regra de "este entitlement dá acesso AGORA?" mora agora em `acesso-regra.ts`
 * — módulo PURO, zero import — e é re-exportada daqui pra ninguém precisar
 * trocar o import (08/09).
 *
 * Motivo da mudança de casa: ESTE arquivo importa `@/lib/db/admin`, o que
 * impedia `node --test` de tocar na regra. A frase mais cara da casa (quem
 * entra, quem tem crédito, quem recebe qual e-mail) era a única sem teste
 * próprio — e ela já foi lida errado duas vezes: em 20/08 (`canceled` perdia o
 * período já pago) e em 08/09 (o convite de compra órfã pulava `canceled`
 * dentro da janela paga). A regra em si NAO mudou: é byte a byte a de antes.
 */
export { entitlementValeAcesso } from "@/lib/payments/acesso-regra";

/**
 * Recalcula o cache de acesso no profile a partir dos entitlements do usuário.
 * Tem acesso quem possui ≥1 entitlement 'active' não expirado
 * (access_until NULL = vitalício).
 *
 * ⚠️ ESTE ERA O PIOR CASO DO #282, e ele REBAIXAVA pagante. O `error` do SELECT
 * era descartado; no supabase-js, consulta que erra volta `data: null`; o
 * `(ents ?? [])` virava lista vazia; `active` virava undefined; e a função
 * gravava `plan: "free", access_source: null, access_until: null` no perfil de
 * quem tinha acabado de pagar — em silêncio, no meio de um webhook que
 * respondia 200. Um blip de rede tirava o acesso de quem pagou.
 *
 * Agora quem decide é `decidirAcessoDoPerfil` (entitlements-pure.ts, sob
 * teste), e ela tem uma saída `escrever: false` para "não sei": leitura que
 * falha NÃO grava NADA em `profiles` — nem free, nem pro — e lança pra quem
 * chamou registrar. Ausência de informação não é a informação "esta pessoa não
 * tem acesso" (mesmo princípio do #222 em `vinculo.ts`).
 *
 * A regra de quem vale acesso, a ordenação e o desempate são byte a byte os de
 * antes; só mudaram de casa pra poderem ser testados.
 */
async function recomputeProfileAccess(userId: string): Promise<void> {
  const admin = getAdmin();
  const nowIso = new Date().toISOString();

  const consulta = await admin
    .from("entitlements")
    .select("provider, status, access_until")
    .eq("user_id", userId);

  const decisao = decidirAcessoDoPerfil(consulta, nowIso);
  if (!decisao.escrever) {
    exigirSucesso("leitura dos entitlements do perfil", consulta.error, {
      userId,
      motivo: decisao.motivo,
      efeito: "perfil NÃO foi tocado (acesso preservado)",
    });
    // `data: null` sem `error`: o supabase-js não produz esse par hoje, mas se
    // produzir, abortar em silêncio ainda é melhor que rebaixar — e fica
    // registrado.
    logger.error("audit", "entitlements: recompute abortado sem erro do banco", {
      userId,
      incidente: "#282",
      motivo: decisao.motivo,
    });
    throw new Error(`entitlements: recompute abortado (${decisao.motivo})`);
  }

  const { error: erroPerfil } = await admin
    .from("profiles")
    .update({ ...decisao.patch, updated_at: nowIso })
    .eq("id", userId);
  exigirSucesso("gravação do acesso no perfil", erroPerfil, {
    userId,
    plan: decisao.patch.plan,
  });
}
