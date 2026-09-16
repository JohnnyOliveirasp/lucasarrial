/**
 * POST /api/v1/sgp/enviar — "Confirmar e Enviar" da tela 4.
 * Body: { aceite: true, senha? } — a senha só é pedida quando o e-mail ainda
 * NÃO tem conta (é aqui que ela é criada). Ver lib/sgp/processar.ts.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { enviarPedido } from "@/lib/sgp/processar";
import { portaDoEnvio } from "@/lib/sgp/porta-envio";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

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

    // A régua (e o TEXTO que o aluno lê) mora em `lib/sgp/porta-envio.ts`, que
    // tem teste. Aqui ficam só os fios. Duas mudanças de comportamento:
    //   • `enviado` passou a contar como já-enviado. Era o buraco sem
    //     mitigação: fila legítima levando "Complete as etapas anteriores".
    //   • `falhou` deixou de mandar o aluno completar etapas que ele completou,
    //     e o `erro` do pedido — que esta rota nem lia — passa junto.
    const porta = portaDoEnvio(pedido.status, pedido.erro);
    if (porta.acao === "ja_enviado") {
      return jsonOk({ ok: true, erros: [], jaEnviado: true, email: pedido.email, proximo: "/sgp/acompanhar" });
    }
    if (porta.acao === "recusar") return badRequest(porta.mensagem);

    // A SESSÃO CONTINUA VIVA de propósito: o acompanhamento é a tela 5 do
    // wizard, sem login (Johnny 29/08).
    const r = await enviarPedido(pedido, senha);
    return jsonOk({ ...r, proximo: "/sgp/acompanhar" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar";
    return /Confirme|Complete|Falta|Crie uma senha|Comece/.test(msg) ? badRequest(msg) : serverError(msg);
  }
}
