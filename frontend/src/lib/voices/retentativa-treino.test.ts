/**
 * Testes da retentativa automática de treino (cartão bb4d4cd0 — teto 1).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/voices/retentativa-treino.test.ts
 *
 * Duas metades, de propósito:
 *  1. COMPORTAMENTO da regra pura (deveRetentarTreino/causaEhRetentavel) —
 *     importa e executa, sem mock nenhum.
 *  2. TRIPWIRES estruturais lendo o FONTE de finalize-training.ts — as
 *     decisões que um refactor bem intencionado desfaz sem quebrar tipo
 *     nenhum: o contador morar no BANCO (reinício não pode zerar o teto) e a
 *     ordem gate → retentativa → estorno (retentar depois de estornar paga o
 *     mesmo treino duas vezes; contar antes do gate faz a 1ª falha contar 0
 *     e o teto virar 2).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  causaEhRetentavel,
  deveRetentarTreino,
  MAX_RETENTATIVAS_DE_TREINO,
} from "./retentativa-treino.ts";

// ────────────────────────── 1. comportamento ──────────────────────────

test("1ª falha por causa transitória nossa → retenta", () => {
  assert.equal(
    deveRetentarTreino({ falhaNossa: true, cause: "infra_gpu", falhasDaVoz: 1 }),
    true,
  );
});

test("2ª falha → NUNCA retenta (o teto do Johnny é 1)", () => {
  assert.equal(
    deveRetentarTreino({ falhaNossa: true, cause: "infra_gpu", falhasDaVoz: 2 }),
    false,
  );
  // E não volta a retentar em contagem nenhuma acima disso.
  for (const n of [3, 5, 100]) {
    assert.equal(
      deveRetentarTreino({ falhaNossa: true, cause: "infra_gpu", falhasDaVoz: n }),
      false,
      `falhasDaVoz=${n} retentaria — loop de GPU`,
    );
  }
});

test("causa estrutural NÃO retenta, mesmo na 1ª falha", () => {
  // `bug` cobre o chunk inválido em /dataset/ (#475 — a "foto na lista de
  // áudio"): defeito que se repete idêntico, retentar é só queimar GPU.
  for (const cause of ["bug", "unknown", "user_dataset", "reported"] as const) {
    assert.equal(
      deveRetentarTreino({ falhaNossa: true, cause, falhasDaVoz: 1 }),
      false,
      `cause=${cause} retentou`,
    );
    assert.equal(causaEhRetentavel(cause), false, `causaEhRetentavel(${cause})`);
  }
});

test("só as quatro causas transitórias são retentáveis", () => {
  for (const cause of ["infra_gpu", "infra_disk", "infra_storage", "capacity"] as const) {
    assert.equal(causaEhRetentavel(cause), true, `causaEhRetentavel(${cause})`);
    assert.equal(
      deveRetentarTreino({ falhaNossa: true, cause, falhasDaVoz: 1 }),
      true,
      `cause=${cause} não retentou na 1ª falha`,
    );
  }
});

test("falha do MATERIAL do aluno nunca retenta, seja qual for a causa", () => {
  assert.equal(
    deveRetentarTreino({ falhaNossa: false, cause: "infra_gpu", falhasDaVoz: 1 }),
    false,
  );
});

test("contagem quebrada (null) ou impossível (<1) → não retenta", () => {
  // null = o COUNT no banco falhou. Teto sem contador provado é loop em
  // potência — o caminho seguro é o de falha normal (estorno + chamado).
  assert.equal(
    deveRetentarTreino({ falhaNossa: true, cause: "infra_gpu", falhasDaVoz: null }),
    false,
  );
  // <1 é impossível (a própria falha está na conta) = leitura podre.
  assert.equal(
    deveRetentarTreino({ falhaNossa: true, cause: "infra_gpu", falhasDaVoz: 0 }),
    false,
  );
});

test("o teto é 1 — mudou o número, mudou a ordem do Johnny", () => {
  assert.equal(MAX_RETENTATIVAS_DE_TREINO, 1);
});

// ─────────────────── 2. tripwires no finalize-training ───────────────────

const FONTE = readFileSync(join(import.meta.dirname, "finalize-training.ts"), "utf8");

test("o contador vive no BANCO (COUNT em training_jobs failed), não em memória", () => {
  // Reinício de worker/backend não pode zerar o teto — contador em variável
  // de módulo tornaria o limite decorativo. A prova é a query em si.
  const fn = FONTE.indexOf("async function contarFalhasDeTreinoDaVoz");
  assert.ok(fn > 0, "contarFalhasDeTreinoDaVoz sumiu do finalize-training");
  const corpo = FONTE.slice(fn, FONTE.indexOf("\n}", fn));
  assert.match(corpo, /from\("training_jobs"\)/, "não conta na tabela training_jobs");
  assert.match(corpo, /count:\s*"exact"/, "não é COUNT exato do banco");
  assert.match(corpo, /eq\("status",\s*"failed"\)/, "não filtra por status failed");
  assert.match(corpo, /eq\("voice_id",\s*voiceId\)/, "não filtra pela voz");
});

test("ordem: gate idempotente → retentativa → estorno", () => {
  const gate = FONTE.indexOf("const { data: claimed } = await admin");
  const decisao = FONTE.indexOf("deveRetentarTreino({");
  const estorno = FONTE.indexOf("saldoPendenteDoTreino(userId, voiceId)");
  assert.ok(gate > 0 && decisao > 0 && estorno > 0, "âncora sumiu do fonte");
  // DEPOIS do gate: a linha desta falha já está `failed`, então a 1ª falha
  // conta 1 e o teto de 1 significa exatamente "uma retentativa".
  assert.ok(decisao > gate, "retentativa decidida ANTES do gate — a 1ª falha contaria 0");
  // ANTES do estorno: a tentativa nova corre por conta do débito original.
  // Estornar e redespachar sem cobrar daria treino grátis; estornar e cobrar
  // de novo mexeria duas vezes no extrato pelo mesmo treino.
  assert.ok(decisao < estorno, "retentativa decidida DEPOIS do estorno — extrato mexido em dobro");
});

test("retentativa que despachou NÃO cai no caminho de falha (return antes do estorno)", () => {
  // O ramo `redespacho.ok` precisa sair da função ali mesmo: seguir adiante
  // estornaria e marcaria `failed` uma voz cujo treino está RODANDO.
  const ok = FONTE.indexOf("if (redespacho.ok) {");
  assert.ok(ok > 0, "ramo redespacho.ok sumiu");
  const corpo = FONTE.slice(ok, FONTE.indexOf("\n        }", ok));
  assert.match(
    corpo,
    /return\s*\{\s*applied:\s*true,\s*status:\s*"training"\s*\}/,
    "o ramo de sucesso do redespacho não retorna training imediatamente",
  );
});

test("o redespacho NÃO cobra de novo (sem debitCredits no caminho da retentativa)", () => {
  const REDESPACHO = readFileSync(join(import.meta.dirname, "redespachar-treino.ts"), "utf8");
  assert.ok(
    !REDESPACHO.includes("debitCredits"),
    "redespachar-treino.ts debita créditos — o débito original já paga esta tentativa",
  );
  assert.ok(
    !FONTE.includes("debitCredits"),
    "finalize-training.ts debita créditos — estorno e cobrança no mesmo arquivo é extrato em dobro",
  );
});
