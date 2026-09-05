/**
 * GET /api/v1/sgp/status — o estado do pedido pro acompanhamento (tela 5).
 * Público: responde pela SESSÃO do wizard, porque o aluno NÃO é obrigado a
 * entrar na plataforma pra acompanhar (Johnny 29/08). Cada chamada também
 * carimba as etapas concluídas e dispara o e-mail de cada uma.
 */
import { jsonOk, serverError } from "@/lib/api/responses";
import { estadoDasEtapas } from "@/lib/sgp/etapas";
import { previaDoPedido } from "@/lib/sgp/previa";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

export async function GET() {
  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return jsonOk({ pedido: null });
    const estado = await estadoDasEtapas(pedido);
    // A prévia sai pela MESMA sessão que já autorizou o estado acima — não há
    // id na URL. Ver lib/sgp/previa-pure.ts pra régua do que pode aparecer.
    const previa = await previaDoPedido(pedido, estado);
    return jsonOk({
      email: pedido.email,
      enviado: !!pedido.enviado_em,
      ...estado,
      previa,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao ler o pedido");
  }
}
