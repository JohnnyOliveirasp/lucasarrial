/**
 * PATCH /api/v1/admin/campaigns/[id]  → liga/desliga uma campanha { active }.
 * Encerrar = active:false (para de conceder o bônus em novas compras).
 * Restrito a admins.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { setCampaignActive } from "@/lib/campaigns/service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  const { id } = await ctx.params;

  let body: { active?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (typeof body.active !== "boolean") return badRequest("'active' (boolean) é obrigatório");

  try {
    await setCampaignActive(id, body.active);
    return jsonOk({ id, active: body.active });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao atualizar campanha");
  }
}
