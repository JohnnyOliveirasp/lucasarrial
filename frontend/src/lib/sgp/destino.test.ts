/**
 * A régua de "onde este pedido deve estar". Os dois casos que a `PROXIMA`
 * antiga (em app/[locale]/sgp/page.tsx) errava estão travados aqui:
 *  1. `dados` não tinha destino — e-mail confirmado + status `dados` voltava
 *     pra tela 1 pra sempre (o beco sem saída do caso welrisson@, 09/09);
 *  2. pedido já enviado ia pra `/app/sgp`, que exige LOGIN.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/destino.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoDoWizard, noWizardAberto } from "./destino.ts";
import { SGP_STATUS } from "./types.ts";

test("TODO status tem destino — nenhum buraco novo passa despercebido", () => {
  for (const s of SGP_STATUS) {
    assert.match(destinoDoWizard(s), /^\/sgp\//, `status sem destino: ${s}`);
  }
});

test("`dados` NÃO fica na tela 1 (era o laço fechado)", () => {
  // Se voltar a apontar pra /sgp, a página redireciona pra si mesma.
  assert.equal(destinoDoWizard("dados"), "/sgp/foto");
  assert.notEqual(destinoDoWizard("dados"), "/sgp");
});

test("cada passo do wizard vai pra sua própria tela", () => {
  assert.equal(destinoDoWizard("foto"), "/sgp/foto");
  assert.equal(destinoDoWizard("audio"), "/sgp/audio");
  assert.equal(destinoDoWizard("revisao"), "/sgp/revisao");
});

test("pedido já enviado vai pro acompanhamento SEM login", () => {
  // /app/sgp está atrás do middleware de auth; /sgp/acompanhar roda no cookie
  // da sessão — que é justamente o que o POST /sgp/enviar já devolve.
  for (const s of ["enviado", "processando", "pronto", "falhou"] as const) {
    assert.equal(destinoDoWizard(s), "/sgp/acompanhar", s);
  }
});

test("nenhum destino aponta pra área logada", () => {
  for (const s of SGP_STATUS) {
    assert.ok(!destinoDoWizard(s).startsWith("/app/"), `${s} exige login`);
  }
});

test("noWizardAberto separa quem ainda preenche de quem já mandou", () => {
  assert.deepEqual(SGP_STATUS.filter(noWizardAberto), ["dados", "foto", "audio", "revisao"]);
});
