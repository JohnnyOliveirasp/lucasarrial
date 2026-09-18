/**
 * Testes do montador do link de acesso (incidente #438). Rodar
 * (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/auth/link-de-acesso.test.ts
 *
 * O que estes testes travam é a REGRESSÃO que custou 14 alunos: o link tem que
 * levar o token na QUERY como `token_hash`, porque é só esse ramo do
 * `auth/callback/route.ts` que chama `verifyOtp` no servidor. Um link com o
 * token no FRAGMENTO (`#access_token=…`, que é o formato do `action_link`) não
 * entrega nada pro servidor e queima o token.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESTINO_DEFINIR_SENHA,
  VALIDADE_LINK_MINUTOS,
  montarLinkDeAcesso,
} from "./link-de-acesso.ts";

test("o link leva token_hash/type/next na QUERY, e nada no fragmento", () => {
  const link = montarLinkDeAcesso({
    site: "https://fastcloner.com",
    hashedToken: "abc123",
    type: "recovery",
  });

  const u = new URL(link);
  assert.equal(u.origin + u.pathname, "https://fastcloner.com/auth/callback");
  assert.equal(u.searchParams.get("token_hash"), "abc123");
  assert.equal(u.searchParams.get("type"), "recovery");
  assert.equal(u.searchParams.get("next"), DESTINO_DEFINIR_SENHA);

  // O ponto do incidente: NADA pode viajar no fragmento, porque fragmento não
  // chega no servidor.
  assert.equal(u.hash, "");
  assert.ok(!link.includes("#"));
});

test("não monta link no formato do action_link (/auth/v1/verify)", () => {
  const link = montarLinkDeAcesso({
    site: "https://fastcloner.com",
    hashedToken: "abc123",
    type: "recovery",
  });
  assert.ok(!link.includes("/auth/v1/verify"));
  assert.ok(!link.includes("access_token"));
});

test("o token vai percent-encoded — token com caractere especial não quebra a query", () => {
  const link = montarLinkDeAcesso({
    site: "https://fastcloner.com",
    hashedToken: "pkce_a+b/c=d&e",
    type: "recovery",
  });
  // Lido de volta pela URL, tem que voltar idêntico ao original.
  assert.equal(new URL(link).searchParams.get("token_hash"), "pkce_a+b/c=d&e");
  // E o "&e" não pode ter virado um parâmetro solto.
  assert.equal(new URL(link).searchParams.get("e"), null);
});

test("barra sobrando no fim do site não vira barra dupla", () => {
  const link = montarLinkDeAcesso({
    site: "https://fastcloner.com///",
    hashedToken: "t",
    type: "recovery",
  });
  assert.ok(link.startsWith("https://fastcloner.com/auth/callback?"));
});

test("o `type` acompanha o generateLink (magiclink não vira recovery)", () => {
  const link = montarLinkDeAcesso({
    site: "https://fastcloner.com",
    hashedToken: "t",
    type: "magiclink",
  });
  assert.equal(new URL(link).searchParams.get("type"), "magiclink");
});

test("`next` customizado é respeitado e vai encodado", () => {
  const link = montarLinkDeAcesso({
    site: "https://fastcloner.com",
    hashedToken: "t",
    type: "recovery",
    next: "/app/dashboard?x=1",
  });
  assert.equal(new URL(link).searchParams.get("next"), "/app/dashboard?x=1");
});

test("hashed_token vazio estoura em vez de gerar link inútil", () => {
  assert.throws(
    () =>
      montarLinkDeAcesso({
        site: "https://fastcloner.com",
        hashedToken: "",
        type: "recovery",
      }),
    /hashed_token vazio/,
  );
  assert.throws(
    () =>
      montarLinkDeAcesso({
        site: "https://fastcloner.com",
        hashedToken: "   ",
        type: "recovery",
      }),
    /hashed_token vazio/,
  );
});

test("`next` externo é recusado (open-redirect)", () => {
  assert.throws(
    () =>
      montarLinkDeAcesso({
        site: "https://fastcloner.com",
        hashedToken: "t",
        type: "recovery",
        next: "https://evil.com",
      }),
    /caminho interno/,
  );
});

test("as constantes são as que o endpoint de admin publica", () => {
  assert.equal(DESTINO_DEFINIR_SENHA, "/reset-password");
  assert.equal(VALIDADE_LINK_MINUTOS, 60);
});
