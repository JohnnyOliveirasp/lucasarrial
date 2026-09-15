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
import { janelaGarantia, janelasPorProduto, blocoGarantiaMultiProduto, type EventoCompra } from "./garantia.ts";

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

/* ────────────────────────────────────────────────────────────────────────────
 * IDENTIDADE DE PRODUTO (#265, falso positivo da Evelyn — Vigia 14/09 10hZ/12hZ)
 *
 * AMOSTRA REAL, recortada de `payment_events` em 15/09/2026 (nada reescrito):
 *   evelyn.cheida@gmail.com — DUAS compras de produtos DIFERENTES.
 *     Sistema de Geração Pronto (7283229) · R$ 617,12 · 07/09 · warranty 14/09
 *     FastCloner (7851642) · R$ 0 adesão trial · 10/09 · date_next_charge 17/09 12:00Z
 *   A casa respondeu a ela "sua compra [FastCloner] foi feita em 07/09 e a
 *   garantia vai até 13/09". AS DUAS DATAS ERAM DO OUTRO PRODUTO.
 * ──────────────────────────────────────────────────────────────────────────── */
const evP = (
  pid: string,
  nome: string,
  approvedMs: string,
  warranty: string | null,
  valor: number,
  nextCharge?: string,
): EventoCompra => ({
  payload: {
    data: {
      product: warranty === null ? { id: pid, name: nome } : { id: pid, name: nome, warranty_date: warranty },
      purchase: { approved_date: approvedMs, price: { value: valor }, date_next_charge: nextCharge },
    },
  },
});

const EVELYN_SGP = evP("7283229", "Sistema de Geração Pronto", "1788818903000", "2026-09-14T00:00:00Z", 617.12);
const EVELYN_FC = evP("7851642", "FastCloner", "1789078887000", "2026-09-17T00:00:00Z", 0, "1789646400000");

test("Evelyn: o produto que ela perguntou NÃO herda a data do outro", () => {
  // 15/09 — a janela do SGP já fechou (14/09) e era ela que a linha única citava.
  const ps = janelasPorProduto([EVELYN_SGP, EVELYN_FC], new Date("2026-09-15T15:00:00Z"));
  assert.equal(ps.length, 2, "dois produtos = duas linhas, nunca uma só sem dono");

  const fc = ps.find((p) => p.produtoId === "7851642");
  assert.ok(fc);
  assert.equal(fc.estado, "adesao0", "adesão de R$ 0 não tem o que reembolsar — a regra NÃO muda");
  assert.equal(
    fc.primeiraCobranca?.toISOString(),
    "2026-09-17T12:00:00.000Z",
    "date_next_charge é a única data que importa pra quem está em adesão trial",
  );
  // O defeito em uma linha: a data do SGP NUNCA pode sair como sendo do FastCloner.
  assert.notEqual(fc.fim?.toISOString(), "2026-09-14T00:00:00.000Z");

  const sgp = ps.find((p) => p.produtoId === "7283229");
  assert.equal(sgp?.fim?.toISOString(), "2026-09-14T00:00:00.000Z");
  assert.equal(sgp?.estado, "fora");
});

test("produto DIFERENTE com janela viva não é declarado FORA pela âncora do outro", () => {
  // A classe dos 3 medidos em 15/09 (claudiobeneditod, leleodacuca, silvaporto):
  // âncora = SGP fechado; vivo = FastCloner até 21/09. A linha única dizia FORA.
  const sgpFechado = evP("7283229", "Sistema de Geração Pronto", "1788818903000", "2026-09-13T00:00:00Z", 617.12);
  const fcVivo = evP("7851642", "FastCloner", "1789078887000", "2026-09-21T00:00:00Z", 97);
  const agora = new Date("2026-09-15T15:00:00Z");

  assert.equal(janelaGarantia([sgpFechado, fcVivo], agora)?.dentro, false, "a linha única segue dizendo FORA");

  const ps = janelasPorProduto([sgpFechado, fcVivo], agora);
  assert.equal(ps.find((p) => p.produtoId === "7851642")?.estado, "dentro", "mas o FastCloner dele está DENTRO");
  assert.equal(ps.find((p) => p.produtoId === "7283229")?.estado, "fora");
});

test("renovação do MESMO produto continua colapsando — a política é do Johnny, não minha", () => {
  // 73 dos 76 casos são isto. Se este teste começar a devolver 2 linhas, alguém
  // decidiu política de dinheiro dentro de um conserto de atribuição.
  const ciclo1 = evP("7851642", "FastCloner", "1787407524000", "2026-08-29T00:00:00Z", 97);
  const ciclo2 = evP("7851642", "FastCloner", "1789078887000", "2026-09-21T00:00:00Z", 97);
  const ps = janelasPorProduto([ciclo1, ciclo2], new Date("2026-09-15T15:00:00Z"));
  assert.equal(ps.length, 1, "mesmo produto = UMA linha");
  assert.equal(ps[0].fim?.toISOString(), "2026-08-29T00:00:00.000Z", "segue valendo a que FECHA PRIMEIRO");
  assert.equal(ps[0].estado, "fora");
  // ...e a ORDEM das linhas não pode mudar o veredito: a consulta do account.ts
  // não tem ORDER BY, então quem decide a ordem é o plano do Postgres.
  const invertido = janelasPorProduto([ciclo2, ciclo1], new Date("2026-09-15T15:00:00Z"));
  assert.deepEqual(invertido[0].fim, ps[0].fim, "veredito de dinheiro não pode depender da ordem das linhas");
  assert.equal(invertido[0].estado, ps[0].estado);
});

test("compra PAGA ganha da adesão de R$ 0 do MESMO produto", () => {
  const adesao = evP("7851642", "FastCloner", "1787407524000", "2026-08-29T00:00:00Z", 0, "1789646400000");
  const paga = evP("7851642", "FastCloner", "1789078887000", "2026-09-21T00:00:00Z", 97);
  const ps = janelasPorProduto([adesao, paga], new Date("2026-09-15T15:00:00Z"));
  assert.equal(ps.length, 1);
  assert.equal(ps[0].estado, "dentro", "existe compra paga: há o que reembolsar");
  assert.equal(ps[0].fim?.toISOString(), "2026-09-21T00:00:00.000Z");
  assert.equal(ps[0].primeiraCobranca?.toISOString(), "2026-09-17T12:00:00.000Z", "não perde o dado da adesão");
});

test("um produto só: nada muda (é a maioria da base, não pode regredir)", () => {
  const ps = janelasPorProduto([EVELYN_SGP], new Date("2026-09-05T18:00:00Z"));
  assert.equal(ps.length, 1);
  assert.equal(ps[0].estado, "dentro");
});

/* ────────────────────────────────────────────────────────────────────────────
 * A REVISÃO DE 15/09 (segunda opinião antes do merge, regra 14-B)
 *
 * Os 16 testes acima passavam verdes e NÃO tocavam em uma letra do texto que
 * chega no prompt da Fast — que é a única coisa que ela obedece. Os cinco
 * abaixo existem por causa disso. Nenhum deles tem ocorrência viva hoje
 * (medido em 15/09 nas 2.308 compras: `product.id` presente em 2.308,
 * `price.value` numérico em 2.308, `warranty_date` presente em 2.308) — eles
 * travam o dia em que isso mudar, que é quando o erro custa dinheiro.
 * ──────────────────────────────────────────────────────────────────────────── */

test("compra sem identidade de produto NÃO some em silêncio: vira 'indefinida' e escala", () => {
  // A versão anterior dava `continue` e a linha sumia junto com o veredito dela.
  // Se fosse a que fecha primeiro, o texto virava DENTRO onde a linha única
  // dizia FORA — a casa prometendo reembolso que não deve.
  const ps = janelasPorProduto([KATIA_PAGA, LUAN_PAGA], new Date("2026-09-05T18:00:00Z"));
  assert.equal(ps.length, 1, "sem id nem nome, tudo cai num balde que só sabe dizer 'escale'");
  assert.equal(ps[0].identificado, false);
  assert.equal(ps[0].estado, "indefinida");
  assert.equal(ps[0].fim, null, "nunca publica a data de uma compra que não sabe de quem é");
});

test("preço ILEGÍVEL não é 'adesão de R$ 0': ignorância nunca vira afirmação", () => {
  // `Number("617,12") > 0` é false. A versão anterior imprimia, pra uma compra
  // de R$ 617, "adesão de R$ 0, NÃO há valor a reembolsar".
  const torto: EventoCompra = {
    payload: {
      data: {
        product: { id: "7283229", name: "SGP", warranty_date: "2026-09-21T00:00:00Z" },
        purchase: { approved_date: "1788818903000", price: { value: "617,12" } },
      },
    },
  };
  const ps = janelasPorProduto([torto], new Date("2026-09-15T15:00:00Z"));
  assert.equal(ps[0].estado, "indefinida", "não sei ler o preço ≠ a compra foi de graça");
});

test("dois produtos, um DENTRO e outro FORA: o bloco manda NÃO prometer reembolso e escalar", () => {
  // A primeira versão deste texto perdeu as três instruções do #198 na ponta
  // FORA e deixou só "→ FORA da janela." solto.
  const sgpFechado = evP("7283229", "Sistema de Geração Pronto", "1788818903000", "2026-09-13T00:00:00Z", 617.12);
  const fcVivo = evP("7851642", "FastCloner", "1789078887000", "2026-09-21T00:00:00Z", 97);
  const agora = new Date("2026-09-15T15:00:00Z");
  const bloco = blocoGarantiaMultiProduto(janelasPorProduto([sgpFechado, fcVivo], agora), agora);
  assert.ok(bloco);
  assert.match(bloco, /NÃO prometa reembolso deste produto; escale pro humano/);
  assert.match(bloco, /cobrança indevida/, "a orientação de renovação não pode sumir do caminho multi-produto");
  assert.match(bloco, /PERGUNTE antes de dizer qualquer data/);
  assert.match(bloco, /FastCloner: comprado em .* DENTRO da janela/);
  assert.match(bloco, /Sistema de Geração Pronto: comprado em .* FORA da janela/);
  // #198: a data da COMPRA some do bloco e o modelo pega o "Cadastro em:" do
  // resto do prompt — foi assim que o incidente nasceu.
  assert.match(bloco, /comprado em \d{2}\/\d{2}\/\d{4}/);
});

test("nenhuma janela confirmada → null, pra o chamador mandar ESCALAR (nunca negar garantia)", () => {
  // Dois produtos, os dois só com adesão de R$ 0: não há veredito a obedecer.
  // Afirmar "não há garantia" seria trocar ESCALAR por uma negativa de dinheiro.
  const a = evP("7851642", "FastCloner", "1789078887000", "2026-09-21T00:00:00Z", 0, "1789646400000");
  const b = evP("7283229", "SGP", "1788818903000", "2026-09-14T00:00:00Z", 0);
  const agora = new Date("2026-09-15T15:00:00Z");
  assert.equal(blocoGarantiaMultiProduto(janelasPorProduto([a, b], agora), agora), null);
});

test("um produto só nunca gera bloco multi-produto", () => {
  const agora = new Date("2026-09-05T18:00:00Z");
  assert.equal(blocoGarantiaMultiProduto(janelasPorProduto([EVELYN_SGP], agora), agora), null);
  assert.equal(blocoGarantiaMultiProduto([], agora), null);
});
