/**
 * Trava do #560: cartão fechado sem motivo NUNCA ganha um motivo inventado.
 *
 * O que se exibe no lugar do vazio é a última anotação COM RÓTULO — e o rótulo
 * é o ponto: sem ele, uma objeção do Vigia ("discordo deste fechamento") vira
 * "o motivo do fechamento" na tela. 13 dos 37 cartões sem motivo tinham
 * exatamente isso como última nota (medido 24/09).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ROTULO_SEM_MOTIVO,
  fallbackMotivoRotulado,
  motivoFechamentoExibicao,
  ultimaNotaComTexto,
} from "./motivo-fechamento.ts";

// LITERAL de propósito, não a constante importada: comparar com a própria
// constante é tautologia — um rótulo mutado pra "" passaria em silêncio
// (medido aqui mesmo, na primeira versão deste arquivo). Se alguém mudar o
// texto do rótulo, este teste TEM que quebrar e forçar a mudança consciente
// nos dois lugares.
const ROTULO_LITERAL = "Sem motivo registrado no fechamento.";

const notas = [
  { at: "2026-09-01T10:00:00Z", by: "frank", note: "primeira investigação" },
  { at: "2026-09-02T03:00:00Z", by: "vigia", note: "OBJECAO DE PROCESSO (14-A: anoto, nao reabro)" },
];

test("a constante exportada É o rótulo literal", () => {
  assert.equal(ROTULO_SEM_MOTIVO, ROTULO_LITERAL);
});

test("vazio + notas => mostra a última anotação ROTULADA", () => {
  const out = fallbackMotivoRotulado(null, notas);
  assert.ok(out, "devia ter fallback");
  assert.ok(out.startsWith(ROTULO_LITERAL), "o rótulo é obrigatório e vem PRIMEIRO");
  assert.ok(out.includes("2026-09-02T03:00:00Z"), "data da nota");
  assert.ok(out.includes("vigia"), "autor da nota");
  assert.ok(out.includes("OBJECAO DE PROCESSO"), "texto da última nota, não da primeira");
  assert.ok(!out.includes("primeira investigação"), "é a ÚLTIMA nota, não a primeira");
});

test("vazio + sem notas => null, sem quebrar (vazio honesto fica vazio)", () => {
  assert.equal(fallbackMotivoRotulado(null, []), null);
  assert.equal(fallbackMotivoRotulado(null, null), null);
  assert.equal(fallbackMotivoRotulado(undefined, undefined), null);
  assert.equal(motivoFechamentoExibicao(null, []), null);
});

test("motivo preenchido => exibe o motivo real e NÃO o fallback", () => {
  const motivo = "--- 2026-09-03 (frank) ---\njob reprocessado e entregue";
  assert.equal(fallbackMotivoRotulado(motivo, notas), null);
  assert.equal(motivoFechamentoExibicao(motivo, notas), motivo);
});

test("motivo só com espaços conta como vazio", () => {
  const out = motivoFechamentoExibicao("   \n", notas);
  assert.ok(out?.startsWith(ROTULO_LITERAL));
});

test("agent_notes corrompido (string) => null, não inventa nota", () => {
  assert.equal(fallbackMotivoRotulado(null, "[object Object],[object Object]"), null);
});

test("última nota sem texto => pula pra anterior com texto", () => {
  const comVazia = [...notas, { at: "2026-09-03T00:00:00Z", by: "x", note: "   " }];
  const nota = ultimaNotaComTexto(comVazia);
  assert.equal(nota?.by, "vigia");
});

test("nota sem at/by não quebra: rotula como desconhecido", () => {
  const out = fallbackMotivoRotulado(null, [{ note: "texto solto" }]);
  assert.ok(out?.includes("data desconhecida"));
  assert.ok(out?.includes("autor desconhecido"));
});

test("formatarData é aplicado quando fornecido", () => {
  const out = fallbackMotivoRotulado(null, notas, () => "02/09 03:00");
  assert.ok(out?.includes("(02/09 03:00, vigia)"));
});
