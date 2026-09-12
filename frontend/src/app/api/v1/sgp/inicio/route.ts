/**
 * POST /api/v1/sgp/inicio — tela 1 do SGP, SEM conta na plataforma.
 * Body: { nome, whatsapp, email }
 *
 * Guarda os dados no pedido da sessão (cookie) e manda um código de 6 dígitos
 * pro e-mail. A conta só nasce no "Confirmar e Enviar" (Johnny 29/08).
 * Responde `conta_existente` quando o e-mail já é do FastCloner — nesse caso
 * o material é anexado à conta que ele já tem, e nenhuma senha é pedida.
 *
 * RETOMADA PELO E-MAIL (09/09, caso welrisson@): navegador SEM cookie que
 * informa um e-mail com pedido em aberto **assume aquele pedido** em vez de
 * abrir uma linha nova. Sem isto, quem trocava de navegador perdia de vista o
 * material que já tinha subido e a gente ganhava duas linhas pro mesmo aluno.
 * A adoção **zera o `email_verificado_at`**: quem adota tem que provar o
 * e-mail com o código de 6 dígitos, senão bastaria digitar o e-mail de alguém
 * pra entrar no pedido dele.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { CODIGO_VALIDADE_MIN, enviarCodigo, gerarCodigo, hashCodigo } from "@/lib/sgp/codigo";
import {
  atualizarSessao,
  pedidoAbertoPorEmail,
  pedidoDaSessao,
  pedidoDaSessaoOuNull,
  plantarSessao,
} from "@/lib/sgp/sessao";
import { normalizarWhatsapp } from "@/lib/sgp/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * `.limit(1)` e NÃO `.maybeSingle()`: com dois perfis no mesmo e-mail (variação
 * de caixa acontece) o `maybeSingle` devolve ERRO e `data` null — e o código
 * antigo ignorava o erro, concluindo "não tem conta" justamente pra quem tem
 * duas. O efeito era pedir senha na tela 4 pra quem já era da casa.
 */
async function jaTemConta(email: string): Promise<boolean> {
  const { data } = await getAdmin()
    .from("profiles" as never)
    .select("id")
    .ilike("email", email)
    .limit(1);
  return ((data as unknown[] | null)?.length ?? 0) > 0;
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
  if (nome.length < 3) return badRequest("Informe o nome completo.");
  if (!whatsapp) return badRequest("Informe um WhatsApp válido com DDD.");
  if (!EMAIL_RE.test(email)) return badRequest("Informe um e-mail válido.");

  try {
    // 1. O pedido deste navegador. 2. Sem cookie, o pedido em aberto deste
    // e-mail (retomada). 3. Só então uma linha nova.
    let pedido = await pedidoDaSessaoOuNull();
    let retomado = false;
    if (!pedido) {
      const aberto = await pedidoAbertoPorEmail(email);
      if (aberto) {
        await plantarSessao(aberto.sessao);
        pedido = aberto;
        retomado = true;
      }
    }
    if (!pedido) pedido = await pedidoDaSessao();

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
      // Retomou o pedido de outro navegador: idem — o cookie sozinho não vale
      // como prova, o código é que vale.
      email_verificado_at: !retomado && pedido.email === email ? pedido.email_verificado_at : null,
    });

    await enviarCodigo(email, codigo, nome);
    return jsonOk({ ok: true, conta_existente: existente, retomado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar o código";
    console.error("[sgp/inicio]", msg);
    return serverError("Não conseguimos enviar o código agora. Tente de novo em um minuto.");
  }
}
