/**
 * SGP — as duas perguntas que o PORTÃO da tela 1 faz ao banco:
 * "este e-mail tem compra CONFIRMADA do SGP?" e "ele já tem pedido no portal?"
 *
 * A decisão em si mora em `portao-inicio.ts` (puro, testado); aqui é só o I/O.
 *
 * ⚠️ POR QUE VARRE `payment_events` INTEIRO em vez de filtrar no banco: o id do
 * produto vive dentro do JSON (`payload.data.product.id`) e vem como NÚMERO nos
 * payloads reais do 7283229 — filtro PostgREST em cima disso depende de coerção
 * e falha CALADO, devolvendo zero (é o mesmo motivo documentado em
 * `admin/sgp/compradores/route.ts`, que já paga esse custo a cada carregamento
 * do painel). E a coluna `buyer_email` não serve de atalho: `chaveEmail` funde
 * variantes do Gmail (ponto e +tag) que um `.ilike()` no endereço literal
 * perderia — `luciano.rezende.filho@` comprou como `lucianorezendefilho@`
 * (caso real do cabeçalho de `montarCompradores`). Uma régua, uma chave:
 * as MESMAS de `compradores.ts`, senão o portão barra quem o painel de
 * compradores chama de comprador.
 *
 * ⚠️ PAGINADO (incidente 72a4c9db): o PostgREST corta select sem range em 1000
 * linhas EM SILÊNCIO, e já são ~2.000 PURCHASE_APPROVED — um select cru veria
 * metade e barraria comprador de verdade. `fetchAllPages` ABORTA em erro:
 * portão que degrada pra "não achei compra" expulsaria pagante em falha de
 * rede, então erro aqui SOBE e a rota responde 500, nunca "sem compra".
 */
import { getAdmin } from "@/lib/db/admin";
import { fetchAllPages } from "@/lib/db/paginate";
import { asRecord, extractBuyerEmail, extractProductCode } from "@/lib/payments/hotmart-payload";
import { SGP_PRODUCT_ID_PADRAO } from "@/lib/payments/sgp-boas-vindas";
import { chaveEmail } from "./compradores";

/**
 * Existe PURCHASE_APPROVED do produto SGP pra `chaveEmail(email)`?
 *
 * SÓ PURCHASE_APPROVED, como no painel de compradores: o PURCHASE_COMPLETE é a
 * MESMA compra remandada ~7,8 dias depois, e qualquer outro evento (OVERDUE,
 * BILLET_PRINTED...) é cobrança que não entrou — não é compra confirmada.
 */
export async function temCompraSgpConfirmada(email: string): Promise<boolean> {
  const chave = chaveEmail(email);
  if (!chave.includes("@")) return false;
  // Mesma resolução do webhook e do painel: ambiente manda, padrão segura.
  const produtoSgp = process.env.HOTMART_SGP_PRODUCT_ID ?? SGP_PRODUCT_ID_PADRAO;
  const eventos = await fetchAllPages<{ payload: unknown }>(
    "payment_events PURCHASE_APPROVED (portão sgp)",
    (from, to) =>
      getAdmin()
        .from("payment_events")
        .select("payload")
        .eq("event_type", "PURCHASE_APPROVED")
        .order("id", { ascending: true })
        .range(from, to),
  );
  return eventos.some((e) => {
    const data = asRecord(asRecord(e.payload).data);
    if (extractProductCode(data) !== produtoSgp) return false;
    const comprador = extractBuyerEmail(data);
    return comprador !== null && chaveEmail(comprador) === chave;
  });
}

/**
 * Já existe pedido em `sgp_pedidos` com essa `chaveEmail`?
 *
 * É a cláusula de quem JÁ estava dentro (ver `portao-inicio.ts`, caso das 12
 * pessoas do webhook cego). Só pedidos com e-mail contam — e no app o e-mail
 * só entra em `sgp_pedidos` por `/sgp/inicio` (verificado 24/09: nenhuma outra
 * rota grava `email` lá; o que existe fora é importação/ferramenta da casa).
 * Como o barrado é recusado ANTES de `atualizarSessao`, o e-mail dele nunca
 * chega à tabela — ninguém se auto-avaliza tentando de novo.
 */
export async function temPedidoNoPortal(email: string): Promise<boolean> {
  const chave = chaveEmail(email);
  if (!chave.includes("@")) return false;
  const pedidos = await fetchAllPages<{ email: string | null }>(
    "sgp_pedidos e-mails (portão sgp)",
    (from, to) =>
      getAdmin()
        .from("sgp_pedidos" as never)
        .select("email")
        .not("email", "is", null)
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: { email: string | null }[] | null;
        error: { message: string } | null;
      }>,
  );
  return pedidos.some((p) => p.email !== null && chaveEmail(p.email) === chave);
}
