/**
 * POST /api/v1/sgp/retomar — o aluno ACEITOU "continuar de onde parou".
 *
 * Reaponta o cookie da sessão para a linha canônica do e-mail que ele acabou
 * de provar com o código de 6 dígitos (tela 1). Sem corpo: o alvo é
 * re-derivado AQUI, no servidor — id vindo do cliente não vale nada.
 *
 * O que este handler NUNCA faz:
 *  - rodar sem e-mail verificado na sessão atual (o código é a barra de
 *    posse; sem ele, digitar o e-mail de alguém abriria o pedido dele);
 *  - tocar em linha do banco: só o cookie muda. A linha nova que a sessão
 *    atual abriu fica onde está, intacta — recusar a retomada é grátis e
 *    retomar não apaga nada;
 *  - reapontar pra pedido fora do wizard ('pronto', 'enviado', …) ou já de
 *    uma conta (`user_id`): regras do módulo puro `lib/sgp/retomada-pure.ts`.
 */
import { jsonOk, badRequest, serverError } from "@/lib/api/responses";
import { destinoDaRetomada, escolherRetomada } from "@/lib/sgp/retomada-pure";
import { candidatosPorEmail, pedidoDaSessaoOuNull, plantarSessao } from "@/lib/sgp/sessao";

export async function POST() {
  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido?.email || !pedido.email_verificado_at) {
      return badRequest("Confirme seu e-mail primeiro.");
    }

    const alvo = escolherRetomada(await candidatosPorEmail(pedido.email), pedido.sessao);
    if (!alvo) {
      // A oferta venceu entre o código e o clique (ex.: o pedido antigo foi
      // enviado nesse meio-tempo). Não é erro do aluno: segue no pedido atual.
      return jsonOk({ ok: true, retomado: false, destino: "/sgp/foto" });
    }

    await plantarSessao(alvo.sessao);
    return jsonOk({ ok: true, retomado: true, destino: destinoDaRetomada(alvo.status) });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao retomar o pedido");
  }
}
