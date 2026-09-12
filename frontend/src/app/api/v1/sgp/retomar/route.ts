/**
 * GET /api/v1/sgp/retomar?token=… — devolve o aluno pro pedido dele.
 *
 * É o link que o SUPORTE gera (POST /api/v1/admin/sgp/[id]/retomada) e manda
 * por e-mail quando alguém perdeu o cookie da sessão. Planta o cookie e
 * redireciona pra tela certa do wizard. Sem isto a única "solução" era pedir
 * pro cliente colar um uuid no DevTools.
 *
 * POR QUE É ROTA DE API E NÃO PÁGINA: Server Component **não pode gravar
 * cookie** durante o render (Next.js). Quem escreve cookie é Route Handler ou
 * Server Action — então o link tem que bater aqui primeiro.
 *
 * NUNCA TERMINA EM ERRO SECO: token torto, vencido ou de pedido que sumiu cai
 * na tela 1 com `?retomada=…`, e a tela 1 sabe retomar o pedido pelo e-mail.
 */
import { NextResponse, type NextRequest } from "next/server";
import { destinoDoWizard } from "@/lib/sgp/destino";
import { verificarRetomada } from "@/lib/sgp/retomada";
import { pedidoPorSessao, plantarSessao } from "@/lib/sgp/sessao";

export const dynamic = "force-dynamic";

function paraTela(request: NextRequest, caminho: string): NextResponse {
  return NextResponse.redirect(new URL(caminho, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const lido = verificarRetomada(token);
  if ("erro" in lido) return paraTela(request, `/sgp?retomada=${lido.erro}`);

  let pedido = null;
  try {
    pedido = await pedidoPorSessao(lido.sessao);
  } catch (e) {
    console.error("[sgp/retomar]", e instanceof Error ? e.message : e);
    return paraTela(request, "/sgp?retomada=falhou");
  }
  // Assinatura boa mas a linha não existe mais: trata como link inválido em vez
  // de plantar cookie apontando pro nada (o wizard abriria pedido novo mudo).
  if (!pedido) return paraTela(request, "/sgp?retomada=invalido");

  await plantarSessao(pedido.sessao);

  // E-mail ainda não confirmado neste pedido: o cookie sozinho não abre o
  // wizard (mesma regra da adoção por e-mail). Volta pra tela 1 — que agora vem
  // preenchida com os dados dele e só pede o código.
  if (!pedido.email_verificado_at) return paraTela(request, "/sgp?retomada=confirme");

  return paraTela(request, destinoDoWizard(pedido.status));
}
