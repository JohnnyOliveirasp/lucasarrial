/**
 * GET /api/v1/admin/sgp → fila do SGP para o time de suporte (/admin/sgp).
 *
 * SOMENTE LEITURA. Nada aqui escreve, reprocessa ou manda e-mail: a tela roda
 * em polling e qualquer efeito colateral viraria e-mail repetido pro aluno.
 * Por isso NÃO chama `estadoDasEtapas` (ver o comentário em lib/sgp/painel.ts)
 * — lê o que aquela função já gravou na linha.
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

export const dynamic = "force-dynamic";

const COLUNAS = [
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
].join(", ");

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;
  try {
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .select(COLUNAS)
      .order("atualizado_em", { ascending: true })
      .limit(500);
    if (error) return serverError(error.message);

    const agora = Date.now();
    const linhas = ordenar(((data ?? []) as unknown as SgpPedidoRow[]).map((p) => montarLinha(p, agora)));
    return jsonOk({ pedidos: linhas, resumo: resumir(linhas) });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao carregar a fila do SGP");
  }
}
