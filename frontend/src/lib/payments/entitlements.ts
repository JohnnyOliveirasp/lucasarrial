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
 */
import { getAdmin } from "@/lib/db/admin";
import { donoDoEntitlement } from "@/lib/payments/vinculo";
import { resolveGrantStatus, resolveRevokeStatus } from "./entitlement-status";
import type {
  EntitlementStatus,
  EntitlementUpdate,
  Json,
  PaymentProvider,
} from "@/lib/db/types";

type GrantInput = {
  provider: PaymentProvider;
  buyerEmail: string;
  externalId: string; // assinatura (recorrente) OU transação (único)
  productCode?: string | null;
  offerCode?: string | null;
  accessUntil?: string | null; // ISO; NULL = vitalício (pagamento único)
  rawEvent?: unknown;
  /**
   * Este evento é DINHEIRO NOVO confirmado (PURCHASE_APPROVED pago)? Só ele
   * pode reativar um entitlement marcado como estornado/contestado. O
   * PURCHASE_COMPLETE (eco da garantia, mesma cobrança) NÃO é — foi ele que
   * apagou a marca de chargeback do Marlon em 28/08. Ver entitlement-status.ts.
   */
  newPayment?: boolean;
};

type RevokeInput = {
  provider: PaymentProvider;
  externalId: string;
  status: Exclude<EntitlementStatus, "active">;
  accessUntil?: string | null; // cancelamento recorrente: manter acesso até o fim do período já pago
  rawEvent?: unknown;
};

export type GrantResult = {
  /** status que ficou gravado no entitlement */
  statusFinal: EntitlementStatus;
  /** true = havia estorno/contestação e NADA foi reescrito (a prova ficou de pé) */
  terminalPreservado: boolean;
};

export type RevokeResult = {
  /** false = nenhum entitlement com esse external_id (o caller decide se é erro) */
  found: boolean;
  /**
   * Dono do entitlement (null se órfão ou não encontrado). Vem junto pro caller
   * agir sobre a MESMA pessoa da compra — é por ele que o estorno acha de quem
   * zerar o crédito de mensalidade (mig 108), sem depender do e-mail do payload.
   */
  userId: string | null;
  /** status que ficou (ou já estava) gravado no entitlement */
  statusFinal: EntitlementStatus | null;
  /** true = o status pedido era mais fraco que o atual e foi IGNORADO */
  terminalPreservado: boolean;
};

/** Libera/renova acesso. Idempotente por (provider, external_id). */
export async function grantAccess(input: GrantInput): Promise<GrantResult> {
  const admin = getAdmin();
  const email = input.buyerEmail.trim().toLowerCase();

  // Estado ANTES de escrever: um evento de compra que chega DEPOIS de um
  // estorno/contestação não pode apagar essa marca (ver entitlement-status.ts).
  // A MESMA linha traz o `user_id` usado pela guarda do #222 logo abaixo.
  const { data: existing } = await admin
    .from("entitlements")
    .select("status, user_id")
    .eq("provider", input.provider)
    .eq("external_id", input.externalId)
    .maybeSingle();

  const current = (existing?.status ?? null) as EntitlementStatus | null;
  const statusFinal = resolveGrantStatus(current, input.newPayment === true);

  if (statusFinal !== "active") {
    // Terminal preservado: não reescrevemos NADA — nem access_until, nem
    // raw_event, nem updated_at. O payload da contestação/estorno é a prova e
    // fica intacto, com o carimbo de tempo do evento que realmente mandou.
    return { statusFinal, terminalPreservado: true };
  }

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
    userId = donoDoEntitlement(userIdDoEmail, existing?.user_id ?? null);
  }

  await admin.from("entitlements").upsert(
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

  if (userId) await recomputeProfileAccess(userId);
  return { statusFinal, terminalPreservado: false };
}

/**
 * Revoga/suspende acesso. Idempotente.
 *
 * `found` = o entitlement existe; false quando o externalId não casa com
 * nenhum (revoke antes do grant, OU id extraído errado do payload — o caller
 * decide se isso é erro e registra).
 *
 * Um status mais FRACO que o atual é ignorado: "canceled"/"expired" não
 * sobrescrevem "chargeback"/"refunded" (ver entitlement-status.ts).
 *
 * ⚠️ `terminalPreservado` fala do STATUS do entitlement, não do dinheiro. Um
 * estorno que chega por cima de uma contestação não reescreve o status, mas o
 * caller AINDA precisa zerar o crédito daquela transação — por isso `userId`
 * é devolvido nos dois caminhos. Ver a nota no route.ts.
 */
export async function revokeAccess(input: RevokeInput): Promise<RevokeResult> {
  const admin = getAdmin();
  const { data: existing } = await admin
    .from("entitlements")
    .select("id, user_id, status")
    .eq("provider", input.provider)
    .eq("external_id", input.externalId)
    .maybeSingle();

  // nenhum entitlement com esse external_id
  if (!existing) {
    return { found: false, userId: null, statusFinal: null, terminalPreservado: false };
  }

  const current = existing.status as EntitlementStatus;
  const statusFinal = resolveRevokeStatus(current, input.status);
  if (statusFinal !== input.status) {
    // Evento mais fraco chegando por cima de um estorno/contestação: NADA é
    // reescrito (nem access_until, nem raw_event) — a prova fica de pé.
    return {
      found: true,
      userId: existing.user_id ?? null,
      statusFinal,
      terminalPreservado: true,
    };
  }

  const patch: EntitlementUpdate = {
    status: statusFinal,
    raw_event: (input.rawEvent ?? null) as Json,
    updated_at: new Date().toISOString(),
  };
  // só sobrescreve access_until quando o caller especifica (cancelamento recorrente).
  if (input.accessUntil !== undefined) patch.access_until = input.accessUntil;

  await admin.from("entitlements").update(patch).eq("id", existing.id);
  if (existing.user_id) await recomputeProfileAccess(existing.user_id);
  return {
    found: true,
    userId: existing.user_id ?? null,
    statusFinal,
    terminalPreservado: false,
  };
}

/**
 * Vincula entitlements órfãos (user_id NULL) ao usuário pelo e-mail e
 * recalcula o acesso. Chamar no login/callback ou no fluxo de "reivindicar".
 */
export async function reconcileUserEntitlements(
  userId: string,
  email: string,
): Promise<void> {
  const admin = getAdmin();
  const e = email.trim().toLowerCase();
  await admin
    .from("entitlements")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .is("user_id", null)
    .ilike("buyer_email", e);
  await recomputeProfileAccess(userId);
}

// ── helpers internos ────────────────────────────────────────────────────────

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Recalcula o cache de acesso no profile a partir dos entitlements do usuário.
 * Tem acesso quem possui ≥1 entitlement 'active' não expirado
 * (access_until NULL = vitalício).
 */
async function recomputeProfileAccess(userId: string): Promise<void> {
  const admin = getAdmin();
  const nowIso = new Date().toISOString();

  const { data: ents } = await admin
    .from("entitlements")
    .select("provider, status, access_until")
    .eq("user_id", userId);

  // ⚠️ "canceled" NAO e o mesmo que "sem acesso" (corrigido 20/08).
  //
  // Ate aqui so "active" contava. So que o proprio webhook, ao cancelar uma
  // assinatura, grava de proposito o access_until do periodo JA PAGO no
  // entitlement ("cancelamento de assinatura mantem o acesso ate o fim do
  // periodo") - e esta funcao jogava esse valor fora no segundo seguinte,
  // zerando profiles.access_until. Quem cancelava perdia na hora o que tinha
  // comprado, que e o oposto da regra "quem pagou fica".
  //
  // A regra, por status:
  //   active    -> access_until NULL (vitalicio) OU futuro
  //   canceled  -> SO com data futura. NULL aqui e "acabou", nao "vitalicio":
  //                cancelamento sem periodo pago restante nao da acesso.
  //   refunded / chargeback / expired -> NUNCA. O dinheiro voltou ou nao entrou.
  const valeAcesso = (e: { status: string; access_until: string | null }) => {
    if (e.status === "active") return e.access_until === null || e.access_until > nowIso;
    if (e.status === "canceled") return e.access_until !== null && e.access_until > nowIso;
    return false;
  };

  // Entre varios, o melhor: "active" ganha de "canceled"; empatado, a data mais
  // longe (vitalicio = infinito). Sem isto, um entitlement velho poderia
  // encurtar o acesso de quem tem outro mais novo.
  const active = (ents ?? [])
    .filter(valeAcesso)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const va = a.access_until === null ? Infinity : new Date(a.access_until).getTime();
      const vb = b.access_until === null ? Infinity : new Date(b.access_until).getTime();
      return vb - va;
    })[0];

  await admin
    .from("profiles")
    .update(
      active
        ? {
            plan: "pro",
            access_source: active.provider,
            access_until: active.access_until,
            updated_at: nowIso,
          }
        : {
            plan: "free",
            access_source: null,
            access_until: null,
            updated_at: nowIso,
          },
    )
    .eq("id", userId);
}
