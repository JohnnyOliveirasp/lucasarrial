/** GET /api/v1/admin/failures → falhas recentes (treino/voz/geração) com erro + e-mail. */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getFailures } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  try {
    return jsonOk({ failures: await getFailures(80) });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load failures");
  }
}
