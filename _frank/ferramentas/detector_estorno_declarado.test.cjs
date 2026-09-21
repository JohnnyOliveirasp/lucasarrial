/**
 * Testes do detector_estorno_declarado. Sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/detector_estorno_declarado.test.cjs
 *
 * O gabarito são os casos REAIS já medidos no #517 (21/09):
 *   Hugo #311 (ledger vazio), Alice #371 (estorno casado no ref 4100fc07),
 *   Katia #473 e Turbo #224 (estorno declarado que não existia — o Turbo com
 *   ledger sem UMA linha positiva; a Katia com estorno em OUTRO ref_id).
 * Inclui o teste de MUTAÇÃO: casar por ALUNO (em vez de por ref_id) tem que
 * REPROVAR no caso Katia — teste que passa nos dois lados não prova nada.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  acharFrases,
  casarDebitos,
  avaliarCarta,
  parsearEnviados,
} = require("./detector_estorno_declarado.cjs");
const { ehEstorno } = require("./_estornos.cjs");

const DATA_CARTA = new Date("2026-09-17T08:50:00Z"); // a carta da Katia, uid 2606
const tx = (over) => ({
  id: over.id ?? "t-" + Math.abs(over.amount ?? 0) + "-" + (over.ref_id ?? "x"),
  user_id: "u1",
  kind: "usage",
  amount: 0,
  ref_type: null,
  ref_id: null,
  created_at: "2026-09-16T15:08:00Z", // dentro da janela de 30d antes da carta
  ...over,
});

/* ── frases: afirmação no passado x promessa x discussão ── */

test("frase REAL da Katia (uid 2606): 'já voltaram automaticamente' é afirmação", () => {
  const r = acharFrases("Os 400 créditos que foram cobrados já voltaram automaticamente pra sua conta.");
  assert.equal(r.afirmacoes.length >= 1, true);
  assert.equal(r.promessas.length, 0);
});

test("frase REAL do Turbo (uid 443): 'e que já foi estornado' é afirmação", () => {
  const r = acharFrases("Isso aconteceu no Turbo (o que você reportou, e que já foi estornado).");
  assert.equal(r.afirmacoes.length >= 1, true);
});

test("nota do #224: 'JA foram estornados' (maiúsculo, sem acento) é afirmação", () => {
  const r = acharFrases("os 5.680 cr JA foram estornados, entao nao ha pendencia financeira");
  assert.equal(r.afirmacoes.length >= 1, true);
});

test("CONTROLE NEGATIVO: carta que só DISCUTE estorno não vira afirmação", () => {
  const r = acharFrases(
    "Sobre o estorno: quando ele é aprovado pela Hotmart, o valor aparece na sua fatura em até 10 dias úteis. Você mesmo pede na Área do Comprador.",
  );
  assert.deepEqual(r.afirmacoes, []);
});

test("promessa futura NÃO conta como afirmação e sai na lista separada", () => {
  const r = acharFrases("Vou estornar os créditos ainda hoje e te aviso quando cair.");
  assert.deepEqual(r.afirmacoes, []);
  assert.equal(r.promessas.length >= 1, true);
});

/* ── casamento por ref_id ── */

test("CONTROLE NEGATIVO (Hugo #311): ledger VAZIO não acusa e não quebra", () => {
  const v = avaliarCarta({ temAfirmacao: true, alunoIdentificado: true, txs: [], dataCarta: DATA_CARTA });
  assert.equal(v.acusa, false);
  assert.equal(v.veredito, "SEM_DEBITO_NA_JANELA");
});

test("CONTROLE NEGATIVO (Alice #371): -525 com image_refund_gate371 +525 no MESMO ref_id não acusa", () => {
  // Medido em 21/09: ref_id 4100fc07 → image_generation -525 + image_refund_gate371 +525 = 0.
  const txs = [
    tx({ amount: -525, ref_type: "image_generation", ref_id: "4100fc07" }),
    tx({ amount: 525, ref_type: "image_refund_gate371", ref_id: "4100fc07", kind: "extra_purchase" }),
  ];
  const v = avaliarCarta({ temAfirmacao: true, alunoIdentificado: true, txs, dataCarta: DATA_CARTA });
  assert.equal(v.acusa, false);
  assert.equal(v.veredito, "ESTORNO_CASADO");
  assert.equal(v.debitos[0].status, "quitado");
});

test("ARMADILHA CLÁSSICA: estorno gravado com kind='extra_purchase' É reconhecido (kind não entra na conta)", () => {
  const txs = [
    tx({ amount: -400, ref_type: "generation", ref_id: "019c58d1" }),
    tx({ amount: 400, ref_type: "generation_refund", ref_id: "019c58d1", kind: "extra_purchase" }),
  ];
  const debitos = casarDebitos(txs, DATA_CARTA, 30);
  assert.equal(debitos[0].status, "quitado");
  // demonstração do porquê: conferir por kind não acha estorno nenhum
  const porKind = txs.filter((t) => /refund|estorn/i.test(t.kind));
  assert.deepEqual(porKind, [], "controle: por kind o estorno é INVISÍVEL — é por isso que a regra proíbe");
  assert.equal(ehEstorno("generation_refund"), true);
});

test("CONTROLE POSITIVO (Turbo #224): afirma 'já foi estornado' e NENHUMA linha positiva no ref → ACUSA", () => {
  // O ledger real dele: 6 linhas, nenhuma positiva de estorno. Reduzido ao essencial:
  const txs = [
    tx({ amount: -5680, ref_type: "video_clone", ref_id: "f028733d", created_at: "2026-09-01T15:00:00Z" }),
  ];
  const v = avaliarCarta({
    temAfirmacao: true,
    alunoIdentificado: true,
    txs,
    dataCarta: new Date("2026-09-02T01:20:00Z"), // a carta, uid 443
  });
  assert.equal(v.acusa, true);
  assert.equal(v.veredito, "CANDIDATO");
  assert.equal(v.debitos[0].status, "sem_estorno");
});

test("CONTROLE POSITIVO (Katia #473): estorno existe no aluno mas em OUTRO ref_id → ACUSA", () => {
  // O caso real: -400 na geração 019c58d1 SEM estorno; o estorno de 12/09 é da
  // OUTRA geração (b6df1a7e). Foi exatamente assim que ela passou despercebida.
  const txs = [
    tx({ amount: -400, ref_type: "generation", ref_id: "019c58d1", created_at: "2026-09-16T15:08:00Z" }),
    tx({ amount: -400, ref_type: "generation", ref_id: "b6df1a7e", created_at: "2026-09-12T10:00:00Z" }),
    tx({ amount: 400, ref_type: "generation_refund", ref_id: "b6df1a7e", kind: "extra_purchase", created_at: "2026-09-12T10:05:00Z" }),
  ];
  const v = avaliarCarta({ temAfirmacao: true, alunoIdentificado: true, txs, dataCarta: DATA_CARTA });
  assert.equal(v.acusa, true, "o débito 019c58d1 está sem estorno — TEM que acusar");
  const d019 = v.debitos.find((d) => d.tx.ref_id === "019c58d1");
  const dB6d = v.debitos.find((d) => d.tx.ref_id === "b6df1a7e");
  assert.equal(d019.status, "sem_estorno");
  assert.equal(dB6d.status, "quitado", "a outra geração está quitada de verdade — só a 019c58d1 acusa");
});

test("MUTAÇÃO: casar por ALUNO (em vez de por ref_id) REPROVA no caso Katia — o teste discrimina", () => {
  // O mutante deliberadamente ERRADO: "o aluno tem algum estorno? então tá quitado".
  const casarPorAlunoMUTANTE = (txs) => {
    const temQualquerEstorno = txs.some((t) => (t.amount ?? 0) > 0 && ehEstorno(t.ref_type));
    return txs.filter((t) => (t.amount ?? 0) < 0).map((t) => ({ tx: t, status: temQualquerEstorno ? "quitado" : "sem_estorno" }));
  };
  const txs = [
    tx({ amount: -400, ref_type: "generation", ref_id: "019c58d1" }),
    tx({ amount: 400, ref_type: "generation_refund", ref_id: "b6df1a7e", kind: "extra_purchase" }),
  ];
  const mutante = casarPorAlunoMUTANTE(txs);
  const correto = casarDebitos(txs, DATA_CARTA, 30);
  // o mutante dá o veredito ERRADO (quitado) — o mesmo cego que deixou a Katia passar:
  assert.equal(mutante.find((d) => d.tx.ref_id === "019c58d1").status, "quitado", "controle: o mutante tinha mesmo que errar aqui");
  // a implementação correta discorda dele:
  assert.equal(correto.find((d) => d.tx.ref_id === "019c58d1").status, "sem_estorno");
  assert.notEqual(
    mutante.find((d) => d.tx.ref_id === "019c58d1").status,
    correto.find((d) => d.tx.ref_id === "019c58d1").status,
    "se implementação e mutante concordam, o teste não prova nada",
  );
});

/* ── vereditos de borda ── */

test("débito SEM ref_id: nunca chuta — NAO_DETERMINADO, não candidato", () => {
  const txs = [
    tx({ amount: -400, ref_type: "generation", ref_id: null }),
    tx({ amount: -525, ref_type: "image_generation", ref_id: "4100fc07" }),
    tx({ amount: 525, ref_type: "image_refund_gate371", ref_id: "4100fc07" }),
  ];
  const v = avaliarCarta({ temAfirmacao: true, alunoIdentificado: true, txs, dataCarta: DATA_CARTA });
  assert.equal(v.acusa, false);
  assert.equal(v.veredito, "NAO_DETERMINADO");
});

test("destinatário sem perfil → NAO_DETERMINADO (comprador SGP entra por outra porta)", () => {
  const v = avaliarCarta({ temAfirmacao: true, alunoIdentificado: false, txs: [], dataCarta: DATA_CARTA });
  assert.equal(v.acusa, false);
  assert.equal(v.veredito, "NAO_DETERMINADO");
});

test("débito FORA da janela não entra na conta; estorno DEPOIS da carta quita mesmo assim", () => {
  const txs = [
    tx({ amount: -999, ref_type: "generation", ref_id: "velho", created_at: "2026-06-01T00:00:00Z" }), // >30d antes
    tx({ amount: -400, ref_type: "generation", ref_id: "novo", created_at: "2026-09-16T00:00:00Z" }),
    tx({ amount: 400, ref_type: "generation_refund", ref_id: "novo", created_at: "2026-09-19T00:00:00Z" }), // após a carta
  ];
  const debitos = casarDebitos(txs, DATA_CARTA, 30);
  assert.equal(debitos.length, 1, "o débito de junho está fora da janela");
  assert.equal(debitos[0].status, "quitado", "estorno posterior à carta também quita — a carta pode ter sido honrada depois");
});

/* ── parser da saída do ler_caixa ── */

test("parsearEnviados extrai uid, data, destinatário e corpo do formato real do ler_caixa", () => {
  const saida = [
    'caixa "Sent" · critério: ALL · 42 no total, mostrando 1',
    "",
    "────────────────────────────────────────────────────────",
    "uid 2606 · Wed, 17 Sep 2026 08:50:00 +0000 · 8KB",
    "de:      suporte@fastcloner.com",
    "para:    Katia <katiasalvador32@gmail.com>",
    "assunto: Sobre os seus créditos",
    "",
    "Os 400 créditos que foram cobrados já voltaram automaticamente pra sua conta.",
    "",
  ].join("\n");
  const cartas = parsearEnviados(saida);
  assert.equal(cartas.length, 1);
  assert.equal(cartas[0].uid, 2606);
  assert.equal(cartas[0].email, "katiasalvador32@gmail.com");
  assert.ok(cartas[0].corpo.includes("já voltaram"));
  assert.equal(cartas[0].data.toISOString(), "2026-09-17T08:50:00.000Z");
});
