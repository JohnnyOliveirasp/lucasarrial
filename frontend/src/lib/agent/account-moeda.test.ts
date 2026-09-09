/**
 * Testes da moeda/país da cobrança (incidente #319). Rodar (Node ≥ 22.18):
 *   node --test src/lib/agent/account-moeda.test.ts
 *
 * AS AMOSTRAS SÃO REAIS, tiradas de `payment_events` em 09/09/2026 com os
 * campos que a função lê (nada foi reescrito, só recortado):
 *
 *   duartesoaresconsultor@gmail.com — o caso que abriu o chamado. Compra de
 *       19 EUR, comprador em Portugal (country_iso "PT"), e — a armadilha —
 *       `original_offer_price` de 114,29 BRL no MESMO objeto. Ler o campo
 *       errado devolve "BRL" pra um português e reproduz o defeito com cara
 *       de conserto.
 *   carlamsmpro@gmail.com — EUR/PT com ZERO evento `PURCHASE_APPROVED` (só
 *       `PURCHASE_BILLET_PRINTED`). É a prova de que a consulta NÃO pode
 *       copiar o filtro de evento que a garantia usa: 2 dos 3 casos
 *       EUR/Portugal medidos naquele dia são assim.
 *   lucas.m.arrial@gmail.com — BRL/BR, o controle: o conserto não pode calar
 *       sobre quem realmente paga por Pix.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { moedaDaCompra, linhaMoeda, MOEDA_ESCALAR, type EventoMoeda } from "./moeda.ts";

const evento = (moeda: string | null, paisIso: string | null, pais: string | null): EventoMoeda => ({
  payload: {
    data: {
      purchase: moeda ? { price: { currency_value: moeda } } : undefined,
      buyer: paisIso || pais ? { address: { country: pais, country_iso: paisIso } } : undefined,
    },
  },
});

/** Recorte fiel dos eventos do Duarte, do mais recente pro mais antigo. */
const DUARTE: EventoMoeda[] = [
  // PURCHASE_OUT_OF_SHOPPING_CART 09/09 — vem SEM `purchase` e sem endereço.
  { payload: { data: { buyer: {} } } },
  // PURCHASE_DELAYED 06/09
  {
    payload: {
      data: {
        purchase: { price: { currency_value: "EUR" } },
        buyer: { address: { country: "Portugal", country_iso: "PT" } },
      },
    },
  },
  // PURCHASE_BILLET_PRINTED 31/08 (o que gravou o pending_payment_at)
  {
    payload: {
      data: {
        purchase: { price: { currency_value: "EUR" } },
        buyer: { address: { country: "Portugal", country_iso: "PT" } },
      },
    },
  },
];

/** Carla: um único evento, BILLET_PRINTED, sem nenhuma compra aprovada. */
const CARLA: EventoMoeda[] = [
  {
    payload: {
      data: {
        purchase: { price: { currency_value: "EUR" } },
        buyer: { address: { country: "Portugal", country_iso: "PT" } },
      },
    },
  },
];

const LUCAS: EventoMoeda[] = [
  {
    payload: {
      data: {
        purchase: { price: { currency_value: "BRL" } },
        buyer: { address: { country: "Brasil", country_iso: "BR" } },
      },
    },
  },
];

test("(e) aluno EUR: o contexto passa a trazer moeda e país", () => {
  const m = moedaDaCompra(DUARTE);
  assert.deepEqual(m, { moeda: "EUR", paisIso: "PT", pais: "Portugal" });

  const linha = linhaMoeda(m);
  assert.match(linha, /EUR/);
  assert.match(linha, /Portugal/);
});

test("aluno EUR: a linha PROÍBE Pix/boleto/QR Code e manda escalar", () => {
  const linha = linhaMoeda(moedaDaCompra(DUARTE));
  assert.match(linha, /NUNCA instrua Pix, boleto ou QR Code/);
  assert.match(linha, /escale pro humano/);
  assert.match(linha, /Multibanco/);
});

test("armadilha: lê `price`, NUNCA `original_offer_price` (que vem em BRL)", () => {
  // Payload real do Duarte: os dois campos convivem, com moedas diferentes.
  const comArmadilha = [
    {
      payload: {
        data: {
          purchase: {
            price: { currency_value: "EUR" },
            original_offer_price: { value: 114.29, currency_value: "BRL" },
          },
          buyer: { address: { country: "Portugal", country_iso: "PT" } },
        },
      },
    },
  ] as unknown as EventoMoeda[];

  assert.equal(moedaDaCompra(comArmadilha)?.moeda, "EUR");
  assert.doesNotMatch(linhaMoeda(moedaDaCompra(comArmadilha)), /Pix e boleto valem/);
});

test("EUR sem NENHUM PURCHASE_APPROVED (caso Carla) é lido igual — o filtro de evento perderia 2 de 3", () => {
  assert.deepEqual(moedaDaCompra(CARLA), { moeda: "EUR", paisIso: "PT", pais: "Portugal" });
});

test("aluno BRL: o conserto NÃO cala sobre quem paga por Pix de verdade", () => {
  const linha = linhaMoeda(moedaDaCompra(LUCAS));
  assert.match(linha, /BRL/);
  assert.match(linha, /Pix e boleto valem normalmente/);
  assert.doesNotMatch(linha, /NUNCA instrua/);
});

test("vence o evento MAIS RECENTE com moeda legível (a cobrança que está valendo)", () => {
  const trocou = [evento(null, null, null), evento("EUR", "PT", "Portugal"), evento("BRL", "BR", "Brasil")];
  assert.equal(moedaDaCompra(trocou)?.moeda, "EUR");
});

test("o evento vencedor sem endereço herda o país de um evento mais antigo", () => {
  const semEndereco = [evento("EUR", null, null), evento("EUR", "PT", "Portugal")];
  assert.deepEqual(moedaDaCompra(semEndereco), { moeda: "EUR", paisIso: "PT", pais: "Portugal" });
});

test("sem moeda em nenhum evento → NÃO chuta: devolve a linha de não afirmar", () => {
  for (const nada of [[], [evento(null, "BR", "Brasil")], [{}], [{ payload: {} }]] as EventoMoeda[][]) {
    assert.equal(moedaDaCompra(nada), null);
    assert.equal(linhaMoeda(moedaDaCompra(nada)), MOEDA_ESCALAR);
  }
  assert.match(MOEDA_ESCALAR, /NÃO afirme meio de pagamento/);
  assert.doesNotMatch(MOEDA_ESCALAR, /Pix e boleto valem/);
});

test("moeda e país saem normalizados em maiúsculas, com espaço aparado", () => {
  assert.deepEqual(moedaDaCompra([evento(" eur ", " pt ", " Portugal ")]), {
    moeda: "EUR",
    paisIso: "PT",
    pais: "Portugal",
  });
});

test("moeda não-texto (número, objeto) não vira moeda", () => {
  const podre = [
    { payload: { data: { purchase: { price: { currency_value: 19 } } } } },
    { payload: { data: { purchase: { price: { currency_value: {} } } } } },
  ] as unknown as EventoMoeda[];
  assert.equal(moedaDaCompra(podre), null);
});
