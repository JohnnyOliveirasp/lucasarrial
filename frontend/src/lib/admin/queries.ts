/**
 * Camada de dados do /admin. Server-only — usa as funções de agregação do
 * Postgres (admin_*) via service_role. Calcula dinheiro (faturou/gastou/lucro)
 * em cima do modelo de custo travado.
 */
import { getAdmin } from "@/lib/db/admin";
import {
  PLAN_PRICE_BRL,
  genCostBrl,
  trainCostBrl,
  hotmartFeeBrl,
  imagesCostBrl,
  infraCostBrl,
  kieCreditsCostBrl,
  videoClonesCostBrl,
} from "./cost";
import { VIDEO_TIERS } from "@/lib/video/tiers";

/** Janela calendário [since, until) em ISO — construída na rota a partir de dia/mês/ano. */
export type DateRange = { since: string; until: string };

export type AdminMetrics = {
  users_total: number;
  users_new: number;
  subs_active: number;
  online_now: number;
  voices_total: number;
  voices_ready: number;
  voices_training: number;
  voices_failed: number;
  gens_total: number;
  gens_period: number;
  gens_failed: number;
  gens_chars_period: number;
  trainings_done: number;
  trainings_period: number;
  trainings_failed: number;
  credits_consumed: number;
};

export type Money = {
  mrr: number;
  revenuePeriod: number;
  /** Custo variável (ferramentas Kie/RunPod) no período. */
  costPeriod: number;
  /** Custo fixo de infra (Hetzner + RunPod HD) pró-rateado no período. */
  infraPeriod: number;
  feePeriod: number;
  profitPeriod: number;
  marginPct: number;
};

/** Fatia da pizza de custos (R$ reais gastos por ferramenta). */
export type CostSlice = { key: string; label: string; brl: number; detail: string };

/** Dinheiro REAL vindo da Hotmart (RPC admin_finance) + fatias de custo. */
export type Finance = {
  paidCount: number;
  paidTotal: number;
  paidCountPeriod: number;
  paidTotalPeriod: number;
  offerCount: number;
  offerCountPeriod: number;
  /** R$ dados em promoção no período (ofertas R$0 × preço do plano). */
  offerValuePeriod: number;
  testCount: number;
  refundTotal: number;
  refundCount: number;
  slices: CostSlice[];
};

export type AdminData = {
  metrics: AdminMetrics;
  money: Money;
  finance: Finance;
};

type ByRes = Array<{ resolution: string; n: number }>;
type FinanceRaw = {
  paid_count: number;
  paid_total: number;
  paid_count_period: number;
  paid_total_period: number;
  offer_count: number;
  offer_count_period: number;
  test_count: number;
  refund_total: number;
  refund_count: number;
  paid_by_day: Array<{ day: string; revenue: number; sales: number }>;
  images_by_res: ByRes;
  scene_images_by_res: ByRes;
  scene_videos_by_tier: Array<{ tier: string; n: number }>;
};

export async function getAdminData(range: DateRange): Promise<AdminData> {
  const admin = getAdmin();
  const { since, until } = range;

  const [mRes, fRes, cRes] = await Promise.all([
    admin.rpc("admin_metrics", { p_since: since, p_until: until }),
    admin.rpc("admin_finance", { p_since: since, p_until: until }),
    admin.rpc("admin_video_clones", { p_since: since, p_until: until }),
  ]);

  const metrics = (mRes.data ?? {}) as unknown as AdminMetrics;
  const fin = (fRes.data ?? {}) as unknown as FinanceRaw;
  const clonesByTier = (cRes.data ?? []) as unknown as Array<{
    tier: string;
    n: number;
    seconds: number;
  }>;

  const subs = metrics.subs_active ?? 0;
  const mrr = subs * PLAN_PRICE_BRL; // projeção (assinantes ativos × plano)

  // ---- custos reais por ferramenta (fatias da pizza) ----
  const voiceCost = genCostBrl(metrics.gens_chars_period ?? 0);
  const trainCost = trainCostBrl(metrics.trainings_period ?? 0);
  const imagesStandalone = fin.images_by_res ?? [];
  const imagesScenes = fin.scene_images_by_res ?? [];
  const imageCost = imagesCostBrl(imagesStandalone) + imagesCostBrl(imagesScenes);
  const imageCount =
    imagesStandalone.reduce((s, r) => s + r.n, 0) + imagesScenes.reduce((s, r) => s + r.n, 0);
  const videosByTier = fin.scene_videos_by_tier ?? [];
  const videoCost = videosByTier.reduce((sum, v) => {
    const tier = VIDEO_TIERS.find((t) => t.id === v.tier);
    // custo REAL: créditos Kie do tier (kieCost) × nº de clipes
    return sum + kieCreditsCostBrl((tier?.kieCost ?? 15) * v.n);
  }, 0);
  const videoCount = videosByTier.reduce((s, v) => s + v.n, 0);
  // Vídeo Clone (InfiniteTalk na NOSSA GPU) — custo por segundo de áudio/tier.
  const cloneCost = videoClonesCostBrl(clonesByTier);
  const cloneCount = clonesByTier.reduce((s, c) => s + c.n, 0);
  const cloneMinutes = clonesByTier.reduce((s, c) => s + c.seconds, 0) / 60;

  const slices: CostSlice[] = [
    { key: "voice", label: "Voz (TTS)", brl: voiceCost, detail: `${(metrics.gens_chars_period ?? 0).toLocaleString("pt-BR")} caracteres` },
    { key: "training", label: "Treinos de voz", brl: trainCost, detail: `${metrics.trainings_period ?? 0} treinos` },
    { key: "image", label: "Imagens (Kie)", brl: imageCost, detail: `${imageCount} imagens` },
    { key: "video", label: "Vídeos (Kie)", brl: videoCost, detail: `${videoCount} clipes` },
    { key: "clone", label: "Vídeo Clone (GPU)", brl: cloneCost, detail: `${cloneCount} vídeos · ${cloneMinutes.toFixed(1)}min` },
  ];

  // ---- dinheiro REAL (Hotmart, produto da plataforma, sem testes) ----
  const revenuePeriod = fin.paid_total_period ?? 0;
  const costPeriod = voiceCost + trainCost + imageCost + videoCost;
  const feePeriod = hotmartFeeBrl(revenuePeriod, fin.paid_count_period ?? 0);
  const refunds = fin.refund_total ?? 0;
  // Decisão Johnny 2026-07-06 (opção B): lucro/prejuízo = CAIXA REAL; a promoção
  // (assinaturas R$0 valorizadas a preço de tabela) aparece SEPARADA ao lado,
  // com o "total c/ promoção" escrito — os dois números sempre visíveis.
  const offerValuePeriod = (fin.offer_count_period ?? 0) * PLAN_PRICE_BRL;
  // Infra fixa (Hetzner + RunPod HD) pró-rateada pela janela vista, LIMITADA ao
  // tempo realmente operado: do lançamento (jun/2026) até agora — senão o "ano"
  // cobraria 12 meses e o mês corrente cobraria dias que ainda não existiram.
  const INFRA_START = new Date("2026-06-01T00:00:00-03:00").getTime();
  const effSince = Math.max(new Date(since).getTime(), INFRA_START);
  const effUntil = Math.min(new Date(until).getTime(), Date.now());
  const rangeDays = Math.max((effUntil - effSince) / 86_400_000, 0);
  const infraPeriod = infraCostBrl(rangeDays);
  const profitPeriod = revenuePeriod - feePeriod - costPeriod - infraPeriod - refunds;
  const marginPct = revenuePeriod > 0 ? (profitPeriod / revenuePeriod) * 100 : 0;

  return {
    metrics,
    money: { mrr, revenuePeriod, costPeriod, infraPeriod, feePeriod, profitPeriod, marginPct },
    finance: {
      paidCount: fin.paid_count ?? 0,
      paidTotal: fin.paid_total ?? 0,
      paidCountPeriod: fin.paid_count_period ?? 0,
      paidTotalPeriod: fin.paid_total_period ?? 0,
      offerCount: fin.offer_count ?? 0,
      offerCountPeriod: fin.offer_count_period ?? 0,
      offerValuePeriod,
      testCount: fin.test_count ?? 0,
      refundTotal: refunds,
      refundCount: fin.refund_count ?? 0,
      slices,
    },
  };
}

export type LiveCloning = {
  id: string;
  name: string;
  email: string | null;
  display_name: string | null;
  runpod_job_id: string | null;
  started_at: string;
};

export async function getLiveCloning(): Promise<LiveCloning[]> {
  const { data } = await getAdmin().rpc("admin_live_cloning", {});
  return (data ?? []) as unknown as LiveCloning[];
}

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  access_until: string | null;
  access_source: string | null;
  credits: number;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  voices: number;
  generations: number;
};

export async function getUsers(): Promise<AdminUser[]> {
  const { data } = await getAdmin().rpc("admin_users", {});
  return (data ?? []) as unknown as AdminUser[];
}

export type Failure = {
  kind: "training" | "voice" | "generation";
  id: string;
  at: string;
  error: string | null;
  email: string | null;
};

export async function getFailures(limit = 50): Promise<Failure[]> {
  const { data } = await getAdmin().rpc("admin_failures", { p_limit: limit });
  return (data ?? []) as unknown as Failure[];
}

export type HistoryTraining = {
  id: string;
  at: string;
  status: string;
  voice: string | null;
  email: string | null;
  elapsed_seconds: number | null;
  error: string | null;
};
export type HistoryGeneration = {
  id: string;
  at: string;
  status: string;
  name: string | null;
  voice: string | null;
  email: string | null;
  chars: number;
};
export type HistoryPayment = {
  id: string;
  at: string;
  provider: string;
  event_type: string | null;
  email: string | null;
  processed_at: string | null;
  error: string | null;
};
export type AdminHistory = {
  trainings: HistoryTraining[];
  generations: HistoryGeneration[];
  payments: HistoryPayment[];
};

export async function getHistory(limit = 40): Promise<AdminHistory> {
  const { data } = await getAdmin().rpc("admin_history", { p_limit: limit });
  return (data ?? { trainings: [], generations: [], payments: [] }) as unknown as AdminHistory;
}
