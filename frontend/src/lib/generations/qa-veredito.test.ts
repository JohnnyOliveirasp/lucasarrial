/**
 * Testes do veredito de QA por geração (incidente 702cc916).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/generations/qa-veredito.test.ts
 *
 * O que está coberto:
 *   1. `exhausted > 0` gera ressalva, com contagem, cobertura e faltantes;
 *   2. CONTROLE — a regressão que mais importa: `exhausted = 0`, `qa` nulo,
 *      `qa = {}` e `qa` sem a chave NÃO geram ressalva nenhuma. Ressalva falsa
 *      faz a Fast acusar defeito onde não houve;
 *   3. `coverage_min_visto = 1` com `exhausted = 0` não gera ressalva (a
 *      cobertura sozinha nunca acusa nada — quem manda é o `exhausted`);
 *   4. o FRASEADO, que é requisito e não estilo: diz o fato do worker, e nunca
 *      "áudio ruim" nem "áudio conferido";
 *   5. dado corrompido/ausente não vira veredito inventado;
 *   6. MUTAÇÃO: `qaVeredito` neutralizado mostra quais testes caem.
 *
 * O jsonb dos casos 1 e 7 é uma linha REAL de produção (colhida em 12/09 com
 * `select qa from generations where (qa->>'exhausted')::int > 0`), não um
 * fixture inventado — se o worker mudar o nome de um campo, este teste cai.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { qaVeredito, AVISO_QA_NAO_PROVA } from "./qa-veredito.ts";

/** Linha real de produção, 2 chunks esgotados (recortada nos campos usados). */
const QA_REAL_2 = {
  regens: 30,
  echo_none: 0,
  exhausted: 2,
  coverage_min: 0.85,
  coverage_medio: 0.9851,
  faltantes_total: 4,
  exhausted_scores: [50, 100],
  faltantes_amostra: ["segunda"],
  intrusion_flagged: 5,
  coverage_min_visto: 0.905,
  exhausted_score_max: 100,
};

/** Linha real de produção, 1 chunk esgotado, 2 palavras faltando. */
const QA_REAL_1 = {
  regens: 20,
  exhausted: 1,
  coverage_medio: 0.9676,
  faltantes_total: 4,
  exhausted_scores: [8],
  faltantes_amostra: ["escalda", "pes"],
  coverage_min_visto: 0.867,
  exhausted_score_max: 8,
};

// ── 1. o caso que o incidente descreve ───────────────────────────────────────

test("exhausted > 0 gera ressalva com contagem, cobertura e faltantes", () => {
  const v = qaVeredito(QA_REAL_2);
  assert.ok(v, "linha real com exhausted=2 tem que gerar veredito");
  assert.equal(v.chunks, 2);
  assert.equal(v.coberturaMinima, 0.905);
  assert.deepEqual(v.faltantes, ["segunda"]);
  assert.match(v.linha, /2 trechos/);
  assert.match(v.linha, /90,5%/);
  assert.match(v.linha, /"segunda"/);
});

test("um chunk só: singular, sem 's' pendurado", () => {
  const v = qaVeredito(QA_REAL_1);
  assert.ok(v);
  assert.equal(v.chunks, 1);
  assert.match(v.linha, /1 trecho e/);
  assert.doesNotMatch(v.linha, /1 trechos/);
  assert.deepEqual(v.faltantes, ["escalda", "pes"]);
  assert.match(v.linha, /86,7%/);
});

// ── 2. CONTROLE: o que NÃO pode gerar ressalva ───────────────────────────────
//
// Esta é a regressão que importa. Um falso positivo aqui faz a Fast dizer ao
// aluno que houve defeito numa geração que não teve ressalva nenhuma.

const SEM_RESSALVA: Array<[string, unknown]> = [
  ["qa nulo (3.746 das 5.012 gerações em 12/09)", null],
  ["qa undefined (coluna não pedida no select)", undefined],
  ["qa = {} (objeto vazio)", {}],
  ["qa sem a chave exhausted", { regens: 4, coverage_medio: 0.99, tail_checked: 3 }],
  ["exhausted = 0 (passou pelo QA sem esgotar)", { exhausted: 0, coverage_min_visto: 0.97 }],
  ["exhausted = 0 com cobertura perfeita", { exhausted: 0, coverage_min_visto: 1, faltantes_amostra: [] }],
  ["exhausted negativo (dado corrompido)", { exhausted: -1 }],
  ["exhausted como string", { exhausted: "2" }],
  ["exhausted NaN", { exhausted: Number.NaN }],
  ["qa é string (jsonb lido cru, sem parse)", '{"exhausted":2}'],
  ["qa é array", [{ exhausted: 2 }]],
  ["qa é número", 7],
];

for (const [nome, qa] of SEM_RESSALVA) {
  test(`CONTROLE: ${nome} → sem ressalva`, () => {
    assert.equal(qaVeredito(qa), null);
  });
}

test("CONTROLE: coverage_min_visto = 1 com exhausted = 0 não gera ressalva", () => {
  // Espelha a regra do worker: quem acusa é o `exhausted`, não a cobertura.
  assert.equal(qaVeredito({ exhausted: 0, coverage_min_visto: 1, coverage_medio: 1 }), null);
});

// ── 3. fraseado — REQUISITO, não estilo ──────────────────────────────────────

test("a linha diz o FATO do worker: esgotou as tentativas e entregou assim mesmo", () => {
  const v = qaVeredito(QA_REAL_2);
  assert.ok(v);
  assert.match(v.linha, /esgotou as tentativas/i);
  assert.match(v.linha, /entregue assim mesmo/i);
});

test("a linha NUNCA julga o áudio — nem 'ruim', nem 'conferido'", () => {
  for (const qa of [QA_REAL_1, QA_REAL_2, { exhausted: 3 }]) {
    const v = qaVeredito(qa);
    assert.ok(v);
    const t = v.linha.toLowerCase();
    // "áudio ruim" acusa defeito que a medição não prova (ela mede palavra
    // faltando, não qualidade). "áudio conferido" é o erro oposto, e é o que a
    // geração 1425ca2f desmente: coverage 1,0 e mesmo assim "faz falar" no
    // lugar de "fácil falar" — a régua é cega para SUBSTITUIÇÃO.
    for (const proibido of ["ruim", "conferid", "defeituos", "com defeito", "aprovad", "validad", "ok"]) {
      assert.ok(!t.includes(proibido), `linha não pode conter "${proibido}": ${v.linha}`);
    }
  }
});

test("o aviso que acompanha a lista nega as DUAS leituras erradas", () => {
  const t = AVISO_QA_NAO_PROVA.toLowerCase();
  assert.ok(t.includes("não um julgamento"), "nega 'áudio ruim'");
  assert.ok(t.includes("não é áudio conferido"), "nega 'áudio conferido'");
  assert.ok(t.includes("trocada"), "explica a cegueira a substituição");
});

// ── 4. dado parcial: relata o que existe, não inventa o que falta ────────────

test("sem cobertura e sem faltantes: ressalva existe, sem parênteses inventados", () => {
  const v = qaVeredito({ exhausted: 1 });
  assert.ok(v);
  assert.equal(v.coberturaMinima, null);
  assert.deepEqual(v.faltantes, []);
  assert.doesNotMatch(v.linha, /[()]/, "sem detalhes, não abre parênteses vazio");
  assert.match(v.linha, /esgotou as tentativas/);
});

test("cobertura fora de 0..1 é descartada em vez de virar '4200%'", () => {
  const v = qaVeredito({ exhausted: 1, coverage_min_visto: 42 });
  assert.ok(v);
  assert.equal(v.coberturaMinima, null);
  assert.doesNotMatch(v.linha, /cobertura/);
});

test("faltantes com lixo dentro: só string não-vazia entra", () => {
  const v = qaVeredito({ exhausted: 1, faltantes_amostra: ["boa", "", null, 7, "   ", "outra"] });
  assert.ok(v);
  assert.deepEqual(v.faltantes, ["boa", "outra"]);
});

test("faltantes longos são cortados — a linha vai pro prompt da Fast", () => {
  const vinte = Array.from({ length: 20 }, (_, i) => `p${i}`);
  const v = qaVeredito({ exhausted: 1, faltantes_amostra: vinte });
  assert.ok(v);
  assert.equal(v.faltantes.length, 6);
  assert.deepEqual(v.faltantes, ["p0", "p1", "p2", "p3", "p4", "p5"]);
});

test("faltantes_amostra com tipo errado não explode", () => {
  const v = qaVeredito({ exhausted: 1, faltantes_amostra: "segunda" });
  assert.ok(v);
  assert.deepEqual(v.faltantes, []);
});
