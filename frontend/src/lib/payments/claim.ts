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
import { claimCourtesyOnLogin } from "@/lib/courtesy/service";
import { PLAN_MONTHLY_CREDITS } from "@/lib/credits/config";

/** Número da cobrança guardado no raw_event do entitlement (ex.: HP3248282838). */
function transactionOf(rawEvent: unknown): string | null {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const purchase = (rawEvent as { purchase?: unknown }).purchase;
  if (!purchase || typeof purchase !== "object") return null;
  const trx = (purchase as { transaction?: unknown }).transaction;
  return typeof trx === "string" && trx ? trx : null;
}

export async function claimPurchasesOnLogin(userId: string, email: string): Promise<void> {
  // Cortesias (mig 53): e-mail que entrou numa campanha antes de ter conta
  // recebe na primeira entrada. Best-effort dentro da própria função.
  await claimCourtesyOnLogin(userId, email);
  try {
    const admin = getAdmin();
    // 1. Religa órfãos deste e-mail + recalcula o cache de acesso (idempotente).
    await reconcileUserEntitlements(userId, email);

    // 2. Assinatura ativa cujo ciclo nunca foi creditado → concede agora.
    const { data: ents } = await admin
      .from("entitlements")
      .select("external_id, status, access_until, raw_event")
      .eq("user_id", userId)
      .eq("status", "active");
    const nowIso = new Date().toISOString();
    for (const e of (ents ?? []) as {
      external_id: string;
      access_until: string | null;
      raw_event: unknown;
    }[]) {
      if (e.access_until && e.access_until <= nowIso) continue; // período já venceu

      // O webhook passou a usar a TRANSAÇÃO como chave do crédito (10/08),
      // porque o external_id da assinatura é o código do assinante e repete em
      // toda renovação. Aqui a gente olha as DUAS chaves: se qualquer uma já
      // creditou, não credita de novo. Sem isso, uma compra creditada pelo
      // webhook (chave=transação) seria creditada outra vez no login
      // (chave=assinante) — crédito em dobro.
      const trx = transactionOf(e.raw_event);
      const chaves = [...new Set([trx, e.external_id].filter(Boolean))] as string[];
      const { data: tx } = await admin
        .from("credit_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("kind", "subscription_grant")
        .in("ref_id", chaves)
        .limit(1)
        .maybeSingle();
      if (tx) continue; // este ciclo/assinatura já foi creditado (fluxo normal)
      await grantSubscriptionCredits({
        userId,
        amount: PLAN_MONTHLY_CREDITS,
        refType: "payment_event",
        refId: trx ?? e.external_id,
      });
      await applyPurchaseCampaignBonus(userId, e.external_id);
    }
  } catch {
    /* best-effort: login nunca pode falhar por causa do resgate */
  }
}
