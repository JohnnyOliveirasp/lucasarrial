/**
 * Concessão/revogação de acesso pago — compartilhado por todos os provedores
 * (hoje só Hotmart; Mercado Pago plugará aqui depois).
 *
 * Fonte da verdade = tabela `entitlements` (1 linha por compra/assinatura).
 * `profiles` guarda um CACHE (plan/access_until/access_source) pra o gate ser
 * rápido (middleware não precisa varrer entitlements a cada request).
 *
 * Mapeamento comprador↔usuário é por e-mail (lowercase). Se o e-mail da compra
 * não casar com nenhum usuário, o entitlement fica "órfão" (user_id NULL) e é
 * reconciliado quando o usuário aparecer (reconcileUserEntitlements).
 */
import { getAdmin } from "@/lib/db/admin";
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
  const userId = await findUserIdByEmail(email);

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
 * zera o crédito de mensalidade — mig 82).
 */
export async function revokeAccess(input: RevokeInput): Promise<RevokeResult> {
  const admin = getAdmin();
  const { data: existing } = await admin
    .from("entitlements")
    .select("id, user_id")
    .eq("provider", input.provider)
    .eq("external_id", input.externalId)
    .maybeSingle();

  if (!existing) return { found: false, userId: null }; // nenhum entitlement com esse external_id

  const patch: EntitlementUpdate = {
    status: input.status,
    raw_event: (input.rawEvent ?? null) as Json,
    updated_at: new Date().toISOString(),
  };
  // só sobrescreve access_until quando o caller especifica (cancelamento recorrente).
  if (input.accessUntil !== undefined) patch.access_until = input.accessUntil;

  await admin.from("entitlements").update(patch).eq("id", existing.id);
  if (existing.user_id) await recomputeProfileAccess(existing.user_id);
  return { found: true, userId: existing.user_id ?? null };
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
