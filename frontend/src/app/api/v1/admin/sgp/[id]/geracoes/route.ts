/**
 * GET /api/v1/admin/sgp/[id]/geracoes → o que já foi GERADO para este aluno
 * (painel que abre embaixo da linha em /admin/sgp).
 *
 * Pedido do Lucas (recado 5): pra saber se a voz saiu e como ficou a foto, hoje
 * o atendente sai da tela e vai perguntar pra alguém.
 *
 * SOMENTE LEITURA, igual às duas rotas irmãs do painel. Nada aqui escreve,
 * reprocessa ou manda e-mail — em particular NÃO chama `estadoDasEtapas`, que
 * grava na linha e dispara e-mail pro aluno (ver lib/sgp/painel.ts). Este painel
 * é aberto por curiosidade do atendente, várias vezes por dia.
 *
 * `SUPORTE_OK` é o ponto, pelo mesmo motivo das outras: quem usa a tela é o time
 * de suporte, que tem papel `suporte` e não é admin cheio. Sem isso a rota daria
 * 403 justamente pra quem ela existe pra servir.
 *
 * O que sai daqui são URLs ASSINADAS de 1h, não chaves de bucket — o browser do
 * atendente precisa conseguir tocar o áudio e ver a miniatura, e chave crua não
 * serve pra isso nem deve circular.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { geracoesDoPedido } from "@/lib/sgp/geracoes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const { id } = await params;

  try {
    // Só as duas colunas que decidem o que buscar. `sessao`/`codigo_hash` são
    // segredo de sessão e não têm o que fazer aqui (mesma régua das irmãs).
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .select("id, user_id, voice_id")
      .eq("id", id)
      .maybeSingle();

    if (error) return serverError(error.message);
    // `.eq` em id inexistente não é erro no PostgREST, volta vazio. Sem isto o
    // painel abriria vazio e o atendente leria "esse aluno não gerou nada".
    if (!data) return notFound("Pedido");

    const pedido = data as unknown as { user_id: string | null; voice_id: string | null };
    return jsonOk(await geracoesDoPedido(pedido));
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao carregar o que foi gerado");
  }
}
