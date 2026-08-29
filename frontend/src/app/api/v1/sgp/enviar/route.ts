/**
 * POST /api/v1/sgp/enviar — "Confirmar e Enviar" da tela 4.
 * Body: { aceite: true, senha? } — a senha só é pedida quando o e-mail ainda
 * NÃO tem conta (é aqui que ela é criada). Ver lib/sgp/processar.ts.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { enviarPedido } from "@/lib/sgp/processar";
import { encerrarSessao, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let body: { aceite?: unknown; senha?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (body.aceite !== true) return badRequest("Marque a declaração para enviar.");
  const senha = typeof body.senha === "string" ? body.senha : null;

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return badRequest("Comece pela tela de dados.");
    if (["processando", "pronto"].includes(pedido.status)) {
      return jsonOk({ ok: true, erros: [], jaEnviado: true, email: pedido.email });
    }
    if (pedido.status !== "revisao") return badRequest("Complete as etapas anteriores antes de enviar.");

    const r = await enviarPedido(pedido, senha);
    await encerrarSessao();
    return jsonOk({ ...r, proximo: "/app/sgp" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar";
    return /Confirme|Complete|Falta|Crie uma senha|Comece/.test(msg) ? badRequest(msg) : serverError(msg);
  }
}
