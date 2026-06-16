/**
 * /api/v1/admin/campaigns
 *   GET  → lista campanhas de bônus + nº de resgates + total concedido
 *   POST → cria campanha { name, bonus_credits, ends_at, starts_at? }
 *
 * Restrito a admins (gateAdmin). Feature à parte do fluxo normal de créditos.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { createCampaign, listCampaigns } from "@/lib/campaigns/service";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  try {
    const campaigns = await listCampaigns();
    return jsonOk({ campaigns });
  } catch {
    return serverError("Falha ao listar campanhas");
  }
}

export async function POST(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  let body: {
    name?: unknown;
    bonus_credits?: unknown;
    ends_at?: unknown;
    starts_at?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const bonus = Number(body.bonus_credits);
  const endsAt = typeof body.ends_at === "string" ? body.ends_at : "";
  const startsAt = typeof body.starts_at === "string" && body.starts_at ? body.starts_at : undefined;

  if (!name) return badRequest("Informe um nome para a campanha");
  if (!Number.isFinite(bonus) || bonus <= 0) return badRequest("bonus_credits deve ser > 0");
  const endsMs = Date.parse(endsAt);
  if (Number.isNaN(endsMs)) return badRequest("ends_at inválido");
  if (endsMs <= Date.now()) return badRequest("A data de término deve ser no futuro");

  try {
    const campaign = await createCampaign({
      name,
      bonusCredits: Math.floor(bonus),
      endsAt,
      startsAt,
      createdBy: g.auth.email,
    });
    return jsonOk({ campaign }, 201);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao criar campanha");
  }
}
