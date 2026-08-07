/**
 * GET /api/v1/admin/churn — lista de quem cancelou (popup do gráfico de
 * cancelamentos do /admin): e-mail, dia (BRT), pagante×trial e o motivo da
 * pesquisa da plataforma (null = cancelou direto no Hotmart).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { computeChurn } from "@/lib/admin/churn";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  try {
    const { people } = await computeChurn(getAdmin());
    return jsonOk({ people });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load churn people");
  }
}
