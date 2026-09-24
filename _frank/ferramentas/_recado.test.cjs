/**
 * Testes das regras puras da caixa de recados. Sem banco, sem rede, sem env:
 *
 *   node --test "_frank/ferramentas/_recado.test.cjs"
 *
 * ⚠️ Leia `# pass` / `# fail` / `# skipped` no rodapé, nunca só o exit code.
 *
 * A armadilha central que este arquivo guarda: CONSUMO ≠ IDADE. Existe recado
 * de 03/09 (21 dias em 24/09) apontando pra cartão ainda ABERTO — velho e
 * pendente ao mesmo tempo. Uma limpeza que apague "por idade" destrói recado
 * não tratado; o teste PROVA-DE-MUTAÇÃO abaixo cai se alguém trocar a regra
 * de `lido_em` por idade da chave.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("./_recado.cjs");

const AGORA = Date.parse("2026-09-24T12:00:00.000Z");
const iso = (msAtras) => new Date(AGORA - msAtras).toISOString();
const DIA = R.DIA_MS;

/** Recado no formato real medido em produção (24/09). */
const recado = (over = {}) => ({
  at: iso(21 * DIA), // nasceu em 03/09: o mais velho da fila real
  from: "vigia",
  subject: "compra órfã sem conta",
  message: "aluno pagou e a conta não nasceu",
  incident_id: "4071ee9a-8414-4ac9-b9a9-49be6a3efa5d",
  ...over,
});

/* ───────────────────────── interpretarValue ───────────────────────── */

test("value objeto passa intocado", () => {
  const v = recado();
  assert.deepEqual(R.interpretarValue(v), v);
});

test("value com JSON dentro de string (dupla codificação) é aberto", () => {
  const v = recado();
  assert.deepEqual(R.interpretarValue(JSON.stringify(v)), v);
});

test("value que não é objeto NÃO se perde: vira { valor_original }", () => {
  // jsonb NOT NULL aceita string/número/array crus; embrulhar preserva a
  // evidência e deixa o merge de lido_em funcionar mesmo assim.
  assert.deepEqual(R.interpretarValue("texto solto"), { valor_original: "texto solto" });
  assert.deepEqual(R.interpretarValue([1, 2]), { valor_original: [1, 2] });
  assert.deepEqual(R.interpretarValue(null), { valor_original: null });
});

/* ─────────────────────── aparece no --listar? ─────────────────────── */

test("sem lido_em aparece no --listar, POUCO IMPORTA a idade", () => {
  // 21 dias e ainda pendente = o caso real de 03/09. Sumir com ele da lista
  // seria esconder trabalho não feito.
  assert.equal(R.apareceNoListar(recado(), AGORA), true);
});

test("lido_em recente NÃO aparece no --listar", () => {
  assert.equal(R.apareceNoListar(recado({ lido_em: iso(2 * 3600000) }), AGORA), false);
});

test("lido_em antigo NÃO aparece no --listar (consumido é consumido)", () => {
  assert.equal(R.apareceNoListar(recado({ lido_em: iso(45 * DIA) }), AGORA), false);
});

test("lido_em ilegível conta como NÃO lido: volta pra lista", () => {
  // consumo que não se prova não silencia o recado…
  assert.equal(R.apareceNoListar(recado({ lido_em: "ontem de tarde" }), AGORA), true);
  assert.equal(R.apareceNoListar(recado({ lido_em: "" }), AGORA), true);
  assert.equal(R.apareceNoListar(recado({ lido_em: 12345 }), AGORA), true);
});

/* ──────────────────────────── pode apagar? ────────────────────────── */

test("PROVA-DE-MUTAÇÃO: não-lido NUNCA apaga, seja qual for a idade da chave", () => {
  // O recado nasceu há 60 dias e NINGUÉM o consumiu. Se o --limpar passar a
  // olhar idade em vez de lido_em, ESTE teste cai — e tem que cair, porque
  // apagaria recado pendente apontando pra cartão ainda aberto.
  const velhoENaoLido = recado({ at: iso(60 * DIA) });
  assert.equal(R.podeApagar(velhoENaoLido, AGORA), false);
});

test("lido há 31 dias apaga", () => {
  assert.equal(R.podeApagar(recado({ lido_em: iso(31 * DIA) }), AGORA), true);
});

test("lido há 29 dias NÃO apaga (retenção é evidência)", () => {
  assert.equal(R.podeApagar(recado({ lido_em: iso(29 * DIA) }), AGORA), false);
});

test("lido há EXATOS 30 dias não apaga: a regra é MAIS de 30", () => {
  assert.equal(R.podeApagar(recado({ lido_em: iso(30 * DIA) }), AGORA), false);
});

test("…e o mesmo consumo ilegível NUNCA entra no --limpar", () => {
  // fecha o par com o teste da lista: ilegível = não lido nos DOIS lados.
  assert.equal(R.podeApagar(recado({ lido_em: "ontem de tarde", at: iso(90 * DIA) }), AGORA), false);
});

test("janela de retenção é parametrizável", () => {
  const v = recado({ lido_em: iso(8 * DIA) });
  assert.equal(R.podeApagar(v, AGORA, 7), true);
  assert.equal(R.podeApagar(v, AGORA, 30), false);
});

/* ──────────────────────────── marcar lido ─────────────────────────── */

test("marcarLido faz MERGE: carimba sem perder nenhum campo original", () => {
  const original = recado();
  const { value: novo, jaLido } = R.marcarLido(original, new Date(AGORA).toISOString(), "frank/ronda");
  assert.equal(jaLido, false);
  assert.equal(novo.lido_em, new Date(AGORA).toISOString());
  assert.equal(novo.lido_por, "frank/ronda");
  // o texto original é evidência: TODO campo de antes continua lá
  for (const k of Object.keys(original)) assert.deepEqual(novo[k], original[k]);
  // e o value de entrada não foi mutado (a escrita é de quem regrava)
  assert.equal(original.lido_em, undefined);
});

test("re-marcar NÃO reseta o relógio dos 30 dias nem troca quem leu", () => {
  const consumido = recado({ lido_em: iso(20 * DIA), lido_por: "frank/ronda" });
  const { value, jaLido } = R.marcarLido(consumido, new Date(AGORA).toISOString(), "outro");
  assert.equal(jaLido, true);
  assert.equal(value.lido_em, iso(20 * DIA));
  assert.equal(value.lido_por, "frank/ronda");
});

test("sem --por o carimbo sai sem lido_por (não inventa autor)", () => {
  const { value } = R.marcarLido(recado(), new Date(AGORA).toISOString());
  assert.equal("lido_por" in value, false);
});

test("ciclo completo: marcou → some da lista, e só apaga 31 dias DEPOIS do consumo", () => {
  const { value } = R.marcarLido(recado(), new Date(AGORA).toISOString(), "frank");
  assert.equal(R.apareceNoListar(value, AGORA), false);
  assert.equal(R.podeApagar(value, AGORA), false); // acabou de ler
  assert.equal(R.podeApagar(value, AGORA + 31 * DIA), true); // um mês depois
});

/* ─────────────────────── incidente correspondente ─────────────────── */

test("incidente vem SÓ do campo incident_id do value", () => {
  assert.equal(R.incidenteDe(recado()), "4071ee9a-8414-4ac9-b9a9-49be6a3efa5d");
});

test("os três formatos de chave dão no mesmo: sem incident_id no value, sem incidente", () => {
  // Medido em 24/09: o sufixo real é prefixo de 8 hex (para_frank_cfde107d),
  // timestamp (para_frank_1757...) ou orfa_<rand> — NUNCA uuid completo.
  // Casar prefixo de uuid já mordeu (caso #399/#407), então sufixo não conta.
  for (const semIncidente of [
    recado({ incident_id: undefined }),
    recado({ incident_id: "" }),
    recado({ incident_id: "   " }),
    { at: iso(DIA), subject: "orfã" }, // formato orfa_/timestamp real
  ]) {
    assert.equal(R.incidenteDe(semIncidente), null);
  }
});

/* ──────────────────────────── dia do recado ───────────────────────── */

test("dia do recado: o `at` de quem escreveu manda; updated_at é o reserva", () => {
  assert.equal(R.diaDe(recado(), "2026-09-24T00:00:00Z"), recado().at);
  assert.equal(R.diaDe({}, "2026-09-24T00:00:00Z"), "2026-09-24T00:00:00Z");
  assert.equal(R.diaDe({}, undefined), null);
});
