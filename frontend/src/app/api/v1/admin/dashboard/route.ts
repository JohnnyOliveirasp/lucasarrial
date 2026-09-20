/**
 * GET /api/v1/admin/dashboard?gran=day|month|year&key=2026-07-06|2026-07|2026
 * Período CALENDÁRIO (fuso de Brasília): dia exato, mês fechado ou ano fechado.
 * Tudo que a visão geral precisa num payload só (poll near-real-time).
 *
 * `retiradas` (pedido Johnny 18/09) só vai no payload quando quem pede é SÓCIO:
 * é com ele que o client desconta o Lucro (caixa) e o Lucro acumulado pra
 * mostrar caixa real. Pra admin não-sócio o campo vem `null` e a tela fica
 * exatamente como era — o valor não trafega nem no JSON.
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
import { somasRetiradas } from "@/lib/admin/retiradas";
import { ehSocio } from "@/lib/admin/retiradas-calc";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const params = new URL(request.url).searchParams;
  const range = resolveRange(params.get("gran"), params.get("key"));

  try {
    const socio = ehSocio(g.auth.email);
    const [data, totals, live, runpod, retiradas] = await Promise.all([
      getAdminData(range),
      getTotalSummary(),
      getLiveCloning(),
      getRunpodHealth(),
      socio ? somasRetiradas(range) : Promise.resolve(null),
    ]);
    return jsonOk({ ...data, totals, live, runpod, retiradas });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load dashboard");
  }
}
