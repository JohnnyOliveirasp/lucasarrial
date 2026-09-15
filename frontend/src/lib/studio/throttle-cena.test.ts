/**
 * Testes da política de espera por throttle na cena do Estúdio (#358, perna 2).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/studio/throttle-cena.test.ts
 *
 * O DEFEITO COBERTO: o #240 criou `KieRateLimitError` mas ninguém escutava —
 * o 429 que sobrevivia às 3 retentativas caía no catch genérico de
 * `scenes.ts`, que chama `failScene` (status `failed` + ESTORNO). Fila cheia
 * momentânea virava cena destruída permanentemente.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deveAdiarPorThrottle, ehThrottleEsgotado, JANELA_ESPERA_THROTTLE_MS } from "./throttle-cena.ts";
// A classe DE VERDADE, do módulo de transporte. Importável aqui porque os dois
// são folhas sem imports e o caminho leva extensão (`allowImportingTsExtensions`).
import { KieRateLimitError } from "../kie/http.ts";

const AGORA = Date.parse("2026-09-11T18:00:00Z");
const nascidaHa = (ms: number) => new Date(AGORA - ms).toISOString();

test("AMARRA O CONTRATO: o KieRateLimitError real é reconhecido", () => {
  // Este é o teste que protege o acoplamento por `name`. Se alguém renomear a
  // classe do #240 ou tirar o `this.name` do construtor, ele quebra AQUI — em
  // vez de a cena do aluno voltar a ser destruída em silêncio na produção.
  const real = new KieRateLimitError("Kie 429: Your call frequency is too high");
  assert.ok(ehThrottleEsgotado(real));
  assert.ok(deveAdiarPorThrottle(real, nascidaHa(60_000), AGORA));
});

test("erro comum do Kie NÃO adia (segue falhando e estornando como hoje)", () => {
  // A régua só vale pro throttle. Falha determinística tem que morrer na hora:
  // adiar aqui só faria o aluno esperar 30 min por uma cena que não vem.
  const comum = new Error("Kie 500: internal error");
  assert.equal(ehThrottleEsgotado(comum), false);
  assert.equal(deveAdiarPorThrottle(comum, nascidaHa(60_000), AGORA), false);
});

test("um Error qualquer com a MENSAGEM de 429 não basta — o que vale é a classe", () => {
  // Só o `postCreateTask` sabe que esgotou a régua de retentativas. Um 429
  // solto (1ª tentativa, vindo de outro caminho) deve seguir o fluxo normal.
  const impostor = new Error("Kie 429: call frequency is too high");
  assert.equal(ehThrottleEsgotado(impostor), false);
  assert.equal(deveAdiarPorThrottle(impostor, nascidaHa(60_000), AGORA), false);
});

test("não-erros não quebram a checagem", () => {
  assert.equal(ehThrottleEsgotado(null), false);
  assert.equal(ehThrottleEsgotado(undefined), false);
  assert.equal(ehThrottleEsgotado("KieRateLimitError"), false);
  assert.equal(ehThrottleEsgotado({ name: "KieRateLimitError" }), false);
  assert.equal(deveAdiarPorThrottle("boom", nascidaHa(1000), AGORA), false);
});

test("OS DOIS LADOS DA JANELA DE 30 MIN", () => {
  const erro = new KieRateLimitError("Kie 429");

  // Dentro: adia, a cena sobrevive pro próximo tick.
  assert.equal(deveAdiarPorThrottle(erro, nascidaHa(0), AGORA), true);
  assert.equal(deveAdiarPorThrottle(erro, nascidaHa(29 * 60_000), AGORA), true);
  assert.equal(deveAdiarPorThrottle(erro, nascidaHa(JANELA_ESPERA_THROTTLE_MS - 1), AGORA), true);

  // No limite exato e além: volta o comportamento de hoje (failScene+estorno),
  // pra não criar cena presa pra sempre.
  assert.equal(deveAdiarPorThrottle(erro, nascidaHa(JANELA_ESPERA_THROTTLE_MS), AGORA), false);
  assert.equal(deveAdiarPorThrottle(erro, nascidaHa(31 * 60_000), AGORA), false);
  assert.equal(deveAdiarPorThrottle(erro, nascidaHa(14 * 24 * 3600_000), AGORA), false);
});

test("created_at ausente ou ilegível cai no lado seguro (falha + estorna)", () => {
  const erro = new KieRateLimitError("Kie 429");
  // Sem idade confiável não dá pra garantir que a cena um dia sai do limbo —
  // então devolve o crédito em vez de arriscar cena zumbi.
  assert.equal(deveAdiarPorThrottle(erro, null, AGORA), false);
  assert.equal(deveAdiarPorThrottle(erro, undefined, AGORA), false);
  assert.equal(deveAdiarPorThrottle(erro, "", AGORA), false);
  assert.equal(deveAdiarPorThrottle(erro, "ontem de tarde", AGORA), false);
});

test("relógio adiantado (cena 'do futuro') adia em vez de destruir a cena", () => {
  const erro = new KieRateLimitError("Kie 429");
  assert.equal(deveAdiarPorThrottle(erro, nascidaHa(-5 * 60_000), AGORA), true);
});

test("a janela é de 30 minutos", () => {
  assert.equal(JANELA_ESPERA_THROTTLE_MS, 30 * 60 * 1000);
});
