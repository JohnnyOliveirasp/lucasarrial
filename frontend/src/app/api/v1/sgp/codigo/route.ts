/**
 * POST /api/v1/sgp/codigo — confere o código de 6 dígitos da tela 1.
 * Body: { codigo }. Acertou → e-mail verificado e o wizard segue pra foto.
 * 15 min de validade, 5 tentativas (ver lib/sgp/codigo.ts).
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { CODIGO_MAX_TENTATIVAS, hashCodigo } from "@/lib/sgp/codigo";
import { escolherRetomada } from "@/lib/sgp/retomada-pure";
import { atualizarSessao, candidatosPorEmail, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

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

    // RETOMADA (22/09): o e-mail acabou de ser PROVADO com o código — só a
    // partir daqui é permitido contar ao aluno que ele já tem um pedido em
    // andamento (nada de dado do pedido antes do código validar). A oferta é
    // acessória: se a busca falhar, a verificação NÃO pode cair junto.
    let retomada: { fotos: number } | null = null;
    if (pedido.email) {
      try {
        const alvo = escolherRetomada(await candidatosPorEmail(pedido.email), pedido.sessao);
        if (alvo) retomada = { fotos: alvo.fotosAprovadas };
      } catch (e) {
        console.error("[sgp/codigo] oferta de retomada falhou:", e instanceof Error ? e.message : e);
      }
    }
    return jsonOk({ ok: true, proximo: "foto", retomada });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao confirmar o código");
  }
}
