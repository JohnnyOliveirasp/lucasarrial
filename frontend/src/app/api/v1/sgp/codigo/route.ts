/**
 * POST /api/v1/sgp/codigo — confere o código de 6 dígitos da tela 1.
 * Body: { codigo }. Acertou → e-mail verificado e o wizard segue pra foto.
 * 15 min de validade, 5 tentativas (ver lib/sgp/codigo.ts).
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { CODIGO_MAX_TENTATIVAS, hashCodigo } from "@/lib/sgp/codigo";
import { atualizarSessao, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

export async function POST(request: NextRequest) {
  let body: { codigo?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const codigo = typeof body.codigo === "string" ? body.codigo.replace(/\D/g, "") : "";
  if (codigo.length < 4) return badRequest("Digite o código do e-mail.");

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido?.codigo_hash) return badRequest("Peça um código novo.");
    if (pedido.codigo_expira_em && new Date(pedido.codigo_expira_em) < new Date()) {
      return badRequest("O código venceu. Peça um novo.");
    }
    if (pedido.codigo_tentativas >= CODIGO_MAX_TENTATIVAS) {
      return badRequest("Muitas tentativas. Peça um código novo.");
    }
    if (hashCodigo(codigo) !== pedido.codigo_hash) {
      await atualizarSessao(pedido.sessao, { codigo_tentativas: pedido.codigo_tentativas + 1 });
      return badRequest("Código inválido. Confira e tente de novo.");
    }

    await atualizarSessao(pedido.sessao, {
      email_verificado_at: new Date().toISOString(),
      codigo_hash: null,
      codigo_expira_em: null,
      codigo_tentativas: 0,
      status: pedido.status === "dados" ? "foto" : pedido.status,
    });
    return jsonOk({ ok: true, proximo: "foto" });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao confirmar o código");
  }
}
