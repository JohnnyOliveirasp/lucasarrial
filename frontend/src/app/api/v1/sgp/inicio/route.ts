/**
 * POST /api/v1/sgp/inicio — tela 1 do SGP, SEM conta na plataforma.
 * Body: { nome, whatsapp, email }
 *
 * Guarda os dados no pedido da sessão (cookie) e manda um código de 6 dígitos
 * pro e-mail. A conta só nasce no "Confirmar e Enviar" (Johnny 29/08).
 * Responde `conta_existente` quando o e-mail já é do FastCloner — nesse caso
 * o material é anexado à conta que ele já tem, e nenhuma senha é pedida.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { CODIGO_VALIDADE_MIN, enviarCodigo, gerarCodigo, hashCodigo } from "@/lib/sgp/codigo";
import { atualizarSessao, pedidoDaSessao } from "@/lib/sgp/sessao";
import { normalizarWhatsapp } from "@/lib/sgp/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  if (nome.length < 3) return badRequest("Informe o nome completo.");
  if (!whatsapp) return badRequest("Informe um WhatsApp válido com DDD.");
  if (!EMAIL_RE.test(email)) return badRequest("Informe um e-mail válido.");

  try {
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
