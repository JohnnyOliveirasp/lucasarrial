/**
 * GUARDA DE REGRESSÃO — a casa não diz "cancelada" antes de saber (#552)
 * ======================================================================
 *
 * Por que este arquivo existe (medido em 24/09/2026, na ronda das falhas)
 * ----------------------------------------------------------------------
 * A rota `POST /api/v1/subscription/cancel` mandava ao aluno a carta "Sua
 * assinatura foi cancelada" no passo 1b, ANTES de chamar a Hotmart no passo 2,
 * e o passo 2 terminava num `catch {}` vazio. Resultado: a casa afirmava um
 * fato que não tinha conferido e, quando a API recusava, não sobrava rastro
 * nenhum — sem log, sem chamado, sem coluna. 236 alunos já passaram por esse
 * botão e hoje não existe como saber quais pedidos viraram cancelamento.
 *
 * O caso pior era `.maybeSingle()` sobre `entitlements`: com DUAS assinaturas
 * ativas o PostgREST recusa (>1 linha), o `error` era descartado, `ent` virava
 * `null` e o cancelamento era PULADO INTEIRO — e mesmo assim o aluno já tinha
 * recebido a carta dizendo que estava cancelado. Medido: 3 contas estão nessa
 * situação agora, uma delas já pagando em dobro.
 *
 * Duas coisas estão travadas aqui, e são de naturezas diferentes:
 *   1. a REGRA PURA do texto (`cartaDeCancelamento`), testada de verdade;
 *   2. a ORDEM DOS PASSOS na rota, lida do fonte — porque é ordem de chamadas
 *      com rede no meio, e o jeito honesto de travar isso sem subir Supabase e
 *      Resend é afirmar sobre o texto do arquivo. Mesma técnica que
 *      `finalize-training.test.ts` já usa nesta casa.
 *
 * CONTROLE DE MUTAÇÃO (rodado antes de subir):
 *   - `cartaDeCancelamento` devolvendo sempre a carta otimista → 3 testes FALHAM.
 *   - a chamada de `notifyCancellation` movida de volta para antes do bloco da
 *     Hotmart → 1 teste FALHA.
 *   - `.maybeSingle()` restaurado na consulta de entitlements → 1 teste FALHA.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cartaDeCancelamento } from "./carta-de-cancelamento.ts";

const ROTA = readFileSync(
  new URL("../../app/api/v1/subscription/cancel/route.ts", import.meta.url),
  "utf8",
);

// ─────────────────────────── 1. a regra pura ───────────────────────────

test('"cancelada" só aparece quando a Hotmart confirmou', () => {
  const ok = cartaDeCancelamento(true);
  assert.match(ok.subject, /cancelada/i);
  assert.match(ok.html, /foi cancelada/i);
});

test("sem confirmação, a carta NÃO afirma cancelamento — ela diz que recebeu o pedido", () => {
  const naoSei = cartaDeCancelamento(false);
  assert.match(naoSei.subject, /recebemos o seu pedido/i);
  assert.ok(
    !/sua assinatura foi cancelada/i.test(naoSei.html),
    "a carta do caso não-confirmado não pode afirmar que a assinatura foi cancelada",
  );
  assert.ok(
    !/^(?!.*ainda).*assinatura cancelada/i.test(naoSei.subject),
    "o assunto não pode anunciar cancelamento consumado",
  );
});

test("a carta do caso não-confirmado promete o retorno, senão vira silêncio", () => {
  const naoSei = cartaDeCancelamento(false);
  assert.match(
    naoSei.html,
    /escrevemos de novo confirmando/i,
    "quem não recebeu confirmação precisa saber que alguém volta a falar com ele",
  );
});

test("os dois textos são realmente diferentes (não é o mesmo html com outro assunto)", () => {
  assert.notEqual(cartaDeCancelamento(true).html, cartaDeCancelamento(false).html);
});

// ──────────────── 2. a ordem dos passos, lida do fonte ────────────────

test("A ROTA TENTA CANCELAR ANTES DE ESCREVER AO ALUNO", () => {
  const iCancel = ROTA.indexOf("cancelSubscription(code)");
  const iCarta = ROTA.indexOf("await notifyCancellation(");
  assert.ok(iCancel > 0, "não achei a chamada de cancelSubscription na rota");
  assert.ok(iCarta > 0, "não achei a chamada de notifyCancellation na rota");
  assert.ok(
    iCancel < iCarta,
    "a carta ao aluno está saindo ANTES da tentativa de cancelamento — é exatamente o #552",
  );
});

test("a consulta de entitlements NÃO usa maybeSingle (quem tem 2 assinaturas seria pulado)", () => {
  const trecho = ROTA.slice(
    ROTA.indexOf('.from("entitlements")'),
    ROTA.indexOf('.from("entitlements")') + 400,
  );
  assert.ok(
    !/maybeSingle\(\)/.test(trecho),
    "maybeSingle() devolve null com 2 linhas e faz o cancelamento ser pulado em silêncio",
  );
});

test("a falha do cancelamento abre chamado — não pode voltar a ser catch vazio", () => {
  assert.match(
    ROTA,
    /registrarCancelamentoQueNaoSaiu\(/,
    "a rota precisa registrar a falha em algum lugar que a ronda enxergue",
  );
  assert.match(ROTA, /abrirChamadoReportado\(/);
});

test("só é 'canceled' quando TODAS as assinaturas ativas pararam", () => {
  assert.match(
    ROTA,
    /falhas\.length === 0\) confirmado = true/,
    "uma assinatura que sobra é uma cobrança que continua chegando",
  );
});
