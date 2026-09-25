/**
 * Agrupamento por PESSOA do painel de Falhas (pedido do Johnny, 24/09:
 * "agrupa por PESSOA, com os pedidos dentro de cada uma").
 *
 * O que estes testes seguram, em ordem do que dói mais se quebrar:
 *  · NADA SE PERDE — quem tem 3 chamados continua com os 3 (regra 3 do card);
 *  · a pessoa é o e-mail NORMALIZADO (a duplicata visual que o Johnny
 *    estranhou nasce de grafia diferente do mesmo e-mail);
 *  · chamado compartilhado aparece pra CADA pessoa dele;
 *  · chamado sem e-mail não vai parar num balaio único de desconhecidos.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Extensão explícita: o `node --test` não resolve import extensionless (lição
// do PR #159, rajada-nasce-fechada).
import {
  agruparPorPessoa,
  chaveEmail,
  contarPessoas,
  totalChamadosDistintos,
} from "./agrupar-pessoa.ts";

const inc = (id: string, ...emails: string[]) => ({ id, affected_emails: emails });

test("quem tem 3 chamados continua mostrando os 3, na ordem da entrada", () => {
  const grupos = agruparPorPessoa([
    inc("a", "ana@x.com"),
    inc("b", "ana@x.com"),
    inc("c", "ana@x.com"),
  ]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].chave, "ana@x.com");
  assert.deepEqual(
    grupos[0].incidentes.map((i) => i.id),
    ["a", "b", "c"],
  );
});

test("grafia diferente do MESMO e-mail é a mesma pessoa — era esta a 'duplicata' da tela", () => {
  const grupos = agruparPorPessoa([inc("a", "Ana@X.com"), inc("b", " ana@x.com ")]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].chave, "ana@x.com");
  // A grafia original da primeira aparição é a que vai pra tela.
  assert.equal(grupos[0].email, "Ana@X.com");
  assert.deepEqual(
    grupos[0].incidentes.map((i) => i.id),
    ["a", "b"],
  );
});

test("chamado com DOIS e-mails aparece no grupo de CADA pessoa — sumir de um seria esconder", () => {
  const grupos = agruparPorPessoa([inc("a", "ana@x.com", "beto@x.com"), inc("b", "beto@x.com")]);
  assert.equal(grupos.length, 2);
  const ana = grupos.find((g) => g.chave === "ana@x.com");
  const beto = grupos.find((g) => g.chave === "beto@x.com");
  assert.deepEqual(ana?.incidentes.map((i) => i.id), ["a"]);
  assert.deepEqual(beto?.incidentes.map((i) => i.id), ["a", "b"]);
  // O compartilhado conta UMA vez no total distinto, mesmo morando em 2 grupos.
  assert.equal(totalChamadosDistintos(grupos), 2);
});

test("sem e-mail: cada chamado vira grupo solto PRÓPRIO — dois desconhecidos não se colam", () => {
  const grupos = agruparPorPessoa([
    { id: "a", affected_emails: [] },
    { id: "b", affected_emails: null },
    { id: "c" },
  ]);
  assert.equal(grupos.length, 3);
  for (const g of grupos) {
    assert.equal(g.chave, null);
    assert.equal(g.email, null);
    assert.equal(g.incidentes.length, 1);
  }
  assert.equal(contarPessoas(grupos), 0);
});

test("e-mail repetido DENTRO do mesmo chamado não duplica o chamado no grupo", () => {
  const grupos = agruparPorPessoa([inc("a", "ana@x.com", "ANA@x.com ")]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].incidentes.length, 1);
});

test("ordem dos grupos = posição do chamado MAIS RECENTE (a entrada já vem desc)", () => {
  const grupos = agruparPorPessoa([
    inc("a1", "ana@x.com"),
    inc("b1", "beto@x.com"),
    inc("a2", "ana@x.com"),
  ]);
  assert.deepEqual(
    grupos.map((g) => g.chave),
    ["ana@x.com", "beto@x.com"],
  );
  assert.deepEqual(grupos[0].incidentes.map((i) => i.id), ["a1", "a2"]);
});

test("conservação: nenhum chamado se perde no agrupamento (mistura realista)", () => {
  const entrada = [
    inc("1", "ana@x.com"),
    inc("2", "Beto@x.com", "ana@x.com"),
    { id: "3", affected_emails: [] as string[] },
    inc("4", "beto@x.com"),
    inc("5", "carla@x.com"),
  ];
  const grupos = agruparPorPessoa(entrada);
  assert.equal(totalChamadosDistintos(grupos), entrada.length);
  assert.equal(contarPessoas(grupos), 3);
});

test("chaveEmail: lixo não vira pessoa", () => {
  assert.equal(chaveEmail("  "), null);
  assert.equal(chaveEmail(""), null);
  assert.equal(chaveEmail(null), null);
  assert.equal(chaveEmail(42), null);
  assert.equal(chaveEmail(" Ana@X.com "), "ana@x.com");
});

// ─── Tripwire: a TELA usa mesmo o agrupamento ────────────────────────────────
// Módulo puro certo + página ignorando ele = pedido não atendido. O teste lê o
// fonte da página (padrão da casa) e cobra o fio ligado.
test("tripwire: a página de Falhas importa e usa agruparPorPessoa", () => {
  const src = readFileSync(
    new URL("../../app/[locale]/admin/falhas/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /from "@\/lib\/incidents\/agrupar-pessoa"/);
  assert.match(src, /agruparPorPessoa\(/);
});
