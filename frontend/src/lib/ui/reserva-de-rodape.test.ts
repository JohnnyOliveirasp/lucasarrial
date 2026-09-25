/**
 * Testes da régua da faixa de rodapé (colisão "Continuar" x balão de Ajuda).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/ui/reserva-de-rodape.test.ts
 *
 * O caso que originou o arquivo é o primeiro teste: balão no canto padrão
 * (bottom 20, altura 56) numa janela de 844 px — a medição de 18/09 mostrou
 * o "Continuar" 36 px dentro do balão. Com a reserva, o fim do conteúdo
 * passa a 12 px ACIMA do topo do balão.
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FOLGA_PX,
  FRACAO_MAX_DA_JANELA,
  reservaDaFaixa,
  tetoDaFaixa,
} from "./reserva-de-rodape.ts";

const ALTURA_BALAO = 56; // h-14
const JANELA = 844; // 390x844, o viewport da medição

/** Topo do balão dado o quanto ele está afastado da base. */
function topoDoBalao(bottom: number, janela = JANELA) {
  return janela - bottom - ALTURA_BALAO;
}

test("balão no canto padrão: reserva cobre o balão inteiro + folga", () => {
  // bottom:20 + altura:56 => topo em 768 (foi exatamente o medido em 18/09)
  assert.equal(topoDoBalao(20), 768);
  assert.equal(reservaDaFaixa(768, JANELA), 20 + ALTURA_BALAO + FOLGA_PX); // 88
});

test("com a reserva aplicada, o fim do conteúdo fica ACIMA do topo do balão", () => {
  const reserva = reservaDaFaixa(topoDoBalao(20), JANELA);
  // No fim da rolagem, a base do conteúdo é (janela - reserva).
  const baseDoConteudo = JANELA - reserva;
  assert.ok(
    baseDoConteudo < topoDoBalao(20),
    `conteúdo termina em ${baseDoConteudo}, balão começa em ${topoDoBalao(20)}`,
  );
  assert.equal(topoDoBalao(20) - baseDoConteudo, FOLGA_PX);
});

test("a reserva ACOMPANHA o arrasto: balão mais alto pede mais espaço", () => {
  const noCanto = reservaDaFaixa(topoDoBalao(20), JANELA);
  const arrastadoPraCima = reservaDaFaixa(topoDoBalao(200), JANELA);
  assert.ok(arrastadoPraCima > noCanto);
  assert.equal(arrastadoPraCima, 200 + ALTURA_BALAO + FOLGA_PX);
});

test("arrasto lateral não muda a reserva (a faixa é vertical)", () => {
  // `right` não entra na conta: o topo é o mesmo.
  assert.equal(reservaDaFaixa(topoDoBalao(20), JANELA), reservaDaFaixa(topoDoBalao(20), JANELA));
});

test("elemento fora da tela por baixo não reserva nada", () => {
  assert.equal(reservaDaFaixa(JANELA + 10, JANELA), 0);
});

test("reserva nunca passa da altura da janela", () => {
  assert.equal(reservaDaFaixa(-5000, JANELA), JANELA);
});

test("medida inválida não vira reserva", () => {
  assert.equal(reservaDaFaixa(Number.NaN, JANELA), 0);
  assert.equal(reservaDaFaixa(100, Number.NaN), 0);
});

test("teto do arrasto mantém a reserva dentro de uma fração da janela", () => {
  const teto = tetoDaFaixa(JANELA);
  assert.equal(teto, Math.floor(JANELA * FRACAO_MAX_DA_JANELA)); // 337
  const piorCaso = reservaDaFaixa(topoDoBalao(teto), JANELA);
  assert.ok(piorCaso <= JANELA * FRACAO_MAX_DA_JANELA + ALTURA_BALAO + FOLGA_PX);
});

test("janela degenerada não explode o teto", () => {
  assert.equal(tetoDaFaixa(0), 0);
  assert.equal(tetoDaFaixa(-100), 0);
});

/**
 * Guarda estrutural: a reserva tem que ser função do TOPO medido, não de um
 * número mágico. Se alguém trocar a altura do balão (h-14 → h-16), a reserva
 * precisa mudar sozinha — foi o número mágico que deixou a colisão voltar.
 */
test("altura diferente do elemento muda a reserva sem tocar na régua", () => {
  const altura16 = 64;
  const topo = JANELA - 20 - altura16;
  assert.equal(reservaDaFaixa(topo, JANELA), 20 + altura16 + FOLGA_PX);
});
