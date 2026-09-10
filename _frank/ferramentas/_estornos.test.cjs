/**
 * Testes da lista canonica de estorno. Sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/_estornos.test.cjs
 *
 * Cada caso aqui e uma armadilha REAL, que ja mordeu esta casa com dinheiro
 * de aluno em cima. O que se testa e a HONESTIDADE do guarda, nao a beleza da
 * lista: um guarda que da verde estando cego e pior que guarda nenhum, porque
 * a casa para de olhar.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REF_TYPES_ESTORNO,
  NAO_SAO_DEVOLUCAO,
  ehEstorno,
  classificarDesconhecidos,
} = require("./_estornos.cjs");

test("#185: studio_audio_refund conta como estorno (a lista mentiu 6 dias)", () => {
  assert.equal(ehEstorno("studio_audio_refund"), true);
});

test("#342: perdao_negativo_onboarding conta como estorno", () => {
  // 65 linhas / 601.375 cr desde 30/08 liam como NAO ESTORNADAS. E o falso
  // negativo que paga em dobro — o acidente que este arquivo existe pra impedir.
  assert.equal(ehEstorno("perdao_negativo_onboarding"), true);
  assert.equal(ehEstorno("reparo_falha_operacional"), true);
});

test("#342: 'compensation' e estorno — o nome engana, o ref_id nao", () => {
  // Este e o tipo que o PRIMEIRO rascunho deste chamado classificou como
  // cortesia, porque "compensation" soa como bonus. Medido no banco antes de
  // decidir, pelo criterio que este arquivo define como prova (casar ref_id e
  // somar o SINAL do amount):
  //   ref_id 0c0c08fc… generation -1996 + compensation +1996 = 0
  //   ref_id 957d96eb… generation -1999 + compensation +1999 = 0
  //   nota das duas: "estorno: eco de referencia na voz Ricardo (corrigido 28/07)"
  // Debito e credito no MESMO ref_id somando zero e a definicao de quitado.
  // Se isto virar false, quem perguntar "a geracao ja foi ressarcida?" le NAO
  // e estorna de novo — o #185 de novo, so que com outro nome.
  assert.equal(ehEstorno("compensation"), true);
  assert.ok(!NAO_SAO_DEVOLUCAO.includes("compensation"));
});

test("a pegadinha do #113: os dois sem _refund no nome continuam contando", () => {
  // Quem "consertar" a lista trocando-a por LIKE '%_refund' fica cego pra estes.
  assert.equal(ehEstorno("estorno_de_engano"), true);
  assert.equal(ehEstorno("estorno"), true);
});

test("grant de ciclo NAO e devolucao — somar payment_event estoura o teto diario de mentira", () => {
  // Medido em 10/09: 11 renovacoes = 1.100.000 cr num dia normal. Lido como
  // devolucao, o teto de 100k da regra 9-B "estoura" e a ronda congela por engano.
  assert.equal(ehEstorno("payment_event"), false);
  assert.equal(ehEstorno("stripe_session"), false);
  assert.ok(NAO_SAO_DEVOLUCAO.includes("payment_event"));
});

test("cortesia/bonus NAO e devolucao — bonus de campanha nao prova ressarcimento", () => {
  for (const t of ["winback", "courtesy_grant", "admin_grant", "incident_apology_bonus"]) {
    assert.equal(ehEstorno(t), false, `${t} nao pode contar como estorno`);
  }
});

test("nenhum ref_type mora nas DUAS listas ao mesmo tempo", () => {
  const nos_dois = REF_TYPES_ESTORNO.filter((t) => NAO_SAO_DEVOLUCAO.includes(t));
  assert.deepEqual(nos_dois, [], `ambiguo: ${nos_dois.join(", ")}`);
});

test("O QUE ESTE CARD EXISTE PRA TRAVAR: tipo novo nasce ACUSANDO, nao invisivel", () => {
  // A regressao do #342 em uma linha. O criterio ANTIGO era
  //   !REF_TYPES_ESTORNO.includes(t) && /refund|estorn|devolu/i.test(t)
  // e um nome sem "refund/estorn/devolu" era invisivel POR CONSTRUCAO.
  const criterioAntigo = (t) =>
    !REF_TYPES_ESTORNO.includes(t) && /refund|estorn|devolu/i.test(t);

  const tipoNovoSemNomeObvio = "abono_operacional_2027";
  assert.equal(
    criterioAntigo(tipoNovoSemNomeObvio),
    false,
    "controle: o criterio antigo tinha mesmo que deixar passar",
  );
  assert.deepEqual(
    classificarDesconhecidos([tipoNovoSemNomeObvio]),
    [tipoNovoSemNomeObvio],
    "o criterio novo TEM que acusar tipo fora das duas listas",
  );
});

test("o guarda fica quieto quando todo mundo esta cadastrado", () => {
  assert.deepEqual(
    classificarDesconhecidos([...REF_TYPES_ESTORNO, ...NAO_SAO_DEVOLUCAO]),
    [],
  );
});

test("CONTROLE POSITIVO: os 25 tipos medidos no banco em 10/09 estao todos cadastrados", () => {
  // Se este teste quebrar, NAO relaxe o criterio: cadastre o tipo novo na lista
  // certa. Foi relaxar o criterio que produziu o #342.
  const MEDIDOS_10_09 = [
    "payment_event", "video_clone_refund", "image_refund", "image_video_refund",
    "generation_refund", "voice_train_refund", "perdao_negativo_onboarding",
    "stripe_session", "studio_scene_refund", "support_refund", "estorno_de_engano",
    "studio_audio_refund", "winback", "incident_apology_bonus", "courtesy_grant",
    "admin_grant", "credit_campaign", "compensation", "bonus_cortesia",
    "backlog_apology_bonus", "incident_apology", "stock_seed",
    "courtesy_test_access", "reparo_falha_operacional", "courtesy_video_clone",
  ];
  assert.equal(MEDIDOS_10_09.length, 25, "a medicao de 10/09 tinha 25 ref_type positivos");
  assert.deepEqual(classificarDesconhecidos(MEDIDOS_10_09), []);
});
