/**
 * /api/v1/admin/retiradas — retiradas dos sócios (mig 108).
 *   GET  ?gran=day|month|year&key=... → retiradas da MESMA janela dos KPIs
 *   POST { valor, socio, origem? }    → registra uma retirada
 *
 * Restrito a admin (gateAdmin default — suporte NÃO entra: é dinheiro de sócio).
 *
 * Retirada não é despesa: nada aqui toca receita, custo ou lucro. Esta rota só
 * grava/lista linhas; quem subtrai é a tela ("Em caixa" = lucro − retiradas).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { resolveRange } from "@/lib/admin/period";
import { createRetirada, listRetiradas } from "@/lib/admin/retiradas";
import { validarRetirada } from "@/lib/admin/retiradas-calc";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const params = new URL(request.url).searchParams;
  const range = resolveRange(params.get("gran"), params.get("key"));

  try {
    const lista = await listRetiradas(range);
    return jsonOk(lista);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao listar retiradas");
  }
}

export async function POST(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  let body: { valor?: unknown; socio?: unknown; origem?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const v = validarRetirada({ valor: body.valor, socio: body.socio });
  if (!v.ok) return badRequest(v.erro);

  try {
    const retirada = await createRetirada({
      valor: v.valor,
      socio: v.socio,
      origem: typeof body.origem === "string" ? body.origem : undefined,
      registradoPor: g.auth.email,
    });
    return jsonOk({ retirada }, 201);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao registrar a retirada");
  }
}
