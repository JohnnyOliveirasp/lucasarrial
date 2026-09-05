/**
 * Testes da janela de garantia (incidente #265). Rodar (Node ≥ 22.18):
 *   node --test src/lib/agent/account-garantia.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE: `linhaGarantiaHotmart` é a única linha do
 * contexto da Fast que ela é mandada OBEDECER numa conversa sobre dinheiro
 * ("calculado pelo sistema — obedeça esta linha"), e até hoje ela não tinha
 * um teste. Os dois defeitos do #265 passaram despercebidos por 6 dias
 * justamente porque errar aqui não quebra nada: o texto sai bonito e errado.
 *
 * AS AMOSTRAS SÃO REAIS, tiradas de `payment_events` em 05/09/2026 com os
 * campos que a função lê (nada foi reescrito, só recortado):
 *
 *   katiasalvador32@gmail.com — DUAS compras. Uma de R$0 com warranty
 *       30/08 e a paga (15) de 22/08 com warranty 06/09. É o caso que prova
 *       as duas regras ao mesmo tempo: se o filtro de compra PAGA cair, a
 *       janela de R$0 fecha primeiro e a aluna vira "FORA" por causa de uma
 *       adesão que não tem o que reembolsar.
 *   luanmarcal.com@gmail.com — compra paga 29/08, warranty 13/09. Produto de
 *       15 dias. A constante de 7 dias fechava a janela dele em 05/09 05:47Z,
 *       ou seja, ele foi declarado FORA no MESMO dia em que ainda tinha 8 dias
 *       de garantia real. (É o mesmo aluno cujo import quebrou em 29/08 e que
 *       nunca chegou a ter voz — a pessoa com mais motivo pra pedir dinheiro
 *       de volta era justamente a que o sistema mandava calar.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { janelaGarantia, type EventoCompra } from "./garantia.ts";

/** Monta a linha como o `payment_events` entrega (approved_date em epoch ms
 *  STRING, warranty_date em ISO — os dois formatos convivem no mesmo payload,
 *  e foi confundir um com o outro que quase deixou o campo novo cair fora). */
const ev = (approvedMs: string, warranty: string | null, valor: number): EventoCompra => ({
  payload: {
    data: {
      product: warranty === null ? {} : { warranty_date: warranty },
      purchase: { approved_date: approvedMs, price: { value: valor } },
    },
  },
});

const KATIA_R0 = ev("1786800733000", "2026-08-30T00:00:00Z", 0); // 15/08, adesão R$0
const KATIA_PAGA = ev("1787407524000", "2026-09-06T00:00:00Z", 15); // 22/08, paga
const LUAN_PAGA = ev("1787982477000", "2026-09-13T00:00:00Z", 17); // 29/08, paga

test("usa o warranty_date do payload, não sete dias fixos", () => {
  // 05/09 18h — a constante antiga (22/08 + 7d = 29/08) já tinha fechado.
  const j = janelaGarantia([KATIA_R0, KATIA_PAGA], new Date("2026-09-05T18:00:00Z"));
  assert.ok(j);
  assert.equal(j.fim.toISOString(), "2026-09-06T00:00:00.000Z");
  assert.equal(j.dentro, true, "22/08 + 7d dizia FORA; o warranty real diz DENTRO até 06/09");
});

test("compra de R$0 não encurta a janela de quem pagou", () => {
  // A adesão de R$0 fecha em 30/08, ANTES da paga. Se o filtro de pagas cair,
  // a regra do 'fecha primeiro' escolhe a errada e a aluna perde a garantia.
  const j = janelaGarantia([KATIA_R0, KATIA_PAGA], new Date("2026-09-05T18:00:00Z"));
  assert.ok(j);
  assert.notEqual(j.fim.toISOString(), "2026-08-30T00:00:00.000Z");
  assert.equal(j.compra.toISOString(), "2026-08-22T14:05:24.000Z");
});

test("produto de 15 dias: a constante de 7 declarava FORA no dia 7", () => {
  // 05/09 06h — logo depois de 29/08 05:47 + 7d, o instante exato em que a
  // versão anterior virava a chave.
  const j = janelaGarantia([LUAN_PAGA], new Date("2026-09-05T06:00:00Z"));
  assert.ok(j);
  assert.equal(j.dentro, true);
  assert.equal(j.fim.toISOString(), "2026-09-13T00:00:00.000Z");
});

test("entre várias pagas manda a que FECHA PRIMEIRO (nunca promete a mais)", () => {
  const j = janelaGarantia([LUAN_PAGA, KATIA_PAGA], new Date("2026-09-05T18:00:00Z"));
  assert.ok(j);
  assert.equal(j.fim.toISOString(), "2026-09-06T00:00:00.000Z", "06/09 fecha antes de 13/09");
});

test("00:00Z é o FIM da janela, não o começo do último dia", () => {
  // Escolha conservadora: erra pro lado que NÃO promete reembolso a mais.
  const dentro = janelaGarantia([KATIA_PAGA], new Date("2026-09-05T23:59:59Z"));
  const fora = janelaGarantia([KATIA_PAGA], new Date("2026-09-06T00:00:01Z"));
  assert.equal(dentro?.dentro, true);
  assert.equal(fora?.dentro, false);
});

test("sem warranty_date NÃO cai numa constante de reserva: devolve null (ESCALAR)", () => {
  // Foi a constante que produziu o #265. Se a Hotmart parar de mandar o campo,
  // o certo é a Fast calar e chamar gente — não chutar de novo.
  assert.equal(janelaGarantia([ev("1787407524000", null, 15)], new Date("2026-08-23T00:00:00Z")), null);
});

test("warranty_date ilegível não vira data zero nem 1970", () => {
  for (const lixo of ["", "ontem", "0000-00-00", "não sei"]) {
    assert.equal(janelaGarantia([ev("1787407524000", lixo, 15)], new Date("2026-08-23T00:00:00Z")), null, lixo);
  }
});

test("só compras de R$0 → null, e não uma janela sem nada pra reembolsar", () => {
  assert.equal(janelaGarantia([KATIA_R0], new Date("2026-08-20T00:00:00Z")), null);
});

test("lista vazia → null", () => {
  assert.equal(janelaGarantia([], new Date("2026-09-05T18:00:00Z")), null);
});

test("FORA continua sendo FORA depois do warranty real", () => {
  const j = janelaGarantia([KATIA_PAGA], new Date("2026-09-20T00:00:00Z"));
  assert.ok(j);
  assert.equal(j.dentro, false);
});
