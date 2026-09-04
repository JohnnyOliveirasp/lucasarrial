/**
 * Testes do hottok (autenticidade do webhook da Hotmart). Rodar
 * (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/hottok.test.ts
 *
 * O QUE ESTES TESTES PROTEGEM: o webhook passou a atender dois produtos
 * (FastCloner e SGP). Aceitar dois tokens não pode virar "aceita qualquer
 * coisa" — a maior parte dos casos abaixo é justamente de RECUSA.
 *
 * Nenhum valor real de token aparece aqui: são strings inventadas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENVS_DO_HOTTOK, hottokValido, tokensEsperados } from "./hottok.ts";

const FAST = "token-do-fastcloner-aaa";
const SGP = "token-do-sgp-bbb";

// ── tokensEsperados: o que o ambiente vira ──────────────────────────────────

test("um token só (o de hoje) continua sendo um token só", () => {
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: FAST }), [FAST]);
});

test("HOTMART_HOTTOK aceita lista separada por vírgula", () => {
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: `${FAST},${SGP}` }), [FAST, SGP]);
});

test("HOTMART_HOTTOK_SGP entra como segundo token", () => {
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: FAST, HOTMART_HOTTOK_SGP: SGP }), [FAST, SGP]);
});

test("espaço em volta do token é aparado (colar do painel não pode quebrar)", () => {
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: `  ${FAST} ,\n${SGP}  ` }), [FAST, SGP]);
});

test("token repetido nos dois envs vira um só", () => {
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: FAST, HOTMART_HOTTOK_SGP: FAST }), [FAST]);
});

test("vazio, só vírgulas ou só espaço não vira token nenhum", () => {
  assert.deepEqual(tokensEsperados({}), []);
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: "" }), []);
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: "   " }), []);
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: ",,, ," }), []);
  assert.deepEqual(tokensEsperados({ HOTMART_HOTTOK: FAST, HOTMART_HOTTOK_SGP: "" }), [FAST]);
});

test("os nomes de ambiente lidos são exatamente estes dois", () => {
  assert.deepEqual([...ENVS_DO_HOTTOK], ["HOTMART_HOTTOK", "HOTMART_HOTTOK_SGP"]);
});

// ── hottokValido: quem entra e quem toma 401 ────────────────────────────────

test("o token do FastCloner continua entrando (não quebrar o que já funciona)", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: FAST, HOTMART_HOTTOK_SGP: SGP });
  assert.equal(hottokValido(FAST, esperados), true);
});

test("o token do SGP entra", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: FAST, HOTMART_HOTTOK_SGP: SGP });
  assert.equal(hottokValido(SGP, esperados), true);
});

test("token de terceiro é recusado mesmo com dois esperados configurados", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: FAST, HOTMART_HOTTOK_SGP: SGP });
  assert.equal(hottokValido("token-de-outro-produtor", esperados), false);
});

test("quase certo é errado: um caractere a mais/a menos não passa", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: FAST });
  assert.equal(hottokValido(FAST + "x", esperados), false);
  assert.equal(hottokValido(FAST.slice(0, -1), esperados), false);
  assert.equal(hottokValido(FAST.toUpperCase(), esperados), false);
});

test("sem token recebido é 401 (null, undefined e vazio)", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: FAST });
  assert.equal(hottokValido(null, esperados), false);
  assert.equal(hottokValido(undefined, esperados), false);
  assert.equal(hottokValido("", esperados), false);
});

test("FECHA POR PADRÃO: ambiente sem nenhum token esperado recusa tudo", () => {
  assert.equal(hottokValido(FAST, []), false);
  assert.equal(hottokValido("", []), false);
  // o caso perigoso: env em branco não pode virar "qualquer um entra"
  assert.equal(hottokValido("qualquer-coisa", tokensEsperados({ HOTMART_HOTTOK: "" })), false);
});

test("env em branco não pode ser aberto com header em branco", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: FAST, HOTMART_HOTTOK_SGP: "   " });
  assert.equal(hottokValido("", esperados), false);
  assert.equal(hottokValido("   ", esperados), false);
});

test("tamanho diferente NÃO explode (timingSafeEqual cru lançaria)", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: FAST });
  assert.equal(hottokValido("x", esperados), false);
  assert.equal(hottokValido("x".repeat(5000), esperados), false);
});

test("caractere fora do ASCII não quebra a comparação", () => {
  const esperados = tokensEsperados({ HOTMART_HOTTOK: "tôken-com-acento-ção" });
  assert.equal(hottokValido("tôken-com-acento-ção", esperados), true);
  assert.equal(hottokValido("token-com-acento-cao", esperados), false);
});
