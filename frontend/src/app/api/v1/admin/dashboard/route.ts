/**
 * GET /api/v1/admin/dashboard?gran=day|month|year&key=2026-07-06|2026-07|2026
 * Período CALENDÁRIO (fuso de Brasília): dia exato, mês fechado ou ano fechado.
 * Tudo que a visão geral precisa num payload só (poll near-real-time).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdminData, getLiveCloning } from "@/lib/admin/queries";
import { getTotalSummary } from "@/lib/admin/totals";
import { getRunpodHealth } from "@/lib/admin/runpod";
// rangeFor/currentMonthKey moraram aqui dentro até 11/09 — saíram pra
// lib/admin/period.ts porque a rota de Retiradas precisa recortar EXATAMENTE a
// mesma janela de calendário; duas implementações separadas fariam o "Em caixa"
// subtrair retiradas de um período diferente do lucro mostrado ao lado.
import { resolveRange } from "@/lib/admin/period";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const params = new URL(request.url).searchParams;
  const range = resolveRange(params.get("gran"), params.get("key"));

  try {
    const [data, totals, live, runpod] = await Promise.all([
      getAdminData(range),
      getTotalSummary(),
      getLiveCloning(),
      getRunpodHealth(),
    ]);
    return jsonOk({ ...data, totals, live, runpod });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load dashboard");
  }
}
