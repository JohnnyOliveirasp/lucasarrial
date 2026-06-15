/**
 * Métricas do /admin. Server-only — usa o client service_role (bypassa RLS).
 *
 * Tudo via count queries (agregação no Postgres, `head:true`), pra escalar sem
 * puxar linhas. O filtro por período (dia/semana/quinzena/mês) e os gráficos
 * de faturamento×custo×lucro entram na próxima fase.
 */
import { getAdmin } from "@/lib/db/admin";

/** Preço do plano único (R$/mês). Usado pro MRR. Ver [[project-credits-model]]. */
export const PLAN_PRICE_BRL = 97;

export type AdminOverview = {
  usersTotal: number;
  subsActive: number;
  mrrBrl: number;
  voicesReady: number;
  voicesTraining: number;
  voicesFailed: number;
  generationsTotal: number;
  generationsFailed: number;
  trainingsDone: number;
  trainingsFailed: number;
};

const HEAD = { count: "exact" as const, head: true };

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = getAdmin();
  const nowISO = new Date().toISOString();

  const [
    usersTotal,
    subsActive,
    voicesReady,
    voicesTraining,
    voicesFailed,
    generationsTotal,
    generationsFailed,
    trainingsDone,
    trainingsFailed,
  ] = await Promise.all([
    admin.from("profiles").select("*", HEAD).then((r) => r.count ?? 0),
    admin.from("profiles").select("*", HEAD).gt("access_until", nowISO).then((r) => r.count ?? 0),
    admin.from("voices").select("*", HEAD).eq("status", "ready").then((r) => r.count ?? 0),
    admin.from("voices").select("*", HEAD).eq("status", "training").then((r) => r.count ?? 0),
    admin.from("voices").select("*", HEAD).eq("status", "failed").then((r) => r.count ?? 0),
    admin.from("generations").select("*", HEAD).then((r) => r.count ?? 0),
    admin.from("generations").select("*", HEAD).eq("status", "failed").then((r) => r.count ?? 0),
    admin.from("training_jobs").select("*", HEAD).eq("status", "completed").then((r) => r.count ?? 0),
    admin.from("training_jobs").select("*", HEAD).eq("status", "failed").then((r) => r.count ?? 0),
  ]);

  return {
    usersTotal,
    subsActive,
    mrrBrl: subsActive * PLAN_PRICE_BRL,
    voicesReady,
    voicesTraining,
    voicesFailed,
    generationsTotal,
    generationsFailed,
    trainingsDone,
    trainingsFailed,
  };
}
