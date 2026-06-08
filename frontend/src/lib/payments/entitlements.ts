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

/** Revoga/suspende acesso. Idempotente; ignora se o entitlement não existe. */
export async function revokeAccess(input: RevokeInput): Promise<void> {
  const admin = getAdmin();
  const { data: existing } = await admin
    .from("entitlements")
    .select("id, user_id")
    .eq("provider", input.provider)
    .eq("external_id", input.externalId)
    .maybeSingle();

  if (!existing) return; // revoke antes do grant — nada a fazer

  const patch: EntitlementUpdate = {
    status: input.status,
    raw_event: (input.rawEvent ?? null) as Json,
    updated_at: new Date().toISOString(),
  };
  // só sobrescreve access_until quando o caller especifica (cancelamento recorrente).
  if (input.accessUntil !== undefined) patch.access_until = input.accessUntil;

  await admin.from("entitlements").update(patch).eq("id", existing.id);
  if (existing.user_id) await recomputeProfileAccess(existing.user_id);
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

  const active = (ents ?? []).find(
    (e) =>
      e.status === "active" &&
      (e.access_until === null || e.access_until > nowIso),
  );

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
