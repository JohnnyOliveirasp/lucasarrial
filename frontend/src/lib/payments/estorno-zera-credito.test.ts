/**
 * Testes de regressão da REGRA DO ESTORNO (Johnny 18/08): só dinheiro
 * DEVOLVIDO (refund/chargeback/protesto) zera o crédito de mensalidade.
 * Cancelamento de quem pagou e expiração NÃO zeram nada.
 *
 * Este arquivo prova a DECISÃO (qual evento zera); o comportamento no banco
 * (zerar sub, preservar extra, idempotência) é provado pelo harness com a
 * migration real (frontend/_Bugs/estorno-credito, embedded-postgres).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/estorno-zera-credito.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isMoneyReturnedStatus, mapRevokeStatus } from "./hotmart-payload.ts";

test("PURCHASE_REFUNDED → refunded → ZERA (dinheiro voltou)", () => {
  const s = mapRevokeStatus("PURCHASE_REFUNDED");
  assert.equal(s, "refunded");
  assert.equal(isMoneyReturnedStatus(s), true);
});

test("PURCHASE_CHARGEBACK → chargeback → ZERA", () => {
  const s = mapRevokeStatus("PURCHASE_CHARGEBACK");
  assert.equal(s, "chargeback");
  assert.equal(isMoneyReturnedStatus(s), true);
});

test("PURCHASE_PROTEST → chargeback → ZERA", () => {
  const s = mapRevokeStatus("PURCHASE_PROTEST");
  assert.equal(s, "chargeback");
  assert.equal(isMoneyReturnedStatus(s), true);
});

test("SUBSCRIPTION_CANCELLATION (pagou e cancelou) → canceled → NÃO zera", () => {
  const s = mapRevokeStatus("SUBSCRIPTION_CANCELLATION");
  assert.equal(s, "canceled");
  assert.equal(isMoneyReturnedStatus(s), false);
});

test("PURCHASE_EXPIRED → expired → NÃO zera (trial é da mig 80/81)", () => {
  const s = mapRevokeStatus("PURCHASE_EXPIRED");
  assert.equal(s, "expired");
  assert.equal(isMoneyReturnedStatus(s), false);
});

test("PURCHASE_CANCELED → expired → NÃO zera", () => {
  const s = mapRevokeStatus("PURCHASE_CANCELED");
  assert.equal(s, "expired");
  assert.equal(isMoneyReturnedStatus(s), false);
});

test("evento que não revoga (PURCHASE_APPROVED) → null → NÃO zera", () => {
  const s = mapRevokeStatus("PURCHASE_APPROVED");
  assert.equal(s, null);
  assert.equal(isMoneyReturnedStatus(s), false);
});
