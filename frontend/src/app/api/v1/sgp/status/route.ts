/**
 * GET /api/v1/sgp/status — o estado do pedido pro acompanhamento (tela 5).
 * Público: responde pela SESSÃO do wizard, porque o aluno NÃO é obrigado a
 * entrar na plataforma pra acompanhar (Johnny 29/08). Cada chamada também
 * carimba as etapas concluídas e dispara o e-mail de cada uma.
 */
import { jsonOk, serverError } from "@/lib/api/responses";
import { estadoDasEtapas } from "@/lib/sgp/etapas";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

export async function GET() {
  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return jsonOk({ pedido: null });
    const estado = await estadoDasEtapas(pedido);
    return jsonOk({
      email: pedido.email,
      enviado: !!pedido.enviado_em,
      ...estado,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao ler o pedido");
  }
}
