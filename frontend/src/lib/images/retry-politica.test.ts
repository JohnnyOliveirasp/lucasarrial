/**
 * Testes da política de retry da imagem — incidente 12/09 (gen
 * e568b3cd-b44f-464c-9861-21041bb08650, comprador SGP rafaelzan@me.com, R$894).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/images/retry-politica.test.ts
 *
 * O DEFEITO COBERTO: o modelo TITULAR recusou 4 retratos clínicos impecáveis
 * (jaleco, fundo branco) com "your prompt was flagged by website as violating
 * content policies" — falso positivo de moderação sobre o prompt AVATAR_SOCIAL
 * da casa. A condição antiga era
 *
 *     if ((isTransientKieError(raw) || onFallback) && await tryImageRetry(id))
 *
 * e a recusa de moderação não casa com NENHUMA régua de transiente
 * (/internal error|try again|timeout|temporar|fetch failed/). Como o aluno
 * estava no titular (onFallback = false), a condição dava falso e a row morria
 * com retry_count = 0: nunca houve segunda chance, apesar de o retry cruzado
 * existir exatamente porque os dois modelos têm moderação DIFERENTE.
 *
 * ⚠️ POR QUE O TESTE ÓBVIO NÃO PEGA ISSO: um teste que use uma mensagem
 * genérica de erro passa nos dois códigos. O caso que separa o novo do velho é
 * a mensagem REAL de moderação vinda do TITULAR com retry_count 0 — é ela que
 * está no primeiro teste e na prova de não-tautologia lá embaixo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirAposFalhaImagem,
  isModerationKieError,
  isTransientKieError,
} from "./retry-politica.ts";

const TITULAR = "gpt-image-2-image-to-image";
const FALLBACK = "seedream/5-pro-image-to-image";

/** A mensagem literal que matou a geração e568b3cd (kie_raw_error da row). */
const MODERACAO_REAL =
  "your prompt was flagged by website as violating content policies.";

/** Atalho com o cenário de produção: fallback ligado, primeira falha. */
function decidir(over: {
  raw: string;
  modeloAtual?: string;
  fallbackLigado?: boolean;
  retryCount?: number;
}) {
  return decidirAposFalhaImagem({
    raw: over.raw,
    modeloAtual: over.modeloAtual ?? TITULAR,
    modeloTitular: TITULAR,
    modeloFallback: FALLBACK,
    fallbackLigado: over.fallbackLigado ?? true,
    retryCount: over.retryCount ?? 0,
  });
}

// (a) do card ────────────────────────────────────────────────────────────────
test("moderação no TITULAR: retenta no FALLBACK (O BUG do incidente 12/09)", () => {
  const d = decidir({ raw: MODERACAO_REAL });
  assert.equal(d.acao, "retry", "a recusa de moderação tem que ganhar 2ª chance");
  assert.equal(
    d.acao === "retry" && d.modelo,
    FALLBACK,
    "e a 2ª chance vai pro OUTRO modelo, que tem outra moderação",
  );
});

// (b) do card ────────────────────────────────────────────────────────────────
test("moderação JÁ no fallback, com a 2ª chance gasta: falha de vez (sem laço)", () => {
  // Este é o estado exato depois do teste (a): a row foi pro Seedream e o
  // cadeado atômico já subiu retry_count 0→1. O Seedream também recusa.
  const d = decidir({ raw: MODERACAO_REAL, modeloAtual: FALLBACK, retryCount: 1 });
  assert.equal(d.acao, "falhar", "segunda chance é UMA só: aqui o aluno recebe o estorno");
});

test("a 2ª chance é uma só mesmo no titular: retry_count=1 nunca reabre", () => {
  // Sem esta trava, moderação↔moderação ficaria batendo entre os dois modelos.
  assert.equal(decidir({ raw: MODERACAO_REAL, retryCount: 1 }).acao, "falhar");
  assert.equal(decidir({ raw: "internal error", retryCount: 1 }).acao, "falhar");
  assert.equal(decidir({ raw: "seja o que for", modeloAtual: FALLBACK, retryCount: 1 }).acao, "falhar");
});

// (c) do card ────────────────────────────────────────────────────────────────
test("erro não-transiente e não-moderação no titular CONTINUA falhando na hora", () => {
  // Regressão: não é porque abrimos a moderação que erro determinístico ganhou
  // retry. Insistir num prompt inválido só atrasa o aluno.
  for (const raw of [
    "aspect ratio unavailable",
    "invalid input image",
    "Kie 402: insufficient balance",
  ]) {
    assert.equal(decidir({ raw }).acao, "falhar", `"${raw}" não deve retentar`);
  }
});

// Comportamento PRÉ-EXISTENTE que não pode regredir ───────────────────────────
test("transiente no titular continua retentando (caso 28/07)", () => {
  const d = decidir({ raw: "internal error, please try again" });
  assert.equal(d.acao, "retry");
  assert.equal(d.acao === "retry" && d.modelo, FALLBACK);
});

test("QUALQUER erro no fallback com 2ª chance livre volta pro titular (caso 05/08)", () => {
  // O disjuntor pode mandar a PRIMEIRA tentativa direto pro Seedream; aí
  // retry_count ainda é 0 e o GPT saudável é a segunda chance. Foi a falta
  // disso que matou 4 alunos em 05/08.
  const d = decidir({ raw: "aspect ratio unavailable", modeloAtual: FALLBACK });
  assert.equal(d.acao, "retry");
  assert.equal(d.acao === "retry" && d.modelo, TITULAR);
});

test("fallback DESLIGADO: a retentativa é no titular, nunca no Seedream", () => {
  const d = decidir({ raw: MODERACAO_REAL, fallbackLigado: false });
  assert.equal(d.acao, "retry");
  assert.equal(d.acao === "retry" && d.modelo, TITULAR);

  const volta = decidir({ raw: "internal error", modeloAtual: FALLBACK, fallbackLigado: false });
  assert.equal(volta.acao === "retry" && volta.modelo, TITULAR);
});

test("row sem kie_model conhecido é tratada como titular (default do sync)", () => {
  const d = decidirAposFalhaImagem({
    raw: MODERACAO_REAL,
    modeloAtual: "modelo-que-nao-existe-mais",
    modeloTitular: TITULAR,
    modeloFallback: FALLBACK,
    fallbackLigado: true,
    retryCount: 0,
  });
  assert.equal(d.acao === "retry" && d.modelo, FALLBACK);
});

// Réguas ─────────────────────────────────────────────────────────────────────
test("isModerationKieError reconhece as formas conhecidas, e só elas", () => {
  assert.ok(isModerationKieError(MODERACAO_REAL));
  assert.ok(isModerationKieError("Content policy violation"));
  assert.ok(isModerationKieError("blocked by our moderation system"));
  assert.ok(!isModerationKieError("internal error"));
  assert.ok(!isModerationKieError("aspect ratio unavailable"));
});

test("a régua de moderação NÃO casa com a de transiente (são gatilhos distintos)", () => {
  assert.ok(!isTransientKieError(MODERACAO_REAL), "a mensagem do incidente não é transiente — é essa a raiz do bug");
});

/**
 * PROVA DE NÃO-TAUTOLOGIA: reimplementa a condição ANTIGA (copiada literal do
 * origin/main, sync.ts:146) e mostra que ela DECIDE FALHAR no fixture do
 * primeiro teste. Sem isto, os testes acima poderiam estar só descrevendo o
 * código novo.
 */
test("a condição ANTIGA mata esta mesma geração (prova de que o teste morde)", () => {
  // --- miolo antigo, verbatim ---
  const raw = MODERACAO_REAL;
  const kieModelDaRow: string = TITULAR; // o aluno estava no titular
  const onFallback = kieModelDaRow === FALLBACK; // cur.kie_model === KIE_FALLBACK_IMAGE_MODEL
  const antigoRetenta = isTransientKieError(raw) || onFallback;
  // --- fim do miolo antigo ---
  assert.equal(antigoRetenta, false, "o código antigo ia direto pra failImageGeneration");

  // E o novo, no mesmo fixture, dá a segunda chance no outro modelo.
  const d = decidir({ raw });
  assert.equal(d.acao === "retry" && d.modelo, FALLBACK);
});
