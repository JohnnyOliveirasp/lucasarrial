/**
 * POST /api/v1/sgp/inicio — tela 1 do SGP, SEM conta na plataforma.
 * Body: { nome, whatsapp, email }
 *
 * Guarda os dados no pedido da sessão (cookie) e manda um código de 6 dígitos
 * pro e-mail. A conta só nasce no "Confirmar e Enviar" (Johnny 29/08).
 * Responde `conta_existente` quando o e-mail já é do FastCloner — nesse caso
 * o material é anexado à conta que ele já tem, e nenhuma senha é pedida.
 *
 * ⚠️ PORTÃO (Johnny 24/09: "fecha o portão. Só entra quem tem compra
 * confirmada."): antes desta guarda a tela 1 não conferia compra nenhuma, e
 * qualquer pessoa com o link entrava e disparava trabalho que gasta GPU. A
 * régua mora em `lib/sgp/portao-inicio.ts` (pura, testada); o I/O em
 * `compra-confirmada.ts`. O portão decide ANTES de abrir/gravar a sessão:
 * barrado não ganha linha em `sgp_pedidos`, não recebe código e lê um texto
 * que diz o que fazer (o form joga `error.message` direto na tela).
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { CODIGO_VALIDADE_MIN, enviarCodigo, gerarCodigo, hashCodigo } from "@/lib/sgp/codigo";
import { temCompraSgpConfirmada, temPedidoNoPortal } from "@/lib/sgp/compra-confirmada";
import { EMAIL_RE, problemaNoNome } from "@/lib/sgp/identidade-pure";
import { portaoDoInicio } from "@/lib/sgp/portao-inicio";
import { atualizarSessao, pedidoDaSessao } from "@/lib/sgp/sessao";
import { normalizarWhatsapp } from "@/lib/sgp/types";

async function jaTemConta(email: string): Promise<boolean> {
  const { data } = await getAdmin()
    .from("profiles" as never)
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return !!data;
}

export async function POST(request: NextRequest) {
  let body: { nome?: unknown; whatsapp?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const whatsapp = typeof body.whatsapp === "string" ? normalizarWhatsapp(body.whatsapp) : null;
  // Tamanho E "isto é um e-mail?" (#377): o aluno que digitava o próprio
  // endereço aqui passava reto e o e-mail virava o nome dele no cadastro.
  const problemaNome = problemaNoNome(nome);
  if (problemaNome) return badRequest(problemaNome);
  if (!whatsapp) return badRequest("Informe um WhatsApp válido com DDD.");
  if (!EMAIL_RE.test(email)) return badRequest("Informe um e-mail válido.");

  try {
    // O PORTÃO, antes de qualquer escrita: sem compra confirmada (e sem já
    // estar dentro), nada de sessão, nada de linha em `sgp_pedidos`, nada de
    // código no e-mail. A ordem importa: se o pedido nascesse antes, o barrado
    // ganharia a linha que a cláusula "já estava dentro" respeita.
    const temCompra = await temCompraSgpConfirmada(email);
    const temPedido = temCompra ? false : await temPedidoNoPortal(email);
    const portao = portaoDoInicio({ temCompraSgp: temCompra, temPedidoAnterior: temPedido });
    if (portao.acao === "barrar") return badRequest(portao.mensagem);

    const pedido = await pedidoDaSessao();
    const codigo = gerarCodigo();
    const existente = await jaTemConta(email);

    await atualizarSessao(pedido.sessao, {
      nome,
      email,
      whatsapp,
      conta_existente: existente,
      codigo_hash: hashCodigo(codigo),
      codigo_expira_em: new Date(Date.now() + CODIGO_VALIDADE_MIN * 60_000).toISOString(),
      codigo_tentativas: 0,
      // Trocou de e-mail depois de já ter confirmado outro: confirma de novo.
      email_verificado_at: pedido.email === email ? pedido.email_verificado_at : null,
    });

    await enviarCodigo(email, codigo, nome);
    return jsonOk({ ok: true, conta_existente: existente });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar o código";
    console.error("[sgp/inicio]", msg);
    return serverError("Não conseguimos enviar o código agora. Tente de novo em um minuto.");
  }
}
