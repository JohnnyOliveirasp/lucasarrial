/**
 * `node --test src/lib/credits/onboarding-cobranca.test.ts`
 *
 * O que estes testes protegem: as DUAS pontas de um par que precisa fechar.
 * Débito e estorno do treino de voz são simétricos — se um lado muda sozinho,
 * ou a casa cobra o que não devia, ou a casa concede crédito que nunca saiu.
 * Já aconteceu nas duas direções:
 *  - 17/08: treino era por conta da casa e o estorno devolvia 10k nunca cobrados.
 *  - 09/09: SGP debitava 10.525 de quem não tem crédito → 12 perfis a -10.525.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deveCobrarOnboarding, deveEstornarTreino } from "./onboarding-cobranca.ts";

// ── DÉBITO ────────────────────────────────────────────────────────────────

test("SGP não cobra o comprador: é o defeito de 09/09 (12 perfis a -10.525)", () => {
  assert.equal(deveCobrarOnboarding({ origem: "sgp", bypass: false }), false);
});

test("planilha continua cobrando: é o desenho da mig 88, não pode mudar junto", () => {
  assert.equal(deveCobrarOnboarding({ origem: "planilha", bypass: false }), true);
});

test("equipe/admin nunca paga, venha de onde vier", () => {
  assert.equal(deveCobrarOnboarding({ origem: "planilha", bypass: true }), false);
  assert.equal(deveCobrarOnboarding({ origem: "sgp", bypass: true }), false);
});

// ── ESTORNO ───────────────────────────────────────────────────────────────

test("REGRESSÃO 17/08: sem débito no extrato, estornar seria CONCEDER crédito", () => {
  // É o caso que o fix do SGP cria: treino entregue, nada debitado. Se o
  // estorno decidisse por `!bypassesBilling`, este cenário devolveria 10.000
  // créditos reais a um comprador que não assinou — e crédito é gastável.
  assert.equal(deveEstornarTreino({ bypass: false, temDebito: false }), false);
});

test("com débito no extrato, o aluno recebe de volta o que pagou", () => {
  assert.equal(deveEstornarTreino({ bypass: false, temDebito: true }), true);
});

test("equipe não recebe estorno nem se existir linha antiga (2ª trava)", () => {
  assert.equal(deveEstornarTreino({ bypass: true, temDebito: true }), false);
  assert.equal(deveEstornarTreino({ bypass: true, temDebito: false }), false);
});

// ── A SIMETRIA, ESCRITA COMO INVARIANTE ───────────────────────────────────

test("INVARIANTE: só se estorna o que se cobrou — as 4 combinações fecham", () => {
  // `temDebito` é o efeito de `deveCobrarOnboarding` no fluxo real: cobrou →
  // existe linha; não cobrou → não existe. Este teste amarra os dois lados
  // para que ninguém mexa em um sem mexer no outro.
  for (const origem of ["planilha", "sgp"] as const) {
    for (const bypass of [false, true]) {
      const cobrou = deveCobrarOnboarding({ origem, bypass });
      const estorna = deveEstornarTreino({ bypass, temDebito: cobrou });
      assert.equal(
        estorna,
        cobrou,
        `origem=${origem} bypass=${bypass}: cobrou=${cobrou} mas estorna=${estorna}`,
      );
    }
  }
});
