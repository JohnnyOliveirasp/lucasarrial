/**
 * POST /api/v1/sgp/enviar — "Confirmar e Enviar" da tela 4.
 * Body: { aceite: true }. Dispara o processamento (ver lib/sgp/processar.ts)
 * e devolve pra onde a tela vai: o acompanhamento em /app/sgp.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { enviarPedido } from "@/lib/sgp/processar";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  let body: { aceite?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (body.aceite !== true) return badRequest("Marque a declaração para enviar.");
  try {
    const r = await enviarPedido(auth.user_id);
    return jsonOk({ ...r, proximo: "/app/sgp" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar";
    return /Comece|Complete|Faltam/.test(msg) ? badRequest(msg) : serverError(msg);
  }
}
