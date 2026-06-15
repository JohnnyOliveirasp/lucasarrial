/**
 * GET /api/v1/admin/dashboard?period=day|week|fortnight|month
 * Tudo que a visão geral precisa num payload só (poll near-real-time):
 * métricas + dinheiro + série do gráfico + quem está clonando + saúde RunPod.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdminData, getLiveCloning } from "@/lib/admin/queries";
import { getRunpodHealth } from "@/lib/admin/runpod";
import { PERIOD_DAYS, type Period } from "@/lib/admin/cost";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const param = new URL(request.url).searchParams.get("period") ?? "week";
  const period = (param in PERIOD_DAYS ? param : "week") as Period;

  try {
    const [data, live, runpod] = await Promise.all([
      getAdminData(period),
      getLiveCloning(),
      getRunpodHealth(),
    ]);
    return jsonOk({ ...data, live, runpod });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load dashboard");
  }
}
