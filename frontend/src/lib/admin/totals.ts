/**
 * Acumulado "desde o início" do /admin (pedido Johnny 01/08): entrou, dado,
 * despesas e lucro somando TODA a operação, sem caçar mês a mês.
 *
 * Mesma contabilidade do período (lucro = CAIXA REAL, decisão 06/07), com uma
 * regra própria: GPU HÍBRIDA. O gasto real por queda de saldo (mig 52) só
 * existe a partir da 1ª leitura — antes dela usamos a estimativa por job,
 * depois dela o real medido. Sem isso o lucro acumulado sairia inflado.
 */
import { getAdmin } from "@/lib/db/admin";
import {
  PLAN_PRICE_BRL,
  USD_BRL,
  genCostBrl,
  trainCostBrl,
  hotmartFeeBrl,
  imagesCostBrl,
  infraCostBrl,
  kieCreditsCostBrl,
  videoClonesCostBrl,
} from "./cost";
import { VIDEO_TIERS } from "@/lib/video/tiers";
import { PLAN_MONTHLY_CREDITS } from "@/lib/credits/config";

/** Antes do 1º real da plataforma — pega tudo que existir no banco. */
const TOTAL_START = "2026-01-01T00:00:00-03:00";
/** Início da operação (mesma âncora do pró-rata de infra em queries.ts). */
const INFRA_START = "2026-06-01T00:00:00-03:00";

export type TotalSummary = {
  /** Entrou: vendas pagas Hotmart (bruto, sem testes). */
  revenue: number;
  paidCount: number;
  /** Dado: ofertas R$0 + cortesias, valorizadas a preço de tabela. */
  given: number;
  /** Despesas: taxas Hotmart + ferramentas (GPU/Kie) + infra + estornos. */
  expenses: number;
  /** Lucro = caixa real acumulado (entrou − despesas). */
  profit: number;
  marginPct: number;
  /** Cancelamentos de quem PAGOU de verdade (>R$0) e taxa sobre pagantes. */
  canceledPaid: number;
  churnPaidPct: number;
  /** Cancelamentos de quem estava na gratuidade (oferta R$0) e taxa. */
  canceledFree: number;
  churnFreePct: number;
};

/** Produto da plataforma na Hotmart (mesmo id usado nas análises de venda). */
const HOTMART_PRODUCT_ID = "7851642";

type CancelPayload = {
  data?: {
    subscriber?: { email?: string };
    buyer?: { email?: string };
    product?: { id?: number | string };
    subscription?: { product?: { id?: number | string } };
    purchase?: { price?: { value?: number } };
  };
};

const isTestEmail = (e: string) => !e || e.includes("@example.com") || e === "test@hotmart.com";

/**
 * Churn de assinatura SEPARADO por quem paga de verdade × gratuidade (oferta
 * R$0): misturar os dois inflava a taxa (03/08: 20,6% misto vs 3,8% pagantes).
 */
async function getChurn(admin: ReturnType<typeof getAdmin>) {
  const [cancelRes, approvedRes] = await Promise.all([
    admin.from("payment_events").select("payload").eq("event_type", "SUBSCRIPTION_CANCELLATION"),
    admin.from("payment_events").select("buyer_email, payload").eq("event_type", "PURCHASE_APPROVED"),
  ]);

  // Assinante é PAGANTE se alguma compra aprovada teve valor > 0.
  const paid = new Set<string>();
  const freeOnly = new Set<string>();
  for (const row of (approvedRes.data ?? []) as { buyer_email: string | null; payload: CancelPayload }[]) {
    const email = (row.buyer_email ?? "").toLowerCase();
    const d = row.payload?.data;
    if (isTestEmail(email) || String(d?.product?.id ?? "") !== HOTMART_PRODUCT_ID) continue;
    if (Number(d?.purchase?.price?.value ?? 0) > 0) {
      paid.add(email);
      freeOnly.delete(email);
    } else if (!paid.has(email)) {
      freeOnly.add(email);
    }
  }

  const canceled = new Set<string>();
  for (const row of (cancelRes.data ?? []) as { payload: CancelPayload }[]) {
    const d = row.payload?.data;
    const email = (d?.subscriber?.email || d?.buyer?.email || "").toLowerCase();
    const product = String(d?.product?.id ?? d?.subscription?.product?.id ?? "");
    if (!isTestEmail(email) && product === HOTMART_PRODUCT_ID) canceled.add(email);
  }

  const canceledPaid = [...canceled].filter((e) => paid.has(e)).length;
  const canceledFree = [...canceled].filter((e) => freeOnly.has(e)).length;
  return {
    canceledPaid,
    churnPaidPct: paid.size > 0 ? (canceledPaid / paid.size) * 100 : 0,
    canceledFree,
    churnFreePct: freeOnly.size > 0 ? (canceledFree / freeOnly.size) * 100 : 0,
  };
}

type ByRes = Array<{ resolution: string; n: number }>;
type ByTier = Array<{ tier: string; n: number; seconds: number }>;

export async function getTotalSummary(): Promise<TotalSummary> {
  const admin = getAdmin();
  const since = new Date(TOTAL_START).toISOString();
  const until = new Date().toISOString();

  // Fronteira da GPU híbrida: 1ª leitura de saldo RunPod (mig 52).
  const firstRead = await admin
    .from("runpod_spend_log")
    .select("at")
    .order("at", { ascending: true })
    .limit(1);
  const firstReadAt = ((firstRead.data ?? []) as unknown as { at: string }[])[0]?.at;
  const preUntil = firstReadAt ?? until;

  const [fRes, preMetrics, preClones, spendRes, courtesyRes, churn] = await Promise.all([
    admin.rpc("admin_finance", { p_since: since, p_until: until }),
    // Jobs ANTES da 1ª leitura → estimativa (mesma régua de queries.ts)
    admin.rpc("admin_metrics", { p_since: since, p_until: preUntil }),
    admin.rpc("admin_video_clones", { p_since: since, p_until: preUntil }),
    admin.from("runpod_spend_log").select("balance_usd").order("at", { ascending: true }),
    admin.from("courtesy_grants").select("amount"),
    getChurn(admin),
  ]);

  const fin = (fRes.data ?? {}) as {
    paid_count?: number;
    paid_total?: number;
    offer_count?: number;
    refund_total?: number;
    images_by_res?: ByRes;
    scene_images_by_res?: ByRes;
    scene_videos_by_tier?: Array<{ tier: string; n: number }>;
  };
  const preM = (preMetrics.data ?? {}) as { gens_chars_period?: number; trainings_period?: number };

  // ---- GPU: estimativa pré-leituras + queda REAL de saldo depois ----
  const gpuPre =
    genCostBrl(preM.gens_chars_period ?? 0) +
    trainCostBrl(preM.trainings_period ?? 0) +
    videoClonesCostBrl(((preClones.data ?? []) as ByTier));
  const readings = (spendRes.data ?? []) as { balance_usd: number }[];
  let gpuRealUsd = 0;
  for (let i = 1; i < readings.length; i++) {
    // Recarga faz o saldo SUBIR → par negativo → ignorado (max 0).
    gpuRealUsd += Math.max(0, readings[i - 1].balance_usd - readings[i].balance_usd);
  }
  const gpuCost = gpuPre + gpuRealUsd * USD_BRL;

  // ---- Kie (imagens + clipes): custo real por job, range inteiro ----
  const imageCost = imagesCostBrl(fin.images_by_res ?? []) + imagesCostBrl(fin.scene_images_by_res ?? []);
  const videoCost = (fin.scene_videos_by_tier ?? []).reduce((sum, v) => {
    const tier = VIDEO_TIERS.find((t) => t.id === v.tier);
    return sum + kieCreditsCostBrl((tier?.kieCost ?? 15) * v.n);
  }, 0);

  // ---- infra fixa pró-rateada do lançamento até agora ----
  const infraDays = Math.max((Date.now() - new Date(INFRA_START).getTime()) / 86_400_000, 0);
  const infra = infraCostBrl(infraDays);

  const revenue = fin.paid_total ?? 0;
  const paidCount = fin.paid_count ?? 0;
  const fee = hotmartFeeBrl(revenue, paidCount);
  const refunds = fin.refund_total ?? 0;
  const expenses = fee + gpuCost + imageCost + videoCost + infra + refunds;
  const profit = revenue - expenses;

  const courtesyCredits = ((courtesyRes.data ?? []) as { amount: number }[]).reduce(
    (s, g) => s + g.amount,
    0,
  );
  const given =
    (fin.offer_count ?? 0) * PLAN_PRICE_BRL +
    (courtesyCredits / PLAN_MONTHLY_CREDITS) * PLAN_PRICE_BRL;

  return {
    revenue,
    paidCount,
    given,
    expenses,
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    canceledPaid: churn.canceledPaid,
    churnPaidPct: churn.churnPaidPct,
    canceledFree: churn.canceledFree,
    churnFreePct: churn.churnFreePct,
  };
}
