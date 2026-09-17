/**
 * node --test src/lib/payments/email-normalizado.test.ts
 *
 * O caso com nome de gente é o medido em produção em 17/09/2026: a compra
 * `herysilva.27@gmail.com` (entitlement PPEVZBRG, `user_id` NULL) e a conta
 * `herysilva27@gmail.com` (`profiles` 2f0e5cf8-6461-47c8-b418-8b3ab78bdb92,
 * plan pro, criada em 21/07) são a MESMA pessoa. Se este arquivo quebrar, a
 * guarda `hasAccount` voltou a ser cega pro alias do Gmail e a casa voltou a
 * mandar "crie sua conta" pra quem já é cliente ativo (incidente #306).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { normalizarEmailParaComparacao } from "./email-normalizado.ts";

test("caso herysilva: ponto no Gmail é a MESMA caixa", () => {
  assert.equal(
    normalizarEmailParaComparacao("herysilva.27@gmail.com"),
    normalizarEmailParaComparacao("herysilva27@gmail.com"),
  );
  assert.equal(normalizarEmailParaComparacao("herysilva.27@gmail.com"), "herysilva27@gmail.com");
});

test("Gmail: +tag é cortado", () => {
  assert.equal(normalizarEmailParaComparacao("nome+tag@gmail.com"), "nome@gmail.com");
  assert.equal(
    normalizarEmailParaComparacao("nome+tag@gmail.com"),
    normalizarEmailParaComparacao("nome@gmail.com"),
  );
});

test("googlemail.com é alias do gmail.com: ponto, +tag e domínio dobram juntos", () => {
  assert.equal(normalizarEmailParaComparacao("n.o.m.e+x@googlemail.com"), "nome@gmail.com");
  assert.equal(
    normalizarEmailParaComparacao("n.o.m.e+x@googlemail.com"),
    normalizarEmailParaComparacao("nome@gmail.com"),
  );
});

test("maiúsculas não distinguem caixa", () => {
  assert.equal(normalizarEmailParaComparacao("A.B@GMAIL.COM"), "ab@gmail.com");
  assert.equal(normalizarEmailParaComparacao("  A.B@GMAIL.COM  "), "ab@gmail.com");
});

/**
 * ESTE é o teste que impede o conserto de virar dano. Fundir endereços de
 * provedor que NÃO ignora ponto leria um pagante órfão de verdade como "já tem
 * conta" e o deixaria em silêncio, pagando sem acesso.
 */
test("domínio não-Gmail NÃO funde: o ponto distingue pessoas", () => {
  assert.notEqual(
    normalizarEmailParaComparacao("a.b@outlook.com"),
    normalizarEmailParaComparacao("ab@outlook.com"),
  );
  assert.equal(normalizarEmailParaComparacao("a.b@outlook.com"), "a.b@outlook.com");
  assert.notEqual(
    normalizarEmailParaComparacao("joao.silva@empresa.com.br"),
    normalizarEmailParaComparacao("joaosilva@empresa.com.br"),
  );
});

test("domínio não-Gmail: +tag também NÃO é cortado", () => {
  // Fora do Google o `+` não é garantido como sub-endereço; cortar poderia
  // fundir caixas distintas — de novo o lado perigoso.
  assert.equal(normalizarEmailParaComparacao("nome+tag@hotmail.com"), "nome+tag@hotmail.com");
  assert.notEqual(
    normalizarEmailParaComparacao("nome+tag@hotmail.com"),
    normalizarEmailParaComparacao("nome@hotmail.com"),
  );
});

test("entrada vazia / suja não explode", () => {
  assert.equal(normalizarEmailParaComparacao(""), "");
  assert.equal(normalizarEmailParaComparacao("   "), "");
  assert.equal(normalizarEmailParaComparacao(null), "");
  assert.equal(normalizarEmailParaComparacao(undefined), "");
  assert.equal(normalizarEmailParaComparacao("sem-arroba"), "sem-arroba");
  assert.equal(normalizarEmailParaComparacao("@gmail.com"), "@gmail.com");
  assert.equal(normalizarEmailParaComparacao("SEM-ARROBA"), "sem-arroba");
});

test("local-part que sumiria inteiro não colapsa em chave única", () => {
  // ".@gmail.com" e "+x@gmail.com" não são endereço real. Se os dois virassem
  // "@gmail.com" eles colidiriam entre si — colisão é o lado que CALA pagante.
  assert.notEqual(
    normalizarEmailParaComparacao(".@gmail.com"),
    normalizarEmailParaComparacao("+x@gmail.com"),
  );
});

test("é idempotente: normalizar duas vezes dá o mesmo", () => {
  for (const e of [
    "herysilva.27@gmail.com",
    "n.o.m.e+x@googlemail.com",
    "a.b@outlook.com",
    "sem-arroba",
    "",
  ]) {
    const uma = normalizarEmailParaComparacao(e);
    assert.equal(normalizarEmailParaComparacao(uma), uma, `não idempotente para ${JSON.stringify(e)}`);
  }
});
