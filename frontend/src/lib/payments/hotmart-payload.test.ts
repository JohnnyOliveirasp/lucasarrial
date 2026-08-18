/**
 * Testes de regressão da extração do payload 2.0 da Hotmart.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/hotmart-payload.test.ts
 *
 * Os payloads abaixo reproduzem a FORMA REAL gravada em payment_events
 * (conferida no banco em 18/08/2026) — não são inventados.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractExternalId,
  extractNextChargeIso,
  isUnknownExternalId,
} from "./hotmart-payload.ts";

// ── SUBSCRIPTION_CANCELLATION: forma real — o código vem em data.subscriber.code
// e data.subscription vem SÓ com { id, plan } (sem subscriber, sem code).
const cancellationData: Record<string, unknown> = {
  product: { id: 1234567, name: "Produto" },
  subscriber: {
    code: "KHU9LRZT",
    name: "Viviana Cotua",
    email: "viviana@example.com",
    phone: { dddPhone: "11", phone: "999999999" },
  },
  subscription: { id: 45425132, plan: { id: 1325347, name: "Plano Founder" } },
  date_next_charge: 1783425600000, // ms
  cancellation_date: 1755527100000,
  actual_recurrence_value: 22,
};

test("SUBSCRIPTION_CANCELLATION: extrai o código do assinante de data.subscriber.code", () => {
  const id = extractExternalId(cancellationData, "SUBSCRIPTION_CANCELLATION");
  assert.equal(id, "KHU9LRZT");
});

test("SUBSCRIPTION_CANCELLATION: NUNCA cai no fallback unknown (bug de 18/08)", () => {
  const id = extractExternalId(cancellationData, "SUBSCRIPTION_CANCELLATION");
  assert.notEqual(id, "SUBSCRIPTION_CANCELLATION:unknown");
  assert.equal(isUnknownExternalId(id, "SUBSCRIPTION_CANCELLATION"), false);
});

test("SUBSCRIPTION_CANCELLATION: date_next_charge na raiz de data vira accessUntil (ms)", () => {
  const iso = extractNextChargeIso(cancellationData);
  assert.equal(iso, new Date(1783425600000).toISOString());
});

test("SUBSCRIPTION_CANCELLATION: date_next_charge em SEGUNDOS é normalizado (payload real 1783598400)", () => {
  const iso = extractNextChargeIso({ ...cancellationData, date_next_charge: 1783598400 });
  assert.equal(iso, new Date(1783598400 * 1000).toISOString());
});

// ── PURCHASE_APPROVED: forma real — o código vem em data.subscription.subscriber.code
// e data.subscriber NÃO EXISTE. O comportamento tem que continuar idêntico.
const approvedData: Record<string, unknown> = {
  product: { id: 1234567, name: "Produto" },
  buyer: { email: "aluno@example.com", name: "Aluno" },
  purchase: {
    transaction: "HP3851239009",
    status: "APPROVED",
    date_next_charge: 1789045500000,
    offer: { code: "abc123" },
  },
  subscription: {
    status: "ACTIVE",
    plan: { id: 1325347, name: "Plano Founder" },
    subscriber: { code: "KHU9LRZT" },
  },
};

test("PURCHASE_APPROVED: continua devolvendo data.subscription.subscriber.code", () => {
  const id = extractExternalId(approvedData, "PURCHASE_APPROVED");
  assert.equal(id, "KHU9LRZT");
});

test("PURCHASE_APPROVED sem assinatura: cai na transação (compra única)", () => {
  const single: Record<string, unknown> = {
    buyer: { email: "x@example.com" },
    purchase: { transaction: "HP0000000001", status: "APPROVED" },
  };
  assert.equal(extractExternalId(single, "PURCHASE_APPROVED"), "HP0000000001");
});

test("payload vazio: devolve o fallback e isUnknownExternalId acusa", () => {
  const id = extractExternalId({}, "SUBSCRIPTION_CANCELLATION");
  assert.equal(id, "SUBSCRIPTION_CANCELLATION:unknown");
  assert.equal(isUnknownExternalId(id, "SUBSCRIPTION_CANCELLATION"), true);
});

test("extractNextChargeIso: prioridade de purchase/subscription preservada nos PURCHASE_*", () => {
  assert.equal(
    extractNextChargeIso(approvedData),
    new Date(1789045500000).toISOString(),
  );
  assert.equal(extractNextChargeIso({}), null);
  assert.equal(extractNextChargeIso({ date_next_charge: "not-a-number" }), null);
});
