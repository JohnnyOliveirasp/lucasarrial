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
import { deveCobrarOnboarding, valorDoEstornoDeTreino } from "./onboarding-cobranca.ts";

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

/** Custo de UMA tentativa de treino (o teto de cada estorno). */
const TETO = 10_000;

test("REGRESSÃO 17/08: sem débito no extrato, estornar seria CONCEDER crédito", () => {
  // É o caso que o fix do SGP cria: treino entregue, nada debitado. Se o
  // estorno decidisse por `!bypassesBilling`, este cenário devolveria 10.000
  // créditos reais a um comprador que não assinou — e crédito é gastável.
  // (d) do cartão de 18/09: nenhum débito → NÃO estorna.
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: 0, teto: TETO }), 0);
});

test("com débito no extrato, o aluno recebe de volta o que pagou", () => {
  // (a) do cartão: débito sem estorno → devolve o débito inteiro.
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: -TETO, teto: TETO }), TETO);
});

test("REGRESSÃO 18/09 (voz 600173a6): débito JÁ ESTORNADO não estorna de novo", () => {
  // O bug que este arquivo passou a fechar. A voz falhou, foi estornada, e o
  // retry do fluxo de resgate falhou de novo. O débito de -10.000 CONTINUA no
  // extrato (estorno não apaga linha, acrescenta a oposta), então o critério
  // antigo — "existe débito?" — respondia `true` e pagava o MESMO débito duas
  // vezes: +10.000 criados do nada. Pelo saldo, -10.000 +10.000 = 0: nada devido.
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: 0, teto: TETO }), 0);
});

test("dois débitos e um estorno: devolve só o que ficou pendente", () => {
  // (c) do cartão. -20.000 cobrados, +10.000 já devolvidos → falta 10.000.
  const saldoPendente = -2 * TETO + TETO;
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente, teto: TETO }), TETO);
});

test("o estorno nunca passa do que ainda se deve (devolução parcial)", () => {
  // Extrato de shape inesperado (débito menor que o custo cheio): devolve o
  // pendente, não o custo de tabela. Devolver TETO aqui criaria 6.000.
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: -4_000, teto: TETO }), 4_000);
});

test("o TETO limita cada falha a UMA tentativa, mesmo com dívida maior", () => {
  // Duas tentativas cobradas e nenhuma estornada: esta falha devolve a dela.
  // Sem o teto, a primeira falha limparia as duas de uma vez.
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: -2 * TETO, teto: TETO }), TETO);
});

test("saldo positivo (já devolvido a mais) não gera novo estorno", () => {
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: TETO, teto: TETO }), 0);
});

test("equipe não recebe estorno nem se existir linha antiga (2ª trava)", () => {
  assert.equal(valorDoEstornoDeTreino({ bypass: true, saldoPendente: -TETO, teto: TETO }), 0);
  assert.equal(valorDoEstornoDeTreino({ bypass: true, saldoPendente: 0, teto: TETO }), 0);
});

test("saldo inválido (NaN de consulta quebrada) não vira estorno", () => {
  // Conservador no lixo: `NaN < 0` é falso, mas escrito explícito para que
  // ninguém troque a guarda por uma comparação solta.
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: NaN, teto: TETO }), 0);
  assert.equal(valorDoEstornoDeTreino({ bypass: false, saldoPendente: -TETO, teto: NaN }), 0);
});

// ── A SIMETRIA, ESCRITA COMO INVARIANTE ───────────────────────────────────

test("INVARIANTE: só se estorna o que se cobrou — as 4 combinações fecham", () => {
  // O saldo pendente é o efeito de `deveCobrarOnboarding` no fluxo real:
  // cobrou → o ref deve TETO; não cobrou → não deve nada. Este teste amarra os
  // dois lados para que ninguém mexa em um sem mexer no outro.
  for (const origem of ["planilha", "sgp"] as const) {
    for (const bypass of [false, true]) {
      const cobrou = deveCobrarOnboarding({ origem, bypass });
      const estornado = valorDoEstornoDeTreino({
        bypass,
        saldoPendente: cobrou ? -TETO : 0,
        teto: TETO,
      });
      assert.equal(
        estornado,
        cobrou ? TETO : 0,
        `origem=${origem} bypass=${bypass}: cobrou=${cobrou} mas estornou=${estornado}`,
      );
    }
  }
});

test("INVARIANTE: estornar nunca CRIA saldo positivo (dinheiro do nada)", () => {
  // A trava que faltava, escrita como propriedade: para qualquer extrato, o
  // saldo DEPOIS do estorno não pode ter subido acima de zero. O critério
  // antigo ("existe débito" → devolve TETO) reprova aqui no caso já estornado.
  //
  // O teto é `max(0, saldo)` e não `0` porque um ref que JÁ chega positivo é
  // anomalia anterior a esta função (é o caso do Heitor, 18/09, medido antes
  // deste conserto). Ela não tem como desfazer isso — o que ela tem que
  // garantir é não PIORAR: sobre saldo positivo, devolve 0.
  for (const saldoPendente of [0, -1, -4_000, -TETO, -TETO - 1, -2 * TETO, TETO]) {
    const estornado = valorDoEstornoDeTreino({ bypass: false, saldoPendente, teto: TETO });
    const depois = saldoPendente + estornado;
    assert.ok(
      depois <= Math.max(0, saldoPendente),
      `saldo ${saldoPendente} + estorno ${estornado} = ${depois}: crédito criado do nada`,
    );
    assert.ok(estornado >= 0, `estorno negativo (${estornado}) viraria cobrança disfarçada`);
  }
});
