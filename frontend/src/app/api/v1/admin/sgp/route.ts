/**
 * GET /api/v1/admin/sgp → fila do SGP para o time de suporte (/admin/sgp).
 *
 * SOMENTE LEITURA. Nada aqui escreve, reprocessa ou manda e-mail: a tela roda
 * em polling e qualquer efeito colateral viraria e-mail repetido pro aluno.
 * Por isso NÃO chama `estadoDasEtapas` (ver o comentário em lib/sgp/painel.ts)
 * — lê o que aquela função já gravou na linha. (Quem escreve o "já cobrei" é a
 * rota irmã `[id]/cobranca`, e só por clique de gente.)
 *
 * `SUPORTE_OK` é o ponto: essa tela existe PRA equipe de suporte, que tem papel
 * `suporte` e não é admin cheio. Sem isso a API responderia 403 justamente pra
 * quem precisa dela.
 *
 * Colunas escolhidas a dedo: `codigo_hash`, `codigo_expira_em` e `sessao` são
 * segredo de sessão (dão pra assumir o pedido de outra pessoa) e NÃO saem daqui.
 * E-mail e WhatsApp saem porque o trabalho do time é justamente cobrar o aluno.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import type { SgpPedidoRow } from "@/lib/sgp/types";
import { montarLinha, ordenar, resumir } from "@/lib/sgp/painel";
import {
  COLUNAS_AVISO,
  COLUNAS_COBRANCA,
  COLUNAS_CONCLUSAO,
  COLUNAS_CONCLUSAO_AUTO,
  COLUNAS_ERRO_MANUAL,
  criarFilaComFallback,
  silencioHorasConfigurado,
  silencioMsConfigurado,
} from "@/lib/sgp/cobranca";
import { buscarAvisos } from "@/lib/sgp/aviso";

export const dynamic = "force-dynamic";

const COLUNAS_BASE = [
  "id",
  "nome",
  "email",
  "whatsapp",
  "status",
  "criado_em",
  "atualizado_em",
  "enviado_em",
  "foto_pronta_em",
  "voz_pronta_em",
  "fotos",
  "audios",
  "erro",
  // `user_id` entrou em 15/09 (recado 6): é a chave pra ler o carimbo de aviso
  // em `profiles.onboarding_ready_email_at`. NÃO é segredo de sessão — segredo
  // é `sessao`/`codigo_hash`, que continuam fora daqui de propósito.
  "user_id",
];

/**
 * A fila, com queda pro conjunto de colunas antigo enquanto as migrations 106
 * (cobrança), 109 (marcar erro) e 110 (concluir atendimento) não entram — cada
 * uma cai sozinha, porque quem aplica é o Johnny e ele pode aplicar uma sem as
 * outras. A régua do fallback (e o memo) mora em lib/sgp/cobranca.ts, testada lá.
 */
const buscar = criarFilaComFallback<SgpPedidoRow>(
  (colunas) =>
    getAdmin()
      .from("sgp_pedidos" as never)
      .select(colunas)
      .order("atualizado_em", { ascending: true })
      .limit(500) as unknown as Promise<{ data: SgpPedidoRow[] | null; error: unknown }>,
  COLUNAS_BASE,
  [
    { nome: "cobranca", colunas: COLUNAS_COBRANCA },
    { nome: "erroManual", colunas: COLUNAS_ERRO_MANUAL },
    { nome: "conclusao", colunas: COLUNAS_CONCLUSAO },
    // A 118 marca a conclusão que fechou SOZINHA. Grupo próprio, separado da
    // 110: sem isso, aplicar uma e não a outra derrubaria o botão "Concluir
    // atendimento", que já funciona, por causa de uma coluna alheia.
    { nome: "conclusaoAuto", colunas: COLUNAS_CONCLUSAO_AUTO },
    // A 116 ainda não foi aplicada — cai sozinha, como as outras três. Sem ela
    // o corte GERADO/ENTREGUE continua funcionando pelo carimbo do sistema.
    { nome: "aviso", colunas: COLUNAS_AVISO },
  ],
);

/** O erro do fallback vem como `unknown` (ele não presume a forma do PostgREST). */
function mensagemDoErro(e: unknown): string {
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Falha ao carregar a fila do SGP";
}

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;
  try {
    const { data, error, disponivel } = await buscar();
    if (error) return serverError(mensagemDoErro(error));

    const agora = Date.now();
    const silencioMs = silencioMsConfigurado();
    const pedidos = data ?? [];
    // O carimbo de "o aluno foi avisado" (recado 6). SOMENTE LEITURA, como o
    // resto desta rota: uma consulta a `profiles` por leva de 200 prontos.
    const avisos = await buscarAvisos(getAdmin(), pedidos);
    const linhas = ordenar(
      pedidos.map((p) => montarLinha(p, agora, silencioMs, avisos.get(p.id) ?? null)),
    );
    return jsonOk({
      pedidos: linhas,
      resumo: resumir(linhas),
      // A tela usa isto pra decidir se mostra o botão "Já cobrei" e pra escrever
      // o prazo certo no rodapé. Sem isto ela chutaria 48h mesmo com o env mudado.
      cobranca: { disponivel: !!disponivel.cobranca, silencioHoras: silencioHorasConfigurado() },
      // Mesma ideia pro botão "Marcar erro" (migration 109).
      erroManual: { disponivel: !!disponivel.erroManual },
      // E pro botão "Concluir atendimento" (migration 110).
      conclusao: { disponivel: !!disponivel.conclusao },
      // E pro registro de "Avisei o aluno" (migration 116). A tela usa isto pra
      // explicar POR QUE não dá pra registrar um aviso dado por fora — em vez
      // de oferecer um botão que daria erro.
      aviso: { disponivel: !!disponivel.aviso },
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao carregar a fila do SGP");
  }
}
