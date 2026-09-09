/**
 * A MOEDA e o PAÍS da cobrança do aluno — decisão separada da consulta e da
 * formatação (que ficam em `account.ts`), igual `garantia.ts`.
 *
 * MÓDULO PURO, SEM NENHUM IMPORT: precisa ser testável com `node --test`, sem
 * banco, sem alias `@/` e sem bundler.
 *
 * ── POR QUE ESTE ARQUIVO NASCEU (incidente #319, 09/09/2026) ───────────────
 * `buildAccountContext` não carregava moeda nem país. Sem esse dado, a única
 * coisa que sobrava pra Fast era o roteiro de Pix do `manual.ts` — que é
 * Brasil-only. Resultado medido, com nome e data: em 09/09 ela mandou o
 * roteiro do Pix pro Duarte Soares (`duartesoaresconsultor@gmail.com`,
 * profile b1006494), que respondeu 3x em 4 minutos dizendo que está em
 * PORTUGAL, que precisa ser MULTIBANCO (entidade + referência) e que a
 * cobrança "já não se encontra a pagamento". A compra dele é de 19 EUR.
 * Não é caso isolado: já houve outro comprador português (incidente #214).
 *
 * O QUE ESTE MÓDULO **NÃO** FAZ: implementar Multibanco, nem qualquer fluxo
 * de pagamento estrangeiro. Ele só entrega o FATO (moeda/país) pra Fast parar
 * de AFIRMAR meio de pagamento errado. Quando não é BRL, o desfecho certo é
 * não prescrever nada e escalar.
 *
 * ── DUAS ARMADILHAS DO PAYLOAD DA HOTMART, as duas medidas no banco ────────
 *
 * 1) NÃO FILTRE POR `PURCHASE_APPROVED`. É o que `linhaGarantiaHotmart` faz,
 *    e copiar aquele filtro aqui perderia justamente quem mais importa: quem
 *    tem cobrança PENDENTE frequentemente NUNCA teve compra aprovada. Medido
 *    em 09/09 nos 101 perfis com pendência vencida e sem acesso, 4 são
 *    EUR/Portugal — e 2 dos 4 têm ZERO evento `PURCHASE_APPROVED`:
 *      duartesoaresconsultor@gmail.com  APPROVED=1  EUR/PT
 *      aneto2@gmail.com                 APPROVED=1  EUR/PT
 *      carlamsmpro@gmail.com            APPROVED=0  EUR/PT  (só BILLET_PRINTED)
 *      info.claudiamonteiro@gmail.com   APPROVED=0  EUR/PT  (só BILLET_PRINTED)
 *    Ou seja: o filtro do garantia.ts acertaria 2 de 4. A moeda se lê de
 *    QUALQUER evento da Hotmart daquele e-mail.
 *
 * 2) `price` ≠ `original_offer_price`. O payload do Duarte traz, no MESMO
 *    objeto:
 *      purchase.price                = { value: 19,     currency_value: "EUR" }
 *      purchase.original_offer_price = { value: 114.29, currency_value: "BRL" }
 *    `original_offer_price` é o preço de tabela da oferta convertido, NÃO o
 *    que foi cobrado. Ler o campo errado devolveria "BRL" pra um português e
 *    reproduziria o defeito com cara de conserto. Só `price` vale.
 */

/** Linha crua do `payment_events` — só os campos que esta conta lê. */
export type EventoMoeda = {
  payload?: {
    data?: {
      // ⚠️ `original_offer_price` existe e NÃO entra aqui de propósito (ver cabeçalho).
      purchase?: { price?: { currency_value?: unknown } };
      buyer?: { address?: { country?: unknown; country_iso?: unknown } };
    };
  };
};

export type MoedaCompra = {
  /** ISO da moeda em maiúsculas ("BRL", "EUR"…). */
  moeda: string;
  /** ISO-2 do país do comprador ("BR", "PT") ou null. */
  paisIso: string | null;
  /** Nome do país como a Hotmart manda ("Portugal") ou null. */
  pais: string | null;
};

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Em que moeda esta pessoa é cobrada?
 *
 * @param linhas eventos da Hotmart do e-mail, JÁ ordenados do mais recente pro
 *   mais antigo. Vence o evento mais recente que tenha moeda legível: é a
 *   cobrança que está valendo agora.
 *
 * Devolve `null` quando nenhum evento traz moeda (ex.: só
 * `PURCHASE_OUT_OF_SHOPPING_CART`, que vem sem `purchase`). `null` aqui vira
 * a linha de NÃO AFIRMAR — silêncio, nunca chute: chutar "BRL" é exatamente
 * como o defeito começou.
 */
export function moedaDaCompra(linhas: EventoMoeda[]): MoedaCompra | null {
  let escolhido: MoedaCompra | null = null;

  for (const linha of linhas ?? []) {
    const data = linha?.payload?.data;
    const endereco = data?.buyer?.address;
    const paisIso = texto(endereco?.country_iso)?.toUpperCase() ?? null;
    const pais = texto(endereco?.country) ?? null;

    if (!escolhido) {
      const moeda = texto(data?.purchase?.price?.currency_value)?.toUpperCase() ?? null;
      if (moeda) escolhido = { moeda, paisIso, pais };
      continue;
    }

    // Já temos a moeda; só completamos o país se o evento vencedor não trouxe
    // (evento de carrinho abandonado, por exemplo, vem sem `address`).
    if (!escolhido.paisIso && paisIso) escolhido.paisIso = paisIso;
    if (!escolhido.pais && pais) escolhido.pais = pais;
  }

  return escolhido;
}

/** Sem moeda confirmada a Fast CALA sobre meio de pagamento (não chuta Pix). */
export const MOEDA_ESCALAR =
  `COBRANÇA (calculado pelo sistema — obedeça esta linha): NÃO foi possível confirmar a moeda ` +
  `desta conta. NÃO afirme meio de pagamento — não diga "é só pagar o Pix", não mande gerar QR ` +
  `Code nem boleto. Se a pessoa perguntar como pagar, escale pro humano.`;

/** Texto que entra no contexto da Fast. Mora aqui pra ser testado junto da decisão. */
export function linhaMoeda(m: MoedaCompra | null): string {
  if (!m) return MOEDA_ESCALAR;

  const onde = m.pais ?? m.paisIso;
  const sufixoPais = onde ? ` · comprador em ${onde}` : "";
  const cabeca = `COBRANÇA (calculado pelo sistema — obedeça esta linha): a compra desta pessoa é em ${m.moeda}${sufixoPais}. `;

  if (m.moeda === "BRL") {
    return cabeca + `Cobrança brasileira: Pix e boleto valem normalmente pra ela.`;
  }

  return (
    cabeca +
    `NÃO é cobrança brasileira. NUNCA instrua Pix, boleto ou QR Code — esses meios só existem no ` +
    `Brasil e a pessoa NÃO consegue pagar por eles. O meio local é outro (em Portugal, Multibanco: ` +
    `entidade + referência) e NÓS não emitimos esse meio por aqui: não invente instrução, não peça ` +
    `pra "gerar de novo". Se a pessoa perguntar como pagar, ou disser que a cobrança sumiu/expirou, ` +
    `escale pro humano.`
  );
}
