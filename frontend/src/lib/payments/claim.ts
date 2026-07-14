/**
 * Resgate de compras "órfãs" no login — caso Juliano/Victor/Gustavo 2026-07-13.
 *
 * O webhook da Hotmart só credita se o perfil JÁ existir com o e-mail exato da
 * compra. Quem pagava antes de criar a conta ficava com o entitlement órfão
 * (user_id NULL) e SEM os créditos — em silêncio. Aqui, em todo login:
 *   1. vincula entitlements órfãos pelo e-mail e recalcula plan/access;
 *   2. concede a recarga do ciclo que nunca foi dada (checa
 *      credit_transactions por ref_id — NUNCA credita o mesmo ciclo 2x).
 * Best-effort: jamais bloqueia o login.
 *
 * Limite conhecido: e-mail da compra ≠ e-mail da conta (caso Juliano) não tem
 * como casar sozinho — pra isso o webhook agora AVISA a equipe por e-mail
 * quando uma aprovação chega sem conta correspondente.
 */
import { getAdmin } from "@/lib/db/admin";
import { reconcileUserEntitlements } from "@/lib/payments/entitlements";
import { grantSubscriptionCredits } from "@/lib/credits/service";
import { applyPurchaseCampaignBonus } from "@/lib/campaigns/service";
import { PLAN_MONTHLY_CREDITS } from "@/lib/credits/config";

export async function claimPurchasesOnLogin(userId: string, email: string): Promise<void> {
  try {
    const admin = getAdmin();
    // 1. Religa órfãos deste e-mail + recalcula o cache de acesso (idempotente).
    await reconcileUserEntitlements(userId, email);

    // 2. Assinatura ativa cujo ciclo nunca foi creditado → concede agora.
    const { data: ents } = await admin
      .from("entitlements")
      .select("external_id, status, access_until")
      .eq("user_id", userId)
      .eq("status", "active");
    const nowIso = new Date().toISOString();
    for (const e of (ents ?? []) as { external_id: string; access_until: string | null }[]) {
      if (e.access_until && e.access_until <= nowIso) continue; // período já venceu
      const { data: tx } = await admin
        .from("credit_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("kind", "subscription_grant")
        .eq("ref_id", e.external_id)
        .limit(1)
        .maybeSingle();
      if (tx) continue; // este ciclo/assinatura já foi creditado (fluxo normal)
      await grantSubscriptionCredits({
        userId,
        amount: PLAN_MONTHLY_CREDITS,
        refType: "payment_event",
        refId: e.external_id,
      });
      await applyPurchaseCampaignBonus(userId, e.external_id);
    }
  } catch {
    /* best-effort: login nunca pode falhar por causa do resgate */
  }
}
