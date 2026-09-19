/**
 * Testes de `donoDoEntitlement` — incidentes #222 e #314. Rodar (Node ≥ 22.18,
 * type-stripping nativo):
 *   node --test src/lib/payments/vinculo.test.ts
 *
 * OS CASOS SÃO REAIS, medidos no banco.
 *
 * #222 (01/09/2026) — lookup VAZIO apagava o dono:
 *   - Nássara Mesquita: compra `4C8EVSH4` no e-mail `nassarab@hotmail.com`
 *     (sem perfil), conta em `nassaramesquita@gmail.com`. Pagou R$97 em 24/08
 *     por uma janela até 24/09 e estava SEM ACESSO, com 95.590 créditos
 *     parados, porque a linha ficou órfã.
 *   - Jackson Alves: `6VHWPHB9` em `jkakorio@hotmail.com` (sem perfil), conta
 *     em `jkakoalves@gmail.com`.
 *
 * #314 (aberto 08/09, consumado 16/09) — lookup CHEIO trocava o dono:
 *   - Jesus Peres: compra `A1ZH3SEI` no e-mail `iehudaperes@grupoperes.com.br`,
 *     conta de uso `diretoria@grupoperes.com.br` (347eccc3, ~88.000 créditos
 *     gastos em agosto). Depois que ele criou — a pedido de uma carta NOSSA de
 *     01/09 — a conta do e-mail da compra (4656e845, nunca logada), cada evento
 *     da Hotmart transferia a titularidade para a conta vazia: PURCHASE_APPROVED
 *     em 08/09 18:16:21Z (levando junto os 100.000 créditos do ciclo) e, depois
 *     do reparo manual, PURCHASE_COMPLETE em 16/09 11:18:07Z.
 *
 * Os dois incidentes são a MESMA pergunta — "o e-mail da compra pode desligar
 * esta compra de quem já está ligado a ela?" — e desde 19/09 a resposta é NÃO
 * nos dois casos. O quarto teste abaixo é o que MUDOU DE LADO: ele exigia a
 * transferência e agora exige a preservação. A troca não sumiu, virou sinal:
 * `titularidadeDivergente`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { donoDoEntitlement, titularidadeDivergente } from "./vinculo.ts";

const NASSARA = "af1fcbce-d0ed-4bc8-89f6-8d56564d12b6";
const OUTRO = "6eeb3c36-0000-4000-8000-000000000000";
// #314, ids reais: a conta que o Jesus USA e a que ele nunca abriu.
const JESUS_USA = "347eccc3-6bdd-4c23-9522-f99c26a918c5";
const JESUS_FANTASMA = "4656e845-5831-4a05-9c4b-aa62e61b6fc7";

test("linha órfã: o e-mail da compra ADICIONA o dono", () => {
  assert.equal(donoDoEntitlement(NASSARA, null), NASSARA);
});

test("compra órfã que continua órfã: segue NULL", () => {
  assert.equal(donoDoEntitlement(null, null), null);
});

test("REGRESSÃO #222: lookup vazio NÃO apaga o dono já gravado", () => {
  // Este é o caso da Nássara: renovação chega, `findUserIdByEmail` não acha
  // perfil para nassarab@hotmail.com, e o dono NÃO pode virar NULL.
  assert.equal(donoDoEntitlement(null, NASSARA), NASSARA);
});

test("REGRESSÃO #314: e-mail COM conta NÃO troca o dono já gravado", () => {
  // Este teste TROCOU DE LADO em 19/09. Até então ele exigia o contrário
  // ("titularidade muda quando o e-mail da compra passa a ter conta") e era a
  // linha que carimbava o defeito como comportamento desejado.
  //
  // O evento de 16/09 11:18:07Z fez exatamente esta chamada, com estes dois
  // ids, e o resultado foi a conta fantasma. Agora tem que ser a de uso.
  assert.equal(donoDoEntitlement(JESUS_FANTASMA, JESUS_USA), JESUS_USA);
  assert.equal(donoDoEntitlement(OUTRO, NASSARA), NASSARA);
});

test("string vazia do lookup é tratada como ausência, não como dono", () => {
  // findUserIdByEmail devolve `data?.id ?? null`, mas um id vazio vindo de
  // uma linha corrompida não pode desligar o dono real.
  assert.equal(donoDoEntitlement("", NASSARA), NASSARA);
});

test("string vazia no dono gravado não vira dono: o e-mail ainda adiciona", () => {
  // O espelho do teste acima, do outro lado do argumento — senão uma linha
  // corrompida viraria uma compra permanentemente insalvável.
  assert.equal(donoDoEntitlement(NASSARA, ""), NASSARA);
});

// ── titularidadeDivergente: a troca recusada não pode sumir em silêncio ──

test("divergência: e-mail aponta para conta diferente da dona -> true", () => {
  assert.equal(titularidadeDivergente(JESUS_FANTASMA, JESUS_USA), true);
});

test("mesmo dono nos dois lados não é divergência", () => {
  assert.equal(titularidadeDivergente(JESUS_USA, JESUS_USA), false);
});

test("sem dono de um dos lados não é divergência (é só ausência)", () => {
  // Linha órfã recebendo dono é o fluxo normal do #222 — não pode gerar ruído
  // de auditoria, senão o sinal vira barulho e ninguém olha.
  assert.equal(titularidadeDivergente(NASSARA, null), false);
  assert.equal(titularidadeDivergente(null, NASSARA), false);
  assert.equal(titularidadeDivergente(null, null), false);
  assert.equal(titularidadeDivergente("", NASSARA), false);
});
