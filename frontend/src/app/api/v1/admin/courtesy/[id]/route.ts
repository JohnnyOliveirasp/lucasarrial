/**
 * PATCH /api/v1/admin/courtesy/[id] → encerra a campanha AGORA { end_now: true }.
 * Antecipa ends_at pra já e expira o restante de cada concessão (o sweeper de
 * 5min garante o que sobrar). Restrito a admins.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { endCourtesyCampaignNow } from "@/lib/courtesy/service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  const { id } = await ctx.params;

  let body: { end_now?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (body.end_now !== true) return badRequest("'end_now: true' é obrigatório");

  try {
    await endCourtesyCampaignNow(id);
    return jsonOk({ id, ended: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao encerrar cortesia");
  }
}
