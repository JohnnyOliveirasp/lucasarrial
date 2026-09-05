/**
 * Testes de regressão da precedência de status do entitlement.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/entitlement-status.test.ts
 *
 * O caso que originou está em
 * _frank/prova/2026-08-28_cancelamentos_de_27-08.md (marlon@bianchitour.com):
 * um PURCHASE_COMPLETE benigno, 17h depois de um PURCHASE_PROTEST, apagou a
 * marca de chargeback e deixou o entitlement como "canceled".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isTerminalStatus,
  resolveGrantStatus,
  resolveRevokeStatus,
  STATUS_RANK,
} from "./entitlement-status.ts";

// ── O BUG: sequência real do Marlon, evento por evento ─────────────────────
//
// O webhook, num PURCHASE_*, chama grantAccess e SÓ DEPOIS revokeAccess quando
// a assinatura vem morta. Antes do fix, o grant já tinha regravado "active" e
// o revoke gravava "canceled" — os dois passos apagavam a contestação.

test("PROTEST seguido de PURCHASE_COMPLETE NÃO pode terminar em canceled", () => {
  // 27/08 14:52 — PURCHASE_PROTEST (status DISPUTE) no R$97
  const depoisDoProtesto = resolveRevokeStatus("active", "chargeback");
  assert.equal(depoisDoProtesto, "chargeback");

  // 28/08 07:13 — PURCHASE_COMPLETE: rec#1 R$0, transação ANTIGA
  // (HP1334962589), subscription.status=CANCELED. NÃO é dinheiro novo.
  const depoisDoGrant = resolveGrantStatus(depoisDoProtesto, false);
  assert.equal(depoisDoGrant, "chargeback", "o grant do COMPLETE não pode reativar");

  // ...e o revoke que vinha logo atrás, com subscription morta:
  const depoisDoRevoke = resolveRevokeStatus(depoisDoGrant, "canceled");
  assert.equal(depoisDoRevoke, "chargeback", "canceled não pode rebaixar chargeback");

  // A armadilha exata do bug, dita sem rodeio:
  assert.notEqual(depoisDoRevoke, "canceled");
});

test("mesma armadilha para estorno: REFUNDED seguido de cancelamento", () => {
  const depoisDoEstorno = resolveRevokeStatus("active", "refunded");
  const depoisDoCancelamento = resolveRevokeStatus(depoisDoEstorno, "canceled");
  assert.equal(depoisDoCancelamento, "refunded");
});

test("expired também não rebaixa um terminal", () => {
  assert.equal(resolveRevokeStatus("chargeback", "expired"), "chargeback");
  assert.equal(resolveRevokeStatus("refunded", "expired"), "refunded");
});

// ── O que NÃO pode ter mudado (o fix não pode travar o fluxo normal) ───────

test("fluxo normal de revogação segue igual: não-terminal aceita qualquer status", () => {
  assert.equal(resolveRevokeStatus("active", "canceled"), "canceled");
  assert.equal(resolveRevokeStatus("active", "expired"), "expired");
  assert.equal(resolveRevokeStatus("canceled", "expired"), "expired");
  assert.equal(resolveRevokeStatus("expired", "canceled"), "canceled");
  assert.equal(resolveRevokeStatus("past_due", "canceled"), "canceled");
  // e o caminho que grava o terminal pela primeira vez continua funcionando
  assert.equal(resolveRevokeStatus("canceled", "chargeback"), "chargeback");
  assert.equal(resolveRevokeStatus("active", "refunded"), "refunded");
});

test("entitlement inexistente (current null) aceita o status que chegou", () => {
  assert.equal(resolveRevokeStatus(null, "canceled"), "canceled");
  assert.equal(resolveRevokeStatus(null, "chargeback"), "chargeback");
});

test("revogação repetida é idempotente (mesmo status entra e sai)", () => {
  assert.equal(resolveRevokeStatus("chargeback", "chargeback"), "chargeback");
  assert.equal(resolveRevokeStatus("refunded", "refunded"), "refunded");
  assert.equal(resolveRevokeStatus("canceled", "canceled"), "canceled");
});

test("entre dois terminais fica o mais forte: chargeback > refunded", () => {
  assert.equal(resolveRevokeStatus("refunded", "chargeback"), "chargeback");
  assert.equal(resolveRevokeStatus("chargeback", "refunded"), "chargeback");
  assert.ok(STATUS_RANK.chargeback > STATUS_RANK.refunded);
});

// ── Grant: dinheiro NOVO limpa o terminal; eco da mesma cobrança não ───────

test("PURCHASE_APPROVED pago DEPOIS de um chargeback reativa (senão o aluno paga e não recebe)", () => {
  assert.equal(resolveGrantStatus("chargeback", true), "active");
  assert.equal(resolveGrantStatus("refunded", true), "active");
});

test("grant sem dinheiro novo não ressuscita terminal, mas reativa o resto", () => {
  assert.equal(resolveGrantStatus("chargeback", false), "chargeback");
  assert.equal(resolveGrantStatus("refunded", false), "refunded");
  // canceled/expired/past_due NÃO são terminais: renovação normal reativa
  assert.equal(resolveGrantStatus("canceled", false), "active");
  assert.equal(resolveGrantStatus("expired", false), "active");
  assert.equal(resolveGrantStatus("past_due", false), "active");
  assert.equal(resolveGrantStatus("active", false), "active");
  assert.equal(resolveGrantStatus(null, false), "active");
});

test("isTerminalStatus: só refunded e chargeback (fim de ciclo normal não é terminal)", () => {
  assert.equal(isTerminalStatus("refunded"), true);
  assert.equal(isTerminalStatus("chargeback"), true);
  assert.equal(isTerminalStatus("canceled"), false);
  assert.equal(isTerminalStatus("expired"), false);
  assert.equal(isTerminalStatus("past_due"), false);
  assert.equal(isTerminalStatus("active"), false);
  // toda chave do rank foi classificada — se um status novo aparecer no
  // EntitlementStatus sem passar por aqui, este teste quebra.
  assert.equal(Object.keys(STATUS_RANK).length, 6);
});

// ── Trava da FIAÇÃO: o fix só vale se o webhook realmente usar isto ────────
//
// Lendo o fonte em vez de mockar o supabase: o erro que este card conserta não
// foi a decisão, foi o caminho de escrita que ignorava a decisão.

const entitlementsSrc = readFileSync(
  new URL("./entitlements.ts", import.meta.url),
  "utf8",
);
const routeSrc = readFileSync(
  new URL("../../app/api/v1/webhooks/hotmart/route.ts", import.meta.url),
  "utf8",
);

test("grantAccess consulta o status atual antes de gravar active", () => {
  const corpo = entitlementsSrc.slice(
    entitlementsSrc.indexOf("export async function grantAccess"),
    entitlementsSrc.indexOf("export async function revokeAccess"),
  );
  assert.ok(corpo.includes("resolveGrantStatus"), "grantAccess deve chamar resolveGrantStatus");
  // a leitura do estado atual tem que vir ANTES do upsert, senão não há o que preservar
  assert.ok(
    corpo.indexOf("resolveGrantStatus") < corpo.indexOf(".upsert("),
    "a decisão precisa vir antes do upsert",
  );
  assert.ok(
    corpo.indexOf('return { statusFinal, terminalPreservado: true }') < corpo.indexOf(".upsert("),
    "terminal preservado deve sair da função SEM escrever",
  );
});

test("revokeAccess não grava quando o status pedido é mais fraco", () => {
  const corpo = entitlementsSrc.slice(entitlementsSrc.indexOf("export async function revokeAccess"));
  assert.ok(corpo.includes("resolveRevokeStatus"), "revokeAccess deve chamar resolveRevokeStatus");
  assert.ok(
    corpo.indexOf("resolveRevokeStatus") < corpo.indexOf(".update(patch)"),
    "a decisão precisa vir antes do update",
  );
});

test("o webhook só marca newPayment no PURCHASE_APPROVED", () => {
  assert.ok(
    routeSrc.includes('newPayment: eventType === "PURCHASE_APPROVED"'),
    "COMPLETE não pode ser tratado como dinheiro novo",
  );
});
