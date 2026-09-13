/**
 * O token de retomada É a chave do pedido de um aluno. Os testes que importam
 * são os de RECUSA: assinatura adulterada, sessão trocada dentro do payload,
 * expiração esticada, token de outra instalação e vencimento.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/retomada.test.ts
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  assinarRetomada,
  linkDeRetomada,
  RETOMADA_VALIDADE_MS,
  verificarRetomada,
} from "./retomada.ts";

const ENVS = ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SITE_URL", "SITE_URL"] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENVS) original[k] = process.env[k];
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-de-teste-suficientemente-longa";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.exemplo.com/";
  delete process.env.SITE_URL;
});

afterEach(() => {
  for (const k of ENVS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

const SESSAO = "3f1c9a2e-4b7d-4a10-9c8e-2d5f6a7b8c9d";
const OUTRA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/** Reescreve o payload mantendo a assinatura original. */
function forjar(token: string, novoPayload: string): string {
  const corte = token.lastIndexOf("~");
  return Buffer.from(novoPayload, "utf8").toString("base64url") + token.slice(corte);
}

function payloadDe(token: string): string {
  return Buffer.from(token.slice(0, token.lastIndexOf("~")), "base64url").toString("utf8");
}

test("ida e volta: o token devolve a mesma sessão", () => {
  const t = assinarRetomada(SESSAO, 1_000_000);
  assert.deepEqual(verificarRetomada(t, 1_000_000), { sessao: SESSAO });
});

test("vence na hora certa — e o motivo é 'vencido', não 'invalido'", () => {
  const t = assinarRetomada(SESSAO, 0);
  // O motivo separado é o que deixa a tela dizer "peça outro link" em vez de
  // uma mensagem que soa como culpa do aluno.
  assert.deepEqual(verificarRetomada(t, RETOMADA_VALIDADE_MS), { sessao: SESSAO });
  assert.deepEqual(verificarRetomada(t, RETOMADA_VALIDADE_MS + 1), { erro: "vencido" });
});

test("a validade é longa de propósito (≥ 7 dias)", () => {
  // Link de acesso curto já custou caro: a leva de 04/09 usou 1h e 341 de 349
  // pessoas nunca entraram.
  assert.ok(RETOMADA_VALIDADE_MS >= 7 * 24 * 60 * 60 * 1000, "validade curta demais pra e-mail");
});

test("assinatura adulterada é recusada", () => {
  const t = assinarRetomada(SESSAO, 1_000);
  const corte = t.lastIndexOf("~");
  const hmac = t.slice(corte + 1);
  const trocado = `${t.slice(0, corte)}~${hmac[0] === "a" ? "b" : "a"}${hmac.slice(1)}`;
  assert.deepEqual(verificarRetomada(trocado, 1_000), { erro: "invalido" });
});

test("trocar a SESSÃO no payload não abre o pedido de outro aluno", () => {
  const t = assinarRetomada(SESSAO, 1_000);
  const forjado = forjar(t, payloadDe(t).replace(SESSAO, OUTRA));
  assert.deepEqual(verificarRetomada(forjado, 1_000), { erro: "invalido" });
});

test("esticar a expiração também quebra a assinatura", () => {
  const t = assinarRetomada(SESSAO, 0);
  const esticado = `${SESSAO}.${RETOMADA_VALIDADE_MS * 100}`;
  assert.notEqual(payloadDe(t), esticado);
  const forjado = forjar(t, esticado);
  assert.deepEqual(verificarRetomada(forjado, RETOMADA_VALIDADE_MS + 1), { erro: "invalido" });
});

test("payload sem uuid de sessão é recusado mesmo com assinatura válida", () => {
  // Assinado por nós, mas apontando pra "sessão" que não é uuid: o formato tem
  // que barrar antes de qualquer consulta ao banco.
  const t = assinarRetomada("nao-e-uuid" as string, 1_000);
  assert.deepEqual(verificarRetomada(t, 1_000), { erro: "invalido" });
});

test("lixo, vazio e não-string caem em 'invalido' sem explodir", () => {
  for (const v of ["", "abc", "~", "~xyz", "a~b", null, undefined, 42, {}]) {
    assert.deepEqual(verificarRetomada(v as unknown), { erro: "invalido" }, String(v));
  }
});

test("token assinado com OUTRA service key é recusado", () => {
  const alheio = assinarRetomada(SESSAO, 1_000);
  process.env.SUPABASE_SERVICE_ROLE_KEY = "outra-service-key-completamente-diferente";
  assert.deepEqual(verificarRetomada(alheio, 1_000), { erro: "invalido" });
});

test("linkDeRetomada monta URL absoluta e o token sobrevive à volta", () => {
  const link = linkDeRetomada(SESSAO, 1_000);
  assert.ok(link, "link não deveria ser null com a env configurada");
  // Barra final da env não pode virar "//api".
  assert.ok(
    link!.startsWith("https://app.exemplo.com/api/v1/sgp/retomar?token="),
    `URL inesperada: ${link}`,
  );
  const token = new URL(link!).searchParams.get("token");
  assert.deepEqual(verificarRetomada(token, 1_000), { sessao: SESSAO });
});

test("sem NEXT_PUBLIC_SITE_URL devolve null em vez de link quebrado", () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(linkDeRetomada(SESSAO, 1_000), null);
});

test("o separador é '~': ponto na URL faz o middleware tratar como arquivo", () => {
  const t = assinarRetomada(SESSAO, 1_000);
  assert.ok(t.includes("~"));
  assert.ok(!t.includes("."), "ponto no token derruba o matcher do middleware");
});
