/**
 * `npx tsx --test src/lib/auth/base-url-publica.test.ts`
 *
 * O que protege: o redirect do `auth/callback` fica no host que recebeu o
 * cookie (o `www.`, casa do aluno aberto pelo suporte) e NUNCA vira open-
 * redirect por cabeçalho forjado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseUrlPublica } from "./base-url-publica.ts";

const ENV = "https://fastcloner.com";
const ORIGIN = "http://localhost:3002";
const h = (pares: Record<string, string>): Pick<Headers, "get"> => ({
  get: (k: string) => pares[k.toLowerCase()] ?? null,
});

test("request pelo apex → env (como sempre)", () => {
  assert.equal(baseUrlPublica(h({ host: "fastcloner.com" }), ORIGIN, ENV), ENV);
});

test("request pelo www → fica no www (o cookie do aluno mora lá)", () => {
  assert.equal(
    baseUrlPublica(h({ "x-forwarded-host": "www.fastcloner.com" }), ORIGIN, ENV),
    "https://www.fastcloner.com",
  );
  assert.equal(baseUrlPublica(h({ host: "WWW.FastCloner.com" }), ORIGIN, ENV), "https://www.fastcloner.com");
});

test("host estranho (forjado) → env, nunca o host do cabeçalho", () => {
  for (const mau of ["evil.com", "www.evil.com", "fastcloner.com.evil.com", "wwwfastcloner.com"]) {
    assert.equal(baseUrlPublica(h({ "x-forwarded-host": mau }), ORIGIN, ENV), ENV, mau);
  }
});

test("x-forwarded-host com lista pega só o primeiro", () => {
  assert.equal(
    baseUrlPublica(h({ "x-forwarded-host": "www.fastcloner.com, proxy.interno" }), ORIGIN, ENV),
    "https://www.fastcloner.com",
  );
});

test("sem cabeçalho de host → env; sem env → origin sem barra final", () => {
  assert.equal(baseUrlPublica(h({}), ORIGIN, ENV), ENV);
  assert.equal(baseUrlPublica(h({}), "http://localhost:3002/", undefined), ORIGIN);
});

test("env sem barra final duplicada", () => {
  assert.equal(baseUrlPublica(h({ host: "fastcloner.com" }), ORIGIN, "https://fastcloner.com//"), ENV);
});
