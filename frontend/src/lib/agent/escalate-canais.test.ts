/**
 * `node --test src/lib/agent/escalate-canais.test.ts`
 *
 * O que estes testes protegem: o aviso de escalação no grupo de WhatsApp do
 * time nasce DESLIGADO (decisão do Lucas, 04/09) e só volta com um valor
 * explícito. Um dia alguém vai renomear a env ou inverter o default sem
 * perceber — é aqui que isso quebra.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENV_AVISO_ZAP_ESCALACAO,
  avisoZapDeEscalacaoLigado,
  destinosDoAvisoZap,
} from "./escalate-canais.ts";

const GRUPOS = ["120363428193217427@g.us"];

test("padrão (env ausente) é DESLIGADO — nenhum destino", () => {
  assert.equal(avisoZapDeEscalacaoLigado({}), false);
  assert.deepEqual(destinosDoAvisoZap(GRUPOS, {}), []);
});

test("env vazia, espaço em branco ou lixo NÃO liga", () => {
  for (const valor of ["", "   ", "0", "false", "off", "nao", "talvez", "sim, por favor"]) {
    assert.equal(avisoZapDeEscalacaoLigado({ [ENV_AVISO_ZAP_ESCALACAO]: valor }), false, `valor: ${JSON.stringify(valor)}`);
    assert.deepEqual(destinosDoAvisoZap(GRUPOS, { [ENV_AVISO_ZAP_ESCALACAO]: valor }), []);
  }
});

test("só um valor explícito liga de volta, e aí os destinos voltam inteiros", () => {
  for (const valor of ["1", "true", "TRUE", "on", "sim", " true "]) {
    assert.equal(avisoZapDeEscalacaoLigado({ [ENV_AVISO_ZAP_ESCALACAO]: valor }), true, `valor: ${JSON.stringify(valor)}`);
    assert.deepEqual(destinosDoAvisoZap(GRUPOS, { [ENV_AVISO_ZAP_ESCALACAO]: valor }), GRUPOS);
  }
});

test("ligado NÃO inventa destino: devolve exatamente a lista que recebeu", () => {
  const env = { [ENV_AVISO_ZAP_ESCALACAO]: "1" };
  assert.deepEqual(destinosDoAvisoZap([], env), []);
  const varios = ["a@g.us", "b@g.us"];
  assert.deepEqual(destinosDoAvisoZap(varios, env), varios);
});

test("o nome da env é o combinado (renomear sem querer quebra aqui)", () => {
  assert.equal(ENV_AVISO_ZAP_ESCALACAO, "AGENT_ESCALATION_WHATSAPP");
});
