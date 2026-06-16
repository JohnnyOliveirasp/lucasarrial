/**
 * Campanhas de bônus de créditos — FEATURE À PARTE do fluxo normal de créditos.
 *
 * Regra: quem COMPRA (assinatura aprovada) dentro da janela [starts_at, ends_at]
 * de uma campanha ativa ganha `bonus_credits` no saldo EXTRA (permanente, não
 * expira), 1x por campanha. A concessão é idempotente (PK do grant), então pode
 * ser chamada à vontade — renovação fora da janela vira no-op.
 *
 * Integração: o webhook da Hotmart chama `applyPurchaseCampaignBonus` após
 * liberar a assinatura. Nada do fluxo normal de créditos é alterado.
 *
 * Server-only (service_role). NUNCA importar no client.
 */
import { getAdmin } from "@/lib/db/admin";
import type { CreditCampaignRow } from "@/lib/db/types";

export type CampaignBonusResult = { ok: boolean; campaigns: number; credits: number };

/** Campanha + estatísticas de resgate (vinda da RPC admin_list_campaigns). */
export type CampaignWithStats = CreditCampaignRow & {
  grants_count: number;
  credits_granted: number;
};

/**
 * Aplica o bônus de toda campanha de compra ativa/na-janela que o usuário ainda
 * não recebeu. Idempotente. Chamado pelo webhook de pagamento. Falha graciosa:
 * loga e retorna ok:false sem derrubar o fluxo de liberação de acesso.
 */
export async function applyPurchaseCampaignBonus(
  userId: string,
  refId?: string,
): Promise<CampaignBonusResult> {
  const { data, error } = await getAdmin().rpc("apply_purchase_campaign_bonus", {
    p_user_id: userId,
    p_ref_id: refId ?? null,
  });
  if (error) return { ok: false, campaigns: 0, credits: 0 };
  const r = (data ?? {}) as Partial<CampaignBonusResult>;
  return { ok: r.ok ?? false, campaigns: r.campaigns ?? 0, credits: r.credits ?? 0 };
}

/** Lista campanhas + nº de resgates + total concedido (painel admin). */
export async function listCampaigns(): Promise<CampaignWithStats[]> {
  const { data, error } = await getAdmin().rpc("admin_list_campaigns");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CampaignWithStats[];
}

/** Cria uma campanha de bônus. `endsAt`/`startsAt` em ISO. */
export async function createCampaign(args: {
  name: string;
  bonusCredits: number;
  endsAt: string;
  startsAt?: string;
  createdBy?: string | null;
}): Promise<CreditCampaignRow> {
  const { data, error } = await getAdmin()
    .from("credit_campaigns")
    .insert({
      name: args.name,
      bonus_credits: args.bonusCredits,
      ends_at: args.endsAt,
      ...(args.startsAt ? { starts_at: args.startsAt } : {}),
      created_by: args.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CreditCampaignRow;
}

/** Liga/desliga uma campanha (encerrar = active:false). */
export async function setCampaignActive(id: string, active: boolean): Promise<void> {
  const { error } = await getAdmin()
    .from("credit_campaigns")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
