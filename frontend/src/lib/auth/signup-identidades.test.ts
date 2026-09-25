/**
 * Testes do detector de "e-mail já tem conta" na resposta do
 * `supabase.auth.signUp` (caso irleygurgel@gmail.com — conta criada no
 * onboarding, nunca teve código de verificação a enviar). Rodar
 * (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/auth/signup-identidades.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { emailJaTemConta } from "./signup-identidades.ts";

test("identities vazio (array com 0 itens) = e-mail já tem conta", () => {
  assert.equal(emailJaTemConta([]), true);
});

test("identities com 1+ item = conta nova, segue o fluxo normal", () => {
  assert.equal(emailJaTemConta([{ id: "abc", provider: "email" }]), false);
});

test("identities undefined/null não é tratado como conta existente (fail-safe)", () => {
  assert.equal(emailJaTemConta(undefined), false);
  assert.equal(emailJaTemConta(null), false);
});

test("valor que não é array não é tratado como conta existente", () => {
  assert.equal(emailJaTemConta("nao é array"), false);
  assert.equal(emailJaTemConta(42), false);
  assert.equal(emailJaTemConta({}), false);
});
