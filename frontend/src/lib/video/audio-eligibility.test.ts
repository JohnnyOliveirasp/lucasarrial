/**
 * Teste da elegibilidade de áudio pro vídeo (caso #adc3ed99).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/video/audio-eligibility.test.ts
 *
 * O defeito coberto NÃO é a regra (o teto de 90s está certo), é o SUMIÇO: o
 * áudio acima do teto era filtrado no SQL e a tela dizia "você não tem áudios".
 * O que precisa ficar travado aqui:
 *   1. o corte é o MESMO do backend (estrito, `> max`) — 90s cravado passa,
 *      90,01s não; senão o botão desabilitado e a recusa do servidor divergem;
 *   2. nada some: usáveis + longos = a lista inteira, sem perder item;
 *   3. os usáveis vêm PRIMEIRO (as telas cortam em 20; longo recente não pode
 *      empurrar pra fora o que o aluno pode escolher);
 *   4. a duração vira texto que o aluno entende ("2min28s", não "148").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acimaDoTeto, duracaoLegivel, separarPorTeto } from "./audio-eligibility.ts";

const MAX = 90;

test("teto é estrito: o limite cravado PASSA, um triz acima não", () => {
  assert.equal(acimaDoTeto(89.9, MAX), false);
  assert.equal(acimaDoTeto(90, MAX), false, "90s cravado era aceito pelo .lte(90) da rota");
  assert.equal(acimaDoTeto(90.01, MAX), true);
  assert.equal(acimaDoTeto(148.478, MAX), true, "duração real do caso #adc3ed99");
});

test("duração ausente não é tratada como longa (quem recusa é o servidor)", () => {
  assert.equal(acimaDoTeto(null, MAX), false);
  assert.equal(acimaDoTeto(undefined, MAX), false);
});

test("teto diferente muda o corte (Vídeo Vendas usa 60s)", () => {
  assert.equal(acimaDoTeto(75, 60), true);
  assert.equal(acimaDoTeto(75, 90), false);
});

test("nada some: usáveis + longos = lista inteira", () => {
  const items = [
    { id: "a", duration_seconds: 30 },
    { id: "b", duration_seconds: 148.478 },
    { id: "c", duration_seconds: 90 },
    { id: "d", duration_seconds: 91 },
  ];
  const { usaveis, longos, ordenados } = separarPorTeto(items, MAX);
  assert.deepEqual(usaveis.map((i) => i.id), ["a", "c"]);
  assert.deepEqual(longos.map((i) => i.id), ["b", "d"]);
  assert.equal(usaveis.length + longos.length, items.length);
  assert.equal(ordenados.length, items.length);
  assert.deepEqual(new Set(ordenados.map((i) => i.id)), new Set(items.map((i) => i.id)));
});

test("usáveis primeiro, e a ordem de origem se mantém dentro de cada grupo", () => {
  // Vem da rota em created_at desc: os dois longos são os MAIS RECENTES.
  const items = [
    { id: "longo-recente", duration_seconds: 200 },
    { id: "longo-2", duration_seconds: 120 },
    { id: "curto-1", duration_seconds: 80 },
    { id: "curto-2", duration_seconds: 10 },
  ];
  const { ordenados } = separarPorTeto(items, MAX);
  assert.deepEqual(
    ordenados.map((i) => i.id),
    ["curto-1", "curto-2", "longo-recente", "longo-2"],
  );
});

test("o aluno que SÓ tem áudio longo não tem nenhum usável (é o estado vazio novo)", () => {
  // 22 alunos estavam exatamente aqui em 07/09 e viam "você não tem áudios".
  const { usaveis, longos } = separarPorTeto([{ duration_seconds: 148.478 }], MAX);
  assert.equal(usaveis.length, 0);
  assert.equal(longos.length, 1);
});

test("lista vazia continua vazia (estado 'nunca gerou nada')", () => {
  const { usaveis, longos, ordenados } = separarPorTeto([], MAX);
  assert.deepEqual([usaveis, longos, ordenados], [[], [], []]);
});

test("duração legível: minuto quando passa de 60s, segundo padded", () => {
  assert.equal(duracaoLegivel(8), "8s");
  assert.equal(duracaoLegivel(59.4), "59s");
  assert.equal(duracaoLegivel(90), "1min30s");
  assert.equal(duracaoLegivel(148.478), "2min28s");
  assert.equal(duracaoLegivel(65), "1min05s", "segundo abaixo de 10 vai com zero à esquerda");
  assert.equal(duracaoLegivel(null), "—");
});
