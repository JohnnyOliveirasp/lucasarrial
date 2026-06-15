/**
 * Camada de dados do /admin. Server-only — usa as funções de agregação do
 * Postgres (admin_*) via service_role. Calcula dinheiro (faturou/gastou/lucro)
 * em cima do modelo de custo travado.
 */
import { getAdmin } from "@/lib/db/admin";
import {
  PLAN_PRICE_BRL,
  PERIOD_DAYS,
  type Period,
  genCostBrl,
  trainCostBrl,
  hotmartFeeBrl,
} from "./cost";

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

export type ChartPoint = {
  day: string;
  revenue: number;
  cost: number;
  profit: number;
  gens: number;
};

export type Money = {
  mrr: number;
  revenuePeriod: number;
  costPeriod: number;
  feePeriod: number;
  profitPeriod: number;
  marginPct: number;
};

export type AdminData = {
  period: Period;
  metrics: AdminMetrics;
  money: Money;
  chart: ChartPoint[];
};

type SeriesPoint = { day: string; gens: number; chars: number; trainings: number };

function sinceFor(period: Period): string {
  const days = PERIOD_DAYS[period];
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

export async function getAdminData(period: Period): Promise<AdminData> {
  const admin = getAdmin();
  const since = sinceFor(period);
  const days = PERIOD_DAYS[period];

  const [mRes, tRes] = await Promise.all([
    admin.rpc("admin_metrics", { p_since: since }),
    admin.rpc("admin_timeseries", { p_since: since }),
  ]);

  const metrics = (mRes.data ?? {}) as unknown as AdminMetrics;
  const series = (tRes.data ?? []) as unknown as SeriesPoint[];

  const subs = metrics.subs_active ?? 0;
  const mrr = subs * PLAN_PRICE_BRL;
  const revenuePeriod = mrr * (days / 30);
  const costPeriod =
    genCostBrl(metrics.gens_chars_period ?? 0) + trainCostBrl(metrics.trainings_period ?? 0);
  const feePeriod = hotmartFeeBrl(revenuePeriod, subs * (days / 30));
  const profitPeriod = revenuePeriod - feePeriod - costPeriod;
  const marginPct = revenuePeriod > 0 ? (profitPeriod / revenuePeriod) * 100 : 0;

  const dailyRevenue = mrr / 30;
  const dailyFee = hotmartFeeBrl(dailyRevenue, subs / 30);
  const chart: ChartPoint[] = series.map((p) => {
    const cost = genCostBrl(p.chars) + trainCostBrl(p.trainings);
    return {
      day: p.day,
      revenue: dailyRevenue,
      cost,
      profit: dailyRevenue - dailyFee - cost,
      gens: p.gens,
    };
  });

  return {
    period,
    metrics,
    money: { mrr, revenuePeriod, costPeriod, feePeriod, profitPeriod, marginPct },
    chart,
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
