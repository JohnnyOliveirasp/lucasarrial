/**
 * /api/v1/admin/courtesy — Cortesias (mentoria sem Hotmart, mig 53)
 *   GET  → lista campanhas + estatísticas de concessão/expiração
 *   POST → cria campanha { name, credits_per_person, emails[], ends_at, starts_at? }
 *          e já concede a quem tem conta se a janela estiver aberta.
 *
 * Restrito a admins (gateAdmin).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { createCourtesyCampaign, listCourtesyCampaigns } from "@/lib/courtesy/service";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  try {
    const campaigns = await listCourtesyCampaigns();
    return jsonOk({ campaigns });
  } catch {
    return serverError("Falha ao listar cortesias");
  }
}

export async function POST(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  let body: {
    name?: unknown;
    credits_per_person?: unknown;
    emails?: unknown;
    ends_at?: unknown;
    starts_at?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const credits = Number(body.credits_per_person);
  const emails = Array.isArray(body.emails)
    ? body.emails.filter((e): e is string => typeof e === "string")
    : [];
  const endsAt = typeof body.ends_at === "string" ? body.ends_at : "";
  const startsAt = typeof body.starts_at === "string" && body.starts_at ? body.starts_at : undefined;

  if (!name) return badRequest("Informe um nome para a campanha");
  if (!Number.isFinite(credits) || credits <= 0)
    return badRequest("credits_per_person deve ser > 0");
  if (emails.length === 0) return badRequest("Informe pelo menos um e-mail");
  const endsMs = Date.parse(endsAt);
  if (Number.isNaN(endsMs)) return badRequest("ends_at inválido");
  if (endsMs <= Date.now()) return badRequest("A data de término deve ser no futuro");
  if (startsAt && Date.parse(startsAt) >= endsMs)
    return badRequest("O início deve ser antes do fim");

  try {
    const campaign = await createCourtesyCampaign({
      name,
      creditsPerPerson: Math.floor(credits),
      emails,
      endsAt,
      startsAt,
      createdBy: g.auth.email,
    });
    return jsonOk({ campaign }, 201);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao criar cortesia");
  }
}
