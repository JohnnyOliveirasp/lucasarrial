/**
 * Testes do fechamento de incidente (card 20/08: fechado sem resolved_at fica
 * invisível pro detector de zumbi).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/incidents/closure.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLOSED_STATUSES, closureFields } from "./closure.ts";

test("fixed grava resolved_by e resolved_at", () => {
  const f = closureFields("fixed", "johnny@example.com") as Record<string, string>;
  assert.equal(f.resolved_by, "johnny@example.com");
  assert.ok(f.resolved_at, "resolved_at tem que sair preenchido");
  assert.ok(!Number.isNaN(Date.parse(f.resolved_at)), "resolved_at é ISO válido");
});

test("ignored TAMBÉM grava resolved_by e resolved_at (o bug era só 'fixed' gravar)", () => {
  const f = closureFields("ignored", "agent") as Record<string, string>;
  assert.equal(f.resolved_by, "agent");
  assert.ok(f.resolved_at);
});

test("status não-fechado LIMPA os campos (reabrir zera resolved_at/resolved_by — card 261b295b)", () => {
  for (const status of ["open", "investigating", "fixing"]) {
    assert.deepEqual(
      closureFields(status, "agent"),
      { resolved_by: null, resolved_at: null },
      `status ${status}`,
    );
  }
});

test("status desconhecido também limpa (defensivo: nunca carimba fechamento por engano)", () => {
  assert.deepEqual(closureFields("banana", "agent"), {
    resolved_by: null,
    resolved_at: null,
  });
});

test("`at` explícito é respeitado (incidente que nasce fechado usa o momento da ocorrência)", () => {
  const at = "2026-08-20T12:00:00.000Z";
  const f = closureFields("ignored", "sync:user-error", at) as Record<string, string>;
  assert.equal(f.resolved_at, at);
  assert.equal(f.resolved_by, "sync:user-error");
});

test("CLOSED_STATUSES é exatamente {fixed, ignored}", () => {
  assert.deepEqual([...CLOSED_STATUSES].sort(), ["fixed", "ignored"]);
});
