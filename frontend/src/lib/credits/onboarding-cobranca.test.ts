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
  assert.equal(deveEstornarTreino({ bypass: false, pendente: 0 }), false);
});

test("com débito no extrato, o aluno recebe de volta o que pagou", () => {
  assert.equal(deveEstornarTreino({ bypass: false, pendente: 10_000 }), true);
});

test("equipe não recebe estorno nem se existir linha antiga (2ª trava)", () => {
  assert.equal(deveEstornarTreino({ bypass: true, pendente: 10_000 }), false);
  assert.equal(deveEstornarTreino({ bypass: true, pendente: 0 }), false);
});

// ── REGRESSÃO #469: A SEGUNDA FALHA DA MESMA VOZ ──────────────────────────

test("REGRESSÃO #469: 2ª falha da mesma voz NÃO estorna de novo", () => {
  // O caso medido em produção (voz 600173a6, 18/09): 1 débito de 10.000 e
  // DOIS estornos de 10.000, porque a guarda perguntava se EXISTIA débito —
  // e existência não se gasta. Depois do 1º estorno o pendente é 0, e é isso
  // que a 2ª falha tem que enxergar.
  const cobrado = 10_000;
  const jaDevolvido = 10_000; // o estorno da 1ª falha
  const pendente = Math.max(0, cobrado - jaDevolvido);

  assert.equal(pendente, 0);
  assert.equal(
    deveEstornarTreino({ bypass: false, pendente }),
    false,
    "2ª falha estornou de novo — o #469 voltou",
  );
});

test("REGRESSÃO #469: a 1ª falha continua estornando (o fix não pode calar o estorno legítimo)", () => {
  // Contraprova: se o conserto do #469 fizesse o pendente nascer 0, ninguém
  // mais receberia de volta e o defeito teria só trocado de lado — caro e
  // silencioso, porque ninguém reclama de crédito que sobra.
  const pendente = Math.max(0, 10_000 - 0);
  assert.equal(pendente, 10_000);
  assert.equal(deveEstornarTreino({ bypass: false, pendente }), true);
});

test("estorno parcial já feito deixa estornar só o que falta", () => {
  const pendente = Math.max(0, 10_000 - 4_000);
  assert.equal(pendente, 6_000);
  assert.equal(deveEstornarTreino({ bypass: false, pendente }), true);
  // E o chamador devolve `Math.min(custo, pendente)` = 6.000, nunca 10.000.
  assert.equal(Math.min(10_000, pendente), 6_000);
});

// ── A SIMETRIA, ESCRITA COMO INVARIANTE ───────────────────────────────────

test("INVARIANTE: só se estorna o que se cobrou — as 4 combinações fecham", () => {
  // `pendente` é o efeito de `deveCobrarOnboarding` no fluxo real: cobrou →
  // existe saldo a devolver; não cobrou → saldo 0. Este teste amarra os dois
  // lados para que ninguém mexa em um sem mexer no outro.
  for (const origem of ["planilha", "sgp"] as const) {
    for (const bypass of [false, true]) {
      const cobrou = deveCobrarOnboarding({ origem, bypass });
      const estorna = deveEstornarTreino({ bypass, pendente: cobrou ? 10_000 : 0 });
      assert.equal(
        estorna,
        cobrou,
        `origem=${origem} bypass=${bypass}: cobrou=${cobrou} mas estorna=${estorna}`,
      );
    }
  }
});
