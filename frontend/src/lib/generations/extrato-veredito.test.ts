/**
 * Testes do veredito de dinheiro por `ref_id` (incidente 70633cab / cartão #473).
 *
 * Rodar (o alias `@/` NÃO resolve com `node --test` pelado):
 *   cd frontend && npx tsx --test src/lib/generations/extrato-veredito.test.ts
 *
 * O que está coberto:
 *   1. O CASO REAL de 17/09: `019c58d1` com um único `-400` → cobrado 400, NÃO
 *      estornado. É a frase que a casa deveria ter tido na mão.
 *   2. A ARMADILHA, e é o teste que impede o erro de 17/09 de voltar: o extrato
 *      traz DOIS ref_id, e o `+400 generation_refund` é do OUTRO (`b6df1a7e`).
 *      O veredito de `019c58d1` continua NÃO ESTORNADO.
 *   3. `kind = 'extra_purchase'` é reconhecido como estorno (a armadilha é
 *      filtrar por kind, e todo estorno da casa tem esse kind), e `kind` sozinho
 *      NUNCA cria estorno.
 *   4. Lista vazia / null / tipo errado → veredito null, nunca chute.
 *   5. DERIVA DA LISTA: as duas listas são comparadas com o `_estornos.cjs` de
 *      verdade. Somar `ref_type` lá e esquecer aqui quebra este arquivo.
 *   6. Parcial, devolução A MAIS, nunca cobrado, extrato ilegível, `ref_type`
 *      desconhecido — os casos em que calar ou arredondar custa dinheiro.
 *
 * Os ids e valores dos casos 1, 2 e 3 são o caso REAL de produção medido em
 * 19/09 (ledger da katiasalvador32@gmail.com), não fixture inventado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  extratoVeredito,
  AVISO_ESTORNO_SO_CASADO,
  REF_TYPES_ESTORNO,
  NAO_SAO_DEVOLUCAO,
  type LinhaExtrato,
} from "./extrato-veredito.ts";

/** A geração que a casa disse ter estornado e não tinha. */
const GERACAO = "019c58d1-5eb9-410f-aa0a-66b4dcc399d8";
/** A OUTRA geração da MESMA aluna — a que realmente tinha estorno de +400. */
const OUTRA = "b6df1a7e-0000-4000-8000-000000000000";

/**
 * O extrato da aluna como estava em 17/09 08:50Z, quando a carta saiu.
 *
 * Todo estorno da casa é gravado com `kind = 'extra_purchase'` (medido em 07/09:
 * 668 linhas, TODAS com esse kind) — por isso o fixture é assim, e não por
 * capricho: é o que faz a leitura por `kind` ser inútil.
 */
const EXTRATO_17_09: LinhaExtrato[] = [
  { ref_id: GERACAO, ref_type: "generation", kind: "usage", amount: -400, created_at: "2026-09-16T15:08:00Z" },
  { ref_id: OUTRA, ref_type: "generation", kind: "usage", amount: -400, created_at: "2026-09-12T10:00:00Z" },
  { ref_id: OUTRA, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "2026-09-12T11:30:00Z" },
];

// ── 1. o caso real: cobrado e não devolvido ──────────────────────────────────

test("019c58d1 com um único -400: cobrado 400, NÃO estornado", () => {
  const v = extratoVeredito(GERACAO, [EXTRATO_17_09[0]]);
  assert.ok(v, "uma linha casada tem que gerar veredito");
  assert.equal(v.cobrado, 400);
  assert.equal(v.estornado, 0);
  assert.equal(v.foiEstornado, false);
  assert.equal(v.pendente, 400);
  assert.deepEqual(v.refTypesEstorno, []);
  assert.equal(v.cobradoEm, "16/09");
  assert.equal(v.estornoEm, null);
  assert.match(v.linha, /cobrado 400 cr em 16\/09/);
  assert.match(v.linha, /NÃO FOI DEVOLVIDO/);
  assert.match(v.linha, /400 cr no negativo/);
});

test("a linha proíbe explicitamente a frase que a casa escreveu em 17/09", () => {
  // A carta dizia "já voltaram automaticamente pra sua conta". A linha tem que
  // desautorizar as DUAS metades, porque as duas foram ditas.
  const v = extratoVeredito(GERACAO, EXTRATO_17_09);
  assert.ok(v);
  assert.match(v.linha, /já voltou/);
  assert.match(v.linha, /volta automaticamente/);
});

// ── 2. A ARMADILHA — o teste que impede a repetição de 17/09 ─────────────────

test("ARMADILHA: estorno de OUTRO ref_id no mesmo extrato não estorna este", () => {
  const v = extratoVeredito(GERACAO, EXTRATO_17_09);
  assert.ok(v);
  // Há um +400 generation_refund no extrato. Ele NÃO é deste trabalho.
  assert.equal(v.estornado, 0, "o +400 é da geração b6df1a7e, não desta");
  assert.equal(v.foiEstornado, false);
  assert.equal(v.pendente, 400);
  assert.match(v.linha, /SEM ESTORNO CASADO/);
  assert.doesNotMatch(v.linha, /DEVOLVIDO 400/);
});

test("ARMADILHA, o outro lado: o veredito da OUTRA geração é estornado mesmo", () => {
  // Prova que o filtro não é "nunca reconhece estorno" — ele casa o ref_id.
  const v = extratoVeredito(OUTRA, EXTRATO_17_09);
  assert.ok(v);
  assert.equal(v.cobrado, 400);
  assert.equal(v.estornado, 400);
  assert.equal(v.foiEstornado, true);
  assert.equal(v.pendente, 0);
  assert.match(v.linha, /✅ DEVOLVIDO 400 cr em 12\/09/);
  assert.match(v.linha, /nada pendente/);
});

test("ARMADILHA: valor igual e data mais recente em outro ref_id não contaminam", () => {
  // As três leituras erradas de 17/09 ao mesmo tempo: mesmo VALOR (400), DATA
  // mais recente que o débito, e kind de estorno — tudo em outro ref_id.
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: OUTRA, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "2026-09-17T08:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 0);
  assert.match(v.linha, /NÃO FOI DEVOLVIDO/);
});

test("ARMADILHA: ref_id null/vazio em linha alheia não casa com nada", () => {
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: null, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "2026-09-18T08:00:00Z" },
    { ref_id: "", ref_type: "estorno", kind: "extra_purchase", amount: 400, created_at: "2026-09-18T09:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 0);
  assert.equal(v.foiEstornado, false);
});

// ── 3. kind: reconhecido quando é estorno, ignorado como critério ────────────

test("estorno com kind='extra_purchase' É reconhecido como estorno", () => {
  // A armadilha é filtrar por kind: quem procurasse kind='refund' não acharia
  // NENHUM estorno da casa. Quem decide é o ref_type.
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 400);
  assert.equal(v.foiEstornado, true);
  assert.equal(v.pendente, 0);
  assert.deepEqual(v.refTypesEstorno, ["generation_refund"]);
  assert.equal(v.estornoEm, "19/09");
  assert.match(v.linha, /✅ DEVOLVIDO/);
});

test("kind de estorno com ref_type que NÃO é estorno não vira estorno", () => {
  // O espelho do teste acima. `kind='extra_purchase'` é o kind de compra de
  // crédito TAMBÉM — se ele bastasse, uma compra leria como devolução.
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "payment_event", kind: "extra_purchase", amount: 400, created_at: "2026-09-18T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 0);
  assert.equal(v.foiEstornado, false);
  assert.deepEqual(v.positivosNaoDevolucao, ["payment_event"]);
  assert.match(v.linha, /NÃO FOI DEVOLVIDO/);
  assert.match(v.linha, /NÃO é devolução/);
});

test("cortesia no mesmo ref_id é dita, e dita como NÃO-estorno", () => {
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "courtesy_grant", kind: "extra_purchase", amount: 400, created_at: "2026-09-18T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 0);
  assert.match(v.linha, /courtesy_grant/);
  assert.match(v.linha, /NÃO foi contado como estorno/);
});

test("todos os ref_type de estorno da casa são reconhecidos, um por um", () => {
  for (const tipo of REF_TYPES_ESTORNO) {
    const v = extratoVeredito(GERACAO, [
      EXTRATO_17_09[0],
      { ref_id: GERACAO, ref_type: tipo, kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" },
    ]);
    assert.ok(v, tipo);
    assert.equal(v.foiEstornado, true, `${tipo} tem que contar como estorno`);
    assert.equal(v.pendente, 0, tipo);
  }
});

test("nenhum ref_type de NAO_SAO_DEVOLUCAO conta como estorno", () => {
  for (const tipo of NAO_SAO_DEVOLUCAO) {
    const v = extratoVeredito(GERACAO, [
      EXTRATO_17_09[0],
      { ref_id: GERACAO, ref_type: tipo, kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" },
    ]);
    assert.ok(v, tipo);
    assert.equal(v.foiEstornado, false, `${tipo} NÃO pode contar como estorno`);
  }
});

test("ref_type positivo desconhecido ACUSA em vez de nascer invisível", () => {
  // Critério por exclusão, igual `_estornos.cjs`: o tipo perigoso é justamente
  // o que ninguém batizou direito (#342: 2 tipos invisíveis por 11 dias).
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "ref_type_que_ninguem_cadastrou", kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 0, "não conto como estorno o que não sei que é");
  assert.deepEqual(v.refTypesDesconhecidos, ["ref_type_que_ninguem_cadastrou"]);
  assert.match(v.linha, /a lista da casa não conhece/);
  assert.match(v.linha, /Escale/);
});

// ── 4. dado ausente/torto → null, nunca chute ───────────────────────────────

const SEM_VEREDITO: Array<[string, unknown, unknown]> = [
  ["lista vazia", GERACAO, []],
  ["linhas null", GERACAO, null],
  ["linhas undefined (select não pediu a coluna)", GERACAO, undefined],
  ["linhas é objeto, não array", GERACAO, { ref_id: GERACAO, amount: -400 }],
  ["linhas é string (jsonb cru, sem parse)", GERACAO, '[{"amount":-400}]'],
  ["linhas é número", GERACAO, 7],
  ["ref_id null", null, EXTRATO_17_09],
  ["ref_id undefined (select não pediu o id)", undefined, EXTRATO_17_09],
  ["ref_id vazio", "", EXTRATO_17_09],
  ["ref_id só espaço", "   ", EXTRATO_17_09],
  ["ref_id não-string", 123, EXTRATO_17_09],
  ["extrato sem NENHUMA linha deste ref_id", "00000000-0000-0000-0000-000000000000", EXTRATO_17_09],
];

for (const [nome, ref, linhas] of SEM_VEREDITO) {
  test(`CONTROLE: ${nome} → veredito null`, () => {
    assert.equal(extratoVeredito(ref, linhas), null);
  });
}

test("CONTROLE: lixo dentro da lista não explode nem casa", () => {
  const v = extratoVeredito(GERACAO, [null, undefined, 7, "x", [], EXTRATO_17_09[0]]);
  assert.ok(v);
  assert.equal(v.cobrado, 400);
  assert.equal(v.estornado, 0);
});

test("ref_id em MAIÚSCULA casa (UUID é case-insensitive)", () => {
  // Falso negativo por caixa seria "não estornado" falso — a direção que paga
  // em dobro.
  const v = extratoVeredito(GERACAO.toUpperCase(), [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.foiEstornado, true);
});

// ── 5. DERIVA DA LISTA: o espelho é mecânico, não confiança ──────────────────

test("as duas listas são IGUAIS às de _frank/ferramentas/_estornos.cjs", () => {
  // Este é o guarda que torna o espelho legítimo. Sem ele, isto seria "lista
  // nova inventada" e envelheceria calada — o modo de falha do #185 e do #342.
  const require_ = createRequire(import.meta.url);
  const canonico = require_("../../../../_frank/ferramentas/_estornos.cjs");

  assert.deepEqual(
    [...REF_TYPES_ESTORNO].sort(),
    [...canonico.REF_TYPES_ESTORNO].sort(),
    "REF_TYPES_ESTORNO divergiu de _estornos.cjs — sincronize as duas listas",
  );
  assert.deepEqual(
    [...NAO_SAO_DEVOLUCAO].sort(),
    [...canonico.NAO_SAO_DEVOLUCAO].sort(),
    "NAO_SAO_DEVOLUCAO divergiu de _estornos.cjs — sincronize as duas listas",
  );
});

test("o veredito concorda com ehEstorno() do _estornos.cjs, tipo por tipo", () => {
  // Igualdade de LISTA não prova igualdade de COMPORTAMENTO. Este roda o
  // critério canônico contra o meu, no mesmo conjunto de tipos.
  const require_ = createRequire(import.meta.url);
  const { ehEstorno, REF_TYPES_ESTORNO: canon, NAO_SAO_DEVOLUCAO: naoCanon } = require_(
    "../../../../_frank/ferramentas/_estornos.cjs",
  );
  for (const tipo of [...canon, ...naoCanon, "tipo_inexistente", ""]) {
    const v = extratoVeredito(GERACAO, [
      EXTRATO_17_09[0],
      { ref_id: GERACAO, ref_type: tipo, kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" },
    ]);
    assert.ok(v, tipo);
    assert.equal(v.foiEstornado, ehEstorno(tipo), `divergência em "${tipo}"`);
  }
});

test("nenhum ref_type mora nas DUAS listas", () => {
  const nos_dois = REF_TYPES_ESTORNO.filter((t) => NAO_SAO_DEVOLUCAO.includes(t));
  assert.deepEqual(nos_dois, [], "tipo em ambas as listas: o critério fica ambíguo");
});

// ── 6. os casos em que calar ou arredondar custa dinheiro ────────────────────

test("devolução PARCIAL não pode ler como devolvido", () => {
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: 150, created_at: "2026-09-18T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 150);
  assert.equal(v.pendente, 250);
  assert.equal(v.foiEstornado, true);
  assert.match(v.linha, /DEVOLVIDO EM PARTE: 150 cr de 400 cr/);
  assert.match(v.linha, /faltam 250 cr/);
  assert.match(v.linha, /Não diga que voltou tudo/);
});

test("devolução A MAIS acusa dobro em vez de pedir outro estorno", () => {
  // O histórico da casa: estorno duplicado em retry já criou +10.000 créditos
  // (voz 600173a6). Aqui o sinal tem que ser "não devolva de novo".
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "2026-09-18T14:00:00Z" },
    { ref_id: GERACAO, ref_type: "estorno_de_engano", kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 800);
  assert.equal(v.pendente, -400);
  assert.match(v.linha, /devolução A MAIS de 400 cr/);
  assert.match(v.linha, /NÃO devolva de novo/);
});

test("vários débitos no mesmo ref_id (retry) somam", () => {
  const v = extratoVeredito(GERACAO, [
    { ref_id: GERACAO, ref_type: "generation", kind: "usage", amount: -400, created_at: "2026-09-16T15:08:00Z" },
    { ref_id: GERACAO, ref_type: "generation", kind: "usage", amount: -400, created_at: "2026-09-16T16:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.cobrado, 800);
  assert.equal(v.pendente, 800);
  // A data é a do PRIMEIRO débito, que é o dia que o aluno reconhece.
  assert.equal(v.cobradoEm, "16/09");
});

test("nunca cobrado é dito como nunca cobrado, não como 'não ressarcido'", () => {
  // Lição do caso Kessuly (01/09): os dois são indistinguíveis para quem só
  // olha estorno, e o segundo promete dinheiro que não é devido.
  const v = extratoVeredito(GERACAO, [
    { ref_id: GERACAO, ref_type: "courtesy_grant", kind: "extra_purchase", amount: 100, created_at: "2026-09-16T15:08:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.cobrado, 0);
  assert.equal(v.estornado, 0);
  assert.equal(v.pendente, 0);
  assert.match(v.linha, /NÃO HOUVE COBRANÇA/);
  assert.doesNotMatch(v.linha, /no negativo/);
  assert.match(v.linha, /não prometa estorno/i);
});

test("amount ilegível não some em silêncio — manda escalar", () => {
  // Descartar uma linha ilegível que era estorno produz "não devolvido" falso:
  // o falso negativo que paga em dobro.
  for (const ruim of ["400", null, undefined, Number.NaN, true, {}]) {
    const v = extratoVeredito(GERACAO, [
      EXTRATO_17_09[0],
      { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: ruim as never, created_at: "2026-09-19T14:00:00Z" },
    ]);
    assert.ok(v, String(ruim));
    assert.match(v.linha, /ilegíveis/, String(ruim));
    assert.match(v.linha, /NÃO afirme nada/, String(ruim));
    assert.doesNotMatch(v.linha, /DEVOLVIDO/, String(ruim));
  }
});

test("amount 0 é ignorado sem virar cobrança nem estorno", () => {
  const v = extratoVeredito(GERACAO, [
    EXTRATO_17_09[0],
    { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: 0, created_at: "2026-09-19T14:00:00Z" },
  ]);
  assert.ok(v);
  assert.equal(v.estornado, 0);
  assert.equal(v.foiEstornado, false);
  assert.match(v.linha, /NÃO FOI DEVOLVIDO/);
});

test("created_at ausente ou inválido não inventa data", () => {
  const v = extratoVeredito(GERACAO, [
    { ref_id: GERACAO, ref_type: "generation", kind: "usage", amount: -400, created_at: null },
    { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "nao-e-data" },
  ]);
  assert.ok(v);
  assert.equal(v.cobradoEm, null);
  assert.equal(v.estornoEm, null);
  assert.equal(v.foiEstornado, true);
  assert.match(v.linha, /cobrado 400 cr ·/, "sem data, não escreve 'em undefined'");
  assert.doesNotMatch(v.linha, /undefined|NaN|Invalid/);
});

// ── o aviso: nega as leituras erradas, uma por uma ───────────────────────────

test("o aviso nega VALOR, DATA, kind e a leitura de 'a conta tem estorno'", () => {
  const t = AVISO_ESTORNO_SO_CASADO.toLowerCase();
  assert.ok(t.includes("outro trabalho"), "nega estorno de outro trabalho da mesma conta");
  assert.ok(t.includes("valor igual"), "nega casamento por valor");
  assert.ok(t.includes("data próxima"), "nega casamento por data");
  assert.ok(t.includes("kind='extra_purchase'"), "explica por que kind não distingue");
  assert.ok(t.includes("ausência de estorno") && t.includes("sem exceção"), "ausência = não estornado");
  assert.ok(t.includes("sem linha de créditos"), "ausência da linha não é prova de nada");
});

test("nenhuma linha promete estorno nem julga o mérito do trabalho", () => {
  // O módulo descreve o ledger. "Tem direito a estorno" é decisão de produto do
  // Johnny e não pode sair daqui como se fosse medição.
  const casos: LinhaExtrato[][] = [
    [EXTRATO_17_09[0]],
    EXTRATO_17_09,
    [EXTRATO_17_09[0], { ref_id: GERACAO, ref_type: "generation_refund", kind: "extra_purchase", amount: 400, created_at: "2026-09-19T14:00:00Z" }],
  ];
  for (const linhas of casos) {
    const v = extratoVeredito(GERACAO, linhas);
    assert.ok(v);
    const t = v.linha.toLowerCase();
    for (const proibido of ["tem direito", "vamos devolver", "vou devolver", "defeituos", "com defeito", "áudio ruim", "prometa reembolso"]) {
      assert.ok(!t.includes(proibido), `linha não pode conter "${proibido}": ${v.linha}`);
    }
  }
});
