/**
 * O que este teste protege, em uma frase: o e-mail do código NUNCA sai sem
 * dizer PARA ONDE VOLTAR (incidente #365).
 *
 * O bug era exatamente isto: o corpo mandava "digite ele na tela pra
 * continuar" e não havia tela nenhuma citada. Quem fechou a aba ficou com um
 * código de 6 dígitos na mão e nenhum caminho de volta — 9 alunos expostos.
 *
 * Por isso o caso que mais importa aqui é o (3), do fallback: as outras
 * asserções conferem que a URL sai certa, aquela confere que ela SAI.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/sgp/codigo.test.ts
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { CODIGO_VALIDADE_MIN, enviarCodigo, gerarCodigo, hashCodigo } from "./codigo.ts";

const ENVS = ["NEXT_PUBLIC_SITE_URL", "SITE_URL"] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENVS) original[k] = process.env[k];
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.exemplo.com";
  delete process.env.SITE_URL;
});

afterEach(() => {
  for (const k of ENVS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

const EMAIL = "aluna@exemplo.com";
const CODIGO = "042917";

/**
 * Espião no lugar do SMTP. Guarda a mensagem e devolve — se o código um dia
 * parar de passar pelo canal injetado, `ultima` fica nula e todo teste falha,
 * em vez de passar em silêncio tendo mandado e-mail de verdade.
 */
function espiao() {
  const enviadas: { to: string; subject: string; text: string }[] = [];
  const enviar = async (m: { to: string; subject: string; text: string }) => {
    enviadas.push(m);
    return true;
  };
  return {
    enviar,
    get ultima() {
      assert.equal(enviadas.length, 1, "esperava exatamente 1 e-mail enviado");
      return enviadas[0];
    },
  };
}

/** Manda o e-mail e devolve o que o canal recebeu. */
async function enviado(nome?: string | null) {
  const spy = espiao();
  await enviarCodigo(EMAIL, CODIGO, nome, spy.enviar);
  return spy.ultima;
}

// ------------------------------------------------------- (1) a URL sai certa

test("(1) o corpo traz a URL /sgp montada a partir da config", async () => {
  const { text } = await enviado("Renata Arielo");
  assert.match(text, /https:\/\/app\.exemplo\.com\/sgp/, `sem link no corpo:\n${text}`);
});

test("(2) sem NEXT_PUBLIC_SITE_URL, a variável alternativa SITE_URL assume", async () => {
  // Mesmo par que `siteUrl()` e `linkDeRetomada()` leem, nessa ordem.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.SITE_URL = "https://alternativa.exemplo.com";
  const { text } = await enviado();
  assert.match(text, /https:\/\/alternativa\.exemplo\.com\/sgp/, text);
});

test("(3) SEM NENHUMA DAS DUAS o e-mail ainda leva link — é o bug do #365", async () => {
  // A regra oposta à do `linkDeRetomada`, que devolve null sem config. Aqui
  // devolver nada significa repetir o incidente: código sem destino.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
  const { text } = await enviado();
  assert.match(text, /https:\/\/fastcloner\.com\/sgp/, `e-mail saiu sem link:\n${text}`);
});

test("(4) barra final na config não vira barra dupla na URL", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.exemplo.com///";
  const { text } = await enviado();
  assert.match(text, /https:\/\/app\.exemplo\.com\/sgp/, text);
  assert.ok(!/app\.exemplo\.com\/\/+sgp/.test(text), `barra dupla na URL:\n${text}`);
});

test("(4b) a URL do corpo é absoluta e parseável, não um pedaço de texto", async () => {
  // `match` acima passaria com a URL grudada em outra palavra; aqui ela é
  // extraída e parseada como o cliente de e-mail faria ao virar link.
  const { text } = await enviado();
  const achada = text.match(/https?:\/\/\S*?\/sgp/)?.[0];
  assert.ok(achada, `nenhuma URL absoluta no corpo:\n${text}`);
  const url = new URL(achada);
  assert.equal(url.origin, "https://app.exemplo.com");
  assert.equal(url.pathname, "/sgp");
  assert.equal(url.search, "", "link público não pode carregar token nem query");
});

// -------------------------------------------- (5) o que NÃO podia ter mudado

test("(5) o código de 6 dígitos continua no corpo e o assunto não mudou", async () => {
  const m = await enviado("Renata Arielo");
  assert.equal(m.to, EMAIL);
  assert.equal(m.subject, `${CODIGO} é o seu código do Sistema de Geração Pronto`);
  assert.match(m.text, new RegExp(`\\s${CODIGO}\\n`), `o código sumiu do corpo:\n${m.text}`);
  assert.match(m.text, /Oi, Renata!/);
  assert.match(m.text, new RegExp(`vale ${CODIGO_VALIDADE_MIN} minutos`));
  assert.match(m.text, /— Equipe FastCloner$/);
});

test("(5b) sem nome o e-mail continua saindo, com o 'Oi!' seco", async () => {
  const { text } = await enviado(null);
  assert.match(text, /^Oi!\n/);
  assert.match(text, /https:\/\/app\.exemplo\.com\/sgp/);
});

test("(5c) o resto do módulo segue de pé: gerarCodigo e hashCodigo", () => {
  // Não é escopo do #365, mas são as duas funções que a rota usa junto com
  // esta — e o arquivo não tinha teste nenhum até agora.
  assert.match(gerarCodigo(), /^\d{6}$/);
  assert.equal(hashCodigo(` ${CODIGO} `), hashCodigo(CODIGO), "o trim faz parte do contrato");
  assert.notEqual(hashCodigo(CODIGO), CODIGO, "o código não pode ser guardado em claro");
});
