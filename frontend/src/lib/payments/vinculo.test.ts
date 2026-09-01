/**
 * Testes de `donoDoEntitlement` — incidente #222. Rodar (Node ≥ 22.18,
 * type-stripping nativo):
 *   node --test src/lib/payments/vinculo.test.ts
 *
 * OS CASOS SÃO REAIS, medidos no banco em 01/09/2026:
 *   - Nássara Mesquita: compra `4C8EVSH4` no e-mail `nassarab@hotmail.com`
 *     (sem perfil), conta em `nassaramesquita@gmail.com`. Pagou R$97 em 24/08
 *     por uma janela até 24/09 e estava SEM ACESSO, com 95.590 créditos
 *     parados, porque a linha ficou órfã.
 *   - Jackson Alves: `6VHWPHB9` em `jkakorio@hotmail.com` (sem perfil), conta
 *     em `jkakoalves@gmail.com`.
 * Em ambas, o lookup por e-mail devolve NULL. Antes do conserto, o upsert
 * gravava esse NULL por cima do dono — inclusive por cima de um vínculo feito
 * a mão para consertar o caso. É esse apodrecimento silencioso que o terceiro
 * teste abaixo trava.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { donoDoEntitlement } from "./vinculo.ts";

const NASSARA = "af1fcbce-d0ed-4bc8-89f6-8d56564d12b6";
const OUTRO = "6eeb3c36-0000-4000-8000-000000000000";

test("e-mail da compra tem perfil: ele é o dono (comportamento de sempre)", () => {
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

test("titularidade muda quando o e-mail da compra passa a ter conta", () => {
  // Não é regressão: se o e-mail da compra existe como perfil, ele ganha.
  // Sem isto, o conserto viraria uma trava que impede corrigir o dono errado.
  assert.equal(donoDoEntitlement(OUTRO, NASSARA), OUTRO);
});

test("string vazia do lookup é tratada como ausência, não como dono", () => {
  // findUserIdByEmail devolve `data?.id ?? null`, mas um id vazio vindo de
  // uma linha corrompida não pode desligar o dono real.
  assert.equal(donoDoEntitlement("", NASSARA), NASSARA);
});
