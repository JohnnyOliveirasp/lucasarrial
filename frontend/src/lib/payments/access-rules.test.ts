/**
 * Testes da regra de acesso (bug de 20/08: quem pagou e cancelou perdia o
 * acesso no mesmo dia — recomputeProfileAccess só aceitava 'active' e jogava
 * fora o 'canceled' com período pago vigente que o webhook gravava).
 * Prova: _frank/prova/2026-08-20_cancelamentos_de_19-08.md item 1.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/access-rules.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickAccessEntitlement } from "./access-rules.ts";

const NOW = "2026-08-20T12:00:00.000Z";
const FUTURE = "2026-09-01T00:00:00.000Z";
const PAST = "2026-08-01T00:00:00.000Z";

const ent = (status: string, access_until: string | null, tag = "") => ({
  status,
  access_until,
  tag, // pra identificar QUAL entitlement foi escolhido
});

// (a) do card: canceled com access_until futuro → TEM acesso
test("canceled com período pago vigente concede acesso (caso dr.bruno/potduarte/vinymoras)", () => {
  const picked = pickAccessEntitlement([ent("canceled", FUTURE)], NOW);
  assert.ok(picked, "canceled com access_until no futuro tem que conceder acesso");
  assert.equal(picked.access_until, FUTURE);
});

// (b) do card: canceled com access_until passado → NÃO tem
test("canceled com período já vencido NÃO concede acesso", () => {
  assert.equal(pickAccessEntitlement([ent("canceled", PAST)], NOW), undefined);
});

// (c) do card: refunded com access_until futuro → NÃO tem (o dinheiro voltou)
test("refunded NÃO concede acesso mesmo com access_until no futuro", () => {
  assert.equal(pickAccessEntitlement([ent("refunded", FUTURE)], NOW), undefined);
});

// (d) do card: um canceled + um active → tem acesso, e o cache herda o ACTIVE
test("canceled + active → concede acesso e o escolhido é o active", () => {
  const picked = pickAccessEntitlement(
    [ent("canceled", FUTURE, "cancelado"), ent("active", null, "ativo")],
    NOW,
  );
  assert.ok(picked);
  assert.equal(picked.tag, "ativo", "'active' tem prioridade sobre 'canceled'");
});

test("active vence canceled mesmo vindo DEPOIS na lista (ordem não importa)", () => {
  const picked = pickAccessEntitlement(
    [ent("active", FUTURE, "ativo"), ent("canceled", "2026-12-01T00:00:00.000Z", "cancelado")],
    NOW,
  );
  assert.equal(picked?.tag, "ativo");
});

// comportamento pré-existente preservado
test("active com access_until NULL (vitalício) concede acesso", () => {
  assert.ok(pickAccessEntitlement([ent("active", null)], NOW));
});

test("active com access_until futuro concede acesso", () => {
  assert.ok(pickAccessEntitlement([ent("active", FUTURE)], NOW));
});

test("active expirado NÃO concede acesso", () => {
  assert.equal(pickAccessEntitlement([ent("active", PAST)], NOW), undefined);
});

// canceled + NULL: sem período conhecido não há "fim do período pago" a honrar
test("canceled com access_until NULL NÃO concede acesso (null não é vitalício pra canceled)", () => {
  assert.equal(pickAccessEntitlement([ent("canceled", null)], NOW), undefined);
});

// os demais status continuam nunca concedendo
for (const status of ["chargeback", "expired", "past_due"]) {
  test(`${status} NÃO concede acesso mesmo com access_until no futuro`, () => {
    assert.equal(pickAccessEntitlement([ent(status, FUTURE)], NOW), undefined);
  });
}

test("lista vazia → undefined (vira plan free no recompute)", () => {
  assert.equal(pickAccessEntitlement([], NOW), undefined);
});

// active expirado + canceled vigente: o canceled vigente segura o acesso
test("active expirado + canceled vigente → o canceled vigente concede", () => {
  const picked = pickAccessEntitlement(
    [ent("active", PAST, "ativo-vencido"), ent("canceled", FUTURE, "cancelado-vigente")],
    NOW,
  );
  assert.equal(picked?.tag, "cancelado-vigente");
});
