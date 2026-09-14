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
  COLUNAS_COBRANCA,
  COLUNAS_ERRO_MANUAL,
  criarFilaComFallback,
  silencioHorasConfigurado,
  silencioMsConfigurado,
} from "@/lib/sgp/cobranca";

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
];

/**
 * A fila, com queda pro conjunto de colunas antigo enquanto as migrations 106
 * (cobrança) e 109 (marcar erro) não entram — cada uma cai sozinha, porque quem
 * aplica é o Johnny e ele pode aplicar uma sem a outra. A régua do fallback (e o
 * memo) mora em lib/sgp/cobranca.ts, testada lá.
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
    const linhas = ordenar((data ?? []).map((p) => montarLinha(p, agora, silencioMs)));
    return jsonOk({
      pedidos: linhas,
      resumo: resumir(linhas),
      // A tela usa isto pra decidir se mostra o botão "Já cobrei" e pra escrever
      // o prazo certo no rodapé. Sem isto ela chutaria 48h mesmo com o env mudado.
      cobranca: { disponivel: !!disponivel.cobranca, silencioHoras: silencioHorasConfigurado() },
      // Mesma ideia pro botão "Marcar erro" (migration 109).
      erroManual: { disponivel: !!disponivel.erroManual },
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao carregar a fila do SGP");
  }
}
