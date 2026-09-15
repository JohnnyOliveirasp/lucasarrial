/**
 * Testes do prazo de trial por produto (regra do dono, weekly 14/09).
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/trial-prazo.test.ts
 *
 * Os seis casos pedidos no cartão estão aqui, mais dois que o cartão não pediu
 * e que são as armadilhas reais desta regra:
 *   - ESTENDER NÃO PODE ENCURTAR (comprar FCI durante trial de SGP);
 *   - estender mede do INÍCIO, não do "agora" (medir do agora vira soma
 *     disfarçada, que é justamente o que a regra proíbe).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prazoDoProduto,
  prazoDoTrial,
  fimDoTrial,
  decidirTrial,
  TRIAL_DIAS_POR_PRODUTO,
  TRIAL_DIAS_PRODUTO_DESCONHECIDO,
  TRIAL_PRODUTOS_PENDENTES,
  type EstadoTrial,
} from "./trial-prazo.ts";
import { PRODUTOS_DE_CURSO_PADRAO } from "./acesso-regra.ts";

const FCI = "7283335"; // Fábrica de Conteúdo Invisível — 7 dias
const SGP = "7283229"; // Sistema de Geração Pronto    — 30 dias

// ── 1. um produto -> o prazo dele ────────────────────────────────────────────
test("um produto: recebe o prazo dele", () => {
  assert.equal(prazoDoTrial([FCI]).dias, 7);
  assert.equal(prazoDoTrial([SGP]).dias, 30);
});

// ── 2. dois produtos -> o MAIOR, nunca a soma ────────────────────────────────
test("dois produtos: o MAIOR, não a soma", () => {
  const r = prazoDoTrial([FCI, SGP]);
  assert.equal(r.dias, 30, "7 + 30 = 37 seria a soma; a regra é o máximo");
  assert.notEqual(r.dias, 37);
});

test("a ordem de compra não muda o resultado", () => {
  assert.equal(prazoDoTrial([SGP, FCI]).dias, prazoDoTrial([FCI, SGP]).dias);
});

// ── 3. já em trial -> ESTENDE a data-fim ─────────────────────────────────────
test("já em trial: comprar o produto maior ESTENDE a data-fim", () => {
  const estado: EstadoTrial = {
    tipo: "em_trial",
    inicio: "2026-09-01T00:00:00.000Z",
    fim: "2026-09-08T00:00:00.000Z", // 7 dias de FCI
    dias: 7,
  };
  const d = decidirTrial(estado, [FCI, SGP], "2026-09-05T00:00:00.000Z", "tx-2");
  assert.equal(d.acao, "estender");
  if (d.acao !== "estender") return;
  assert.equal(d.dias, 30);
  assert.equal(d.de, "2026-09-08T00:00:00.000Z");
  // 30 dias contados do INÍCIO (01/09), não do agora (05/09):
  assert.equal(d.para, "2026-10-01T00:00:00.000Z");
});

test("estender mede do INÍCIO — medir do 'agora' seria soma disfarçada", () => {
  const estado: EstadoTrial = {
    tipo: "em_trial",
    inicio: "2026-09-01T00:00:00.000Z",
    fim: "2026-09-08T00:00:00.000Z",
    dias: 7,
  };
  // compra no dia 29 do trial: medir do agora daria 29/09 + 30 = 29/10.
  const d = decidirTrial(estado, [FCI, SGP], "2026-09-29T00:00:00.000Z", "tx-3");
  assert.equal(d.acao, "estender");
  if (d.acao !== "estender") return;
  assert.equal(d.para, "2026-10-01T00:00:00.000Z");
  assert.notEqual(d.para, "2026-10-29T00:00:00.000Z");
});

// ── ARMADILHA: estender NUNCA encurta ────────────────────────────────────────
test("comprar o produto MENOR durante um trial maior não encurta nada", () => {
  const estado: EstadoTrial = {
    tipo: "em_trial",
    inicio: "2026-09-01T00:00:00.000Z",
    fim: "2026-10-01T00:00:00.000Z", // 30 dias de SGP
    dias: 30,
  };
  const d = decidirTrial(estado, [SGP, FCI], "2026-09-05T00:00:00.000Z", "tx-4");
  assert.equal(d.acao, "nada");
  if (d.acao !== "nada") return;
  assert.equal(d.motivo, "prazo_nao_aumenta");
});

// ── 4. já pagante -> inalterado ──────────────────────────────────────────────
test("já pagante: NÃO MUDA NADA", () => {
  const d = decidirTrial({ tipo: "pagante" }, [SGP], "2026-09-05T00:00:00.000Z", "tx-5");
  assert.equal(d.acao, "nada");
  if (d.acao !== "nada") return;
  assert.equal(d.motivo, "pagante");
});

test("pagante não vira trial por reprocessamento de webhook antigo", () => {
  // o produto de 90 dias (o mais goloso) não abre exceção pra trava do dinheiro
  const d = decidirTrial({ tipo: "pagante" }, ["codigo-novo-qualquer"], "2026-09-05T00:00:00.000Z", "tx-6");
  assert.equal(d.acao, "nada");
});

// ── 5. webhook repetido -> idempotente ───────────────────────────────────────
test("webhook reentregue: a MESMA transação não estica o trial duas vezes", () => {
  const estado: EstadoTrial = {
    tipo: "em_trial",
    inicio: "2026-09-01T00:00:00.000Z",
    fim: "2026-09-08T00:00:00.000Z",
    dias: 7,
  };
  const primeira = decidirTrial(estado, [FCI, SGP], "2026-09-05T00:00:00.000Z", "tx-7");
  assert.equal(primeira.acao, "estender");

  // segunda entrega do MESMO evento, já registrado:
  const segunda = decidirTrial(estado, [FCI, SGP], "2026-09-05T00:00:00.000Z", "tx-7", new Set(["tx-7"]));
  assert.equal(segunda.acao, "nada");
  if (segunda.acao !== "nada") return;
  assert.equal(segunda.motivo, "ja_aplicado");
});

test("idempotência é checada ANTES de tudo, inclusive antes do pagante", () => {
  const d = decidirTrial({ tipo: "pagante" }, [SGP], "2026-09-05T00:00:00.000Z", "tx-8", new Set(["tx-8"]));
  assert.equal(d.acao, "nada");
  if (d.acao !== "nada") return;
  assert.equal(d.motivo, "ja_aplicado");
});

test("criar trial duas vezes com o mesmo evento não recria", () => {
  const novo = decidirTrial({ tipo: "sem_trial" }, [SGP], "2026-09-01T00:00:00.000Z", "tx-9");
  assert.equal(novo.acao, "criar");
  if (novo.acao !== "criar") return;
  assert.equal(novo.fim, "2026-10-01T00:00:00.000Z");

  const repetido = decidirTrial({ tipo: "sem_trial" }, [SGP], "2026-09-01T00:00:00.000Z", "tx-9", new Set(["tx-9"]));
  assert.equal(repetido.acao, "nada");
});

// ── 6. produto desconhecido -> padrão explícito + log ────────────────────────
test("produto desconhecido: cai no padrão e SE DECLARA pra ser logado", () => {
  const p = prazoDoProduto("9999999");
  assert.equal(p.conhecido, false);
  assert.equal(p.dias, TRIAL_DIAS_PRODUTO_DESCONHECIDO);

  const r = prazoDoTrial(["9999999"]);
  assert.deepEqual(r.desconhecidos, ["9999999"]);
});

test("o padrão do desconhecido é o MENOR prazo da tabela, não o maior", () => {
  const menor = Math.min(...Object.values(TRIAL_DIAS_POR_PRODUTO));
  assert.equal(
    TRIAL_DIAS_PRODUTO_DESCONHECIDO,
    menor,
    "errar pra menos se conserta com 'estende'; errar pra mais dá o produto de graça",
  );
});

test("desconhecido não contamina o prazo de quem tem produto conhecido maior", () => {
  const r = prazoDoTrial([SGP, "9999999"]);
  assert.equal(r.dias, 30);
  assert.deepEqual(r.desconhecidos, ["9999999"]);
});

test("nulo/vazio é tratado como desconhecido, não explode", () => {
  assert.equal(prazoDoProduto(null).conhecido, false);
  assert.equal(prazoDoProduto("").conhecido, false);
  assert.equal(prazoDoProduto("  ").conhecido, false);
});

// ── coerência com o resto da casa ────────────────────────────────────────────
test("os códigos da tabela de prazo são os MESMOS produtos de curso já conhecidos", () => {
  // se alguém inventar um código aqui, este teste morre.
  for (const code of Object.keys(TRIAL_DIAS_POR_PRODUTO)) {
    assert.ok(
      (PRODUTOS_DE_CURSO_PADRAO as readonly string[]).includes(code),
      `${code} não é um produto de curso conhecido do repo — código inventado?`,
    );
  }
});

test("CPL e AI Content seguem PENDENTES de código — nada inventado", () => {
  const nomes = TRIAL_PRODUTOS_PENDENTES.map((p) => p.nome);
  assert.deepEqual(nomes, ["CPL", "AI Content"]);
  // os prazos já estão decididos; o que falta é só o product_code do Edu.
  assert.equal(TRIAL_PRODUTOS_PENDENTES.find((p) => p.nome === "CPL")?.dias, 30);
  assert.equal(TRIAL_PRODUTOS_PENDENTES.find((p) => p.nome === "AI Content")?.dias, 90);
  // e nenhum deles pode ter vazado pra tabela viva com código chutado:
  assert.equal(Object.keys(TRIAL_DIAS_POR_PRODUTO).length, 2);
});

test("fimDoTrial rejeita entrada inválida em vez de gravar data zoada", () => {
  assert.throws(() => fimDoTrial("nao-e-data", 7));
  assert.throws(() => fimDoTrial("2026-09-01T00:00:00.000Z", 0));
});
