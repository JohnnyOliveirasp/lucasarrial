/**
 * Trava do fechamento/reabertura de incidente.
 *
 * Estes testes existem por causa de um histórico específico: seis consertos na
 * mesma família, e DUAS tentativas de centralizar que ainda saíram com 2 dos 3
 * campos (o helper da branch feat/incidents-resolved-at e a cópia inline em
 * entregar.ts). O caso do `resolved_commit` é o que ninguém lembra — então é o
 * que está mais coberto aqui.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// Extensão explícita: o `node --test` não resolve import extensionless (lição
// do PR #159, rajada-nasce-fechada).
import { CLOSED_STATUSES, closureFields, limparFechamento } from "./closure.ts";

test("limparFechamento devolve os TRÊS campos nulos, não dois", () => {
  const campos = limparFechamento();
  assert.deepEqual(campos, {
    resolved_at: null,
    resolved_by: null,
    resolved_commit: null,
  });
  // O bug de 02/09 foi exatamente um objeto com 2 chaves onde deviam ser 3.
  assert.equal(Object.keys(campos).length, 3);
});

test("fixed e ignored contam como fechado; os outros não", () => {
  assert.ok(CLOSED_STATUSES.has("fixed"));
  assert.ok(CLOSED_STATUSES.has("ignored"));
  for (const aberto of ["open", "investigating", "fixing", "aguardando_aluno"]) {
    assert.ok(!CLOSED_STATUSES.has(aberto), `${aberto} não pode ser fechado`);
  }
});

test("fechar grava quem e quando", () => {
  const campos = closureFields("fixed", "suporte@x.com", "2026-09-02T10:00:00.000Z");
  assert.equal(campos.resolved_by, "suporte@x.com");
  assert.equal(campos.resolved_at, "2026-09-02T10:00:00.000Z");
});

test("ignored também grava a data (conserto 981f2fb, não regredir)", () => {
  const campos = closureFields("ignored", "agent", "2026-09-02T10:00:00.000Z");
  assert.equal(campos.resolved_at, "2026-09-02T10:00:00.000Z");
  assert.equal(campos.resolved_by, "agent");
});

test("fechar SEM commit não mexe em resolved_commit", () => {
  // A rota lê resolved_commit do corpo ANTES de espalhar estes campos.
  // Se o helper devolvesse `resolved_commit: null` aqui, apagaria o valor que
  // o chamador acabou de informar.
  const campos = closureFields("fixed", "agent");
  assert.ok(!("resolved_commit" in campos));
});

test("fechar COM commit grava o commit", () => {
  const campos = closureFields("fixed", "agent", undefined, "abc1234");
  assert.equal((campos as { resolved_commit?: string | null }).resolved_commit, "abc1234");
});

test("reabrir limpa os três — inclusive resolved_commit", () => {
  for (const aberto of ["open", "investigating", "fixing", "aguardando_aluno"]) {
    assert.deepEqual(
      closureFields(aberto, "agent"),
      { resolved_at: null, resolved_by: null, resolved_commit: null },
      `${aberto} tem que limpar os três`,
    );
  }
});

test("reabrir ignora commit informado — reabertura não carimba", () => {
  const campos = closureFields("investigating", "agent", undefined, "abc1234");
  assert.equal((campos as { resolved_commit?: string | null }).resolved_commit, null);
});

test("um patch de reabertura sobrescreve carimbo anterior ao ser espalhado", () => {
  // Simula o que a rota faz: monta o update com o commit vindo do corpo e
  // depois espalha os campos de status. Na reabertura o carimbo tem que morrer.
  const update: Record<string, unknown> = { resolved_commit: "deadbee" };
  Object.assign(update, closureFields("open", "agent"));
  assert.equal(update.resolved_commit, null);
  assert.equal(update.resolved_at, null);
  assert.equal(update.resolved_by, null);
});
