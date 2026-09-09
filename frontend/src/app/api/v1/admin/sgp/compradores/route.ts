/**
 * GET /api/v1/admin/sgp/compradores → TODO MUNDO que comprou o SGP, tenha
 * começado o portal ou não (aba "Todos os compradores" de /admin/sgp).
 *
 * SOMENTE LEITURA, pelo mesmo motivo da rota irmã: nada aqui escreve,
 * reprocessa ou manda e-mail. Em particular NÃO chama `estadoDasEtapas`, que
 * grava e dispara e-mail pro aluno (ver o comentário em lib/sgp/painel.ts).
 *
 * `SUPORTE_OK` é obrigatório: quem trabalha esta lista é o time de suporte, que
 * tem papel `suporte` e não é admin cheio. Sem isso a rota responderia 403
 * justamente pra quem ela existe pra servir.
 *
 * ⚠️ POR QUE PAGINA (incidente 72a4c9db): o PostgREST corta QUALQUER `.select()`
 * sem `.range()` em 1000 linhas EM SILÊNCIO — sem erro e sem aviso. Já são 1.917
 * PURCHASE_APPROVED no banco (medido 08/09), então um select cru veria 1000 e
 * perderia compradores de SGP sem ninguém notar — exatamente o tipo de cegueira
 * que este painel veio consertar. `fetchAllPages` ABORTA em erro: lista
 * incompleta aqui é pior que erro na tela, porque parece completa.
 *
 * ⚠️ POR QUE FILTRA O PRODUTO EM JS, e não no banco: o id vive dentro do JSON
 * (`payload.data.product.id`) e vem como NÚMERO nos payloads reais do 7283229.
 * Um filtro PostgREST em cima disso depende de coerção de tipo e falha calado —
 * devolvendo zero compradores. O mesmo caminho já é usado por `computeChurn` e
 * por `classificarCompras`: puxa PURCHASE_APPROVED e decide em código, com o
 * `extractProductCode` canônico.
 *
 * ⚠️ A TERCEIRA FONTE (09/09, pedido do Lucas): `entitlements` do produto da
 * PLATAFORMA, pra dizer o que cada comprador de SGP paga no FastCloner HOJE.
 * Ela é ESTRITAMENTE INFORMATIVA — entra depois da união e não pode adicionar
 * nem remover uma linha sequer da lista (ver o comentário em
 * `montarCompradores`). O valor sai do PURCHASE_APPROVED do próprio produto,
 * aproveitando a varredura de eventos que já acontecia aqui: nenhuma consulta
 * a mais por causa dela, fora o select de entitlements.
 *
 * Colunas escolhidas a dedo: `codigo_hash`, `codigo_expira_em` e `sessao` são
 * segredo de sessão (dão pra assumir o pedido de outra pessoa) e NÃO saem daqui.
 * E-mail e telefone saem porque o trabalho do time é justamente entrar em
 * contato com essa gente.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { fetchAllPages } from "@/lib/db/paginate";
import {
  asRecord,
  extractBuyerEmail,
  extractBuyerName,
  extractBuyerPhone,
  extractProductCode,
  extractPurchaseStatus,
} from "@/lib/payments/hotmart-payload";
import { FASTCLONER_PRODUCT_ID_PADRAO, SGP_PRODUCT_ID_PADRAO } from "@/lib/payments/sgp-boas-vindas";
import {
  montarCompradores,
  ordenarCompradores,
  resumirCompradores,
  type CobrancaFastClonerBruta,
  type CompraSgpBruta,
  type EntitlementFastClonerBruto,
} from "@/lib/sgp/compradores";
import type { SgpPedidoRow } from "@/lib/sgp/types";

export const dynamic = "force-dynamic";

/** Só o que a planilha usa. Segredo de sessão fica de fora de propósito. */
const COLUNAS_PEDIDO = "id, nome, email, whatsapp, status, criado_em, atualizado_em, enviado_em";

type EventoLinha = { payload: unknown; received_at: string };

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  // Mesma resolução do webhook (`HOTMART_SGP_PRODUCT_ID ?? SGP_PRODUCT_ID_PADRAO`):
  // se o ambiente apontar pra outro produto, o painel acompanha em vez de mentir.
  const produtoSgp = process.env.HOTMART_SGP_PRODUCT_ID ?? SGP_PRODUCT_ID_PADRAO;
  // Mesma resolução que `sgp-boas-vindas-canal.ts` usa pra perguntar "este
  // comprador tem a plataforma?" — a coluna FastCloner responde a MESMA
  // pergunta, então lê o MESMO produto.
  const produtoFastCloner = process.env.HOTMART_PRODUCT_ID ?? FASTCLONER_PRODUCT_ID_PADRAO;
  const admin = getAdmin();

  try {
    const [eventos, pedidos, entitlements] = await Promise.all([
      fetchAllPages<EventoLinha>("payment_events PURCHASE_APPROVED (sgp)", (from, to) =>
        admin
          .from("payment_events")
          .select("payload, received_at")
          // SÓ PURCHASE_APPROVED. Em particular NÃO o PURCHASE_COMPLETE, que a
          // Hotmart remanda pela MESMA compra ~7,8 dias depois — contar os dois
          // dobraria o comprador (a mesma armadilha que já duplicou crédito em
          // 10/08 e que o painel financeiro também evita).
          .eq("event_type", "PURCHASE_APPROVED")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllPages<SgpPedidoRow>("sgp_pedidos", (from, to) =>
        admin
          .from("sgp_pedidos" as never)
          .select(COLUNAS_PEDIDO)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: SgpPedidoRow[] | null;
          error: { message: string } | null;
        }>,
      ),
      // A assinatura da plataforma HOJE (pedido do Lucas, 09/09). Paginado pelo
      // mesmo motivo dos outros: são 1.160 linhas do produto (medido 09/09),
      // acima do teto silencioso de 1000 do PostgREST — um select cru veria
      // 1000 e diria "não assina" pra quem assina, calado.
      fetchAllPages<EntitlementFastClonerBruto>("entitlements (fastcloner)", (from, to) =>
        admin
          .from("entitlements")
          .select("buyer_email, status, access_until")
          .eq("product_code", produtoFastCloner)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    const compras: CompraSgpBruta[] = [];
    // As cobranças da PLATAFORMA saem da MESMA varredura de eventos: o laço já
    // percorre todo PURCHASE_APPROVED, então a coluna nova não custa uma
    // segunda consulta ao banco.
    const cobrancasFastCloner: CobrancaFastClonerBruta[] = [];
    for (const e of eventos) {
      const data = asRecord(asRecord(e.payload).data);
      const produto = extractProductCode(data);
      const email = extractBuyerEmail(data);

      if (produto === produtoFastCloner && email) {
        const preco = asRecord(asRecord(data.purchase).price);
        const valor = typeof preco.value === "number" ? preco.value : Number(preco.value);
        cobrancasFastCloner.push({
          email,
          valor: Number.isFinite(valor) ? valor : null,
          moeda: typeof preco.currency_value === "string" ? preco.currency_value : null,
          // Valor NUNCA decide sozinho: OVERDUE/DELAYED/BILLET_PRINTED também
          // carregam os R$97 de quem não pagou (incidente de 18/08).
          statusCompra: extractPurchaseStatus(data) || null,
          recebidoEm: e.received_at,
        });
      }

      if (produto !== produtoSgp) continue;
      // Sem e-mail não há como contatar nem como casar com o pedido. Não é
      // descarte silencioso: o resumo devolve a contagem (`comprasSemEmail`).
      if (!email) continue;
      compras.push({
        email,
        nome: extractBuyerName(data),
        telefone: extractBuyerPhone(data),
        recebidoEm: e.received_at,
      });
    }

    const linhas = ordenarCompradores(
      montarCompradores({
        compras,
        pedidos: pedidos ?? [],
        agora: Date.now(),
        fastcloner: { entitlements: entitlements ?? [], cobrancas: cobrancasFastCloner },
      }),
    );

    return jsonOk({
      compradores: linhas,
      resumo: {
        ...resumirCompradores(linhas),
        // Transparência da medição: quantas compras do SGP existem no total e
        // quantas foram descartadas por não ter e-mail. Sem isto, um número que
        // não bate com a Hotmart viraria investigação do zero.
        comprasSgp: compras.length,
        comprasSemEmail: eventos.filter((e) => {
          const data = asRecord(asRecord(e.payload).data);
          return extractProductCode(data) === produtoSgp && !extractBuyerEmail(data);
        }).length,
        pedidos: pedidos.length,
      },
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao carregar os compradores do SGP");
  }
}
