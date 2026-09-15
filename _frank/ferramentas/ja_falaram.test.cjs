/**
 * Testes da lógica pura do `ja_falaram.cjs`. Sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/ja_falaram.test.cjs
 *
 * O que se testa aqui é a HONESTIDADE do laudo, não a beleza do código. Esta
 * ferramenta nasceu de um erro meu (14/09: escrevi pro Rodrigo que "ninguém te
 * deu retorno" quando a equipe já tinha respondido), e o modo de falhar dela é
 * traiçoeiro: cega, ela não dá erro — dá "SEM REGISTRO" com cara de resposta
 * boa. Cada caso abaixo trava uma maneira de ela voltar a mentir.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { baixaVigente, classificarQuemFechou, renderTexto, AVISO } = require("./ja_falaram.cjs");

/* ── baixaVigente: "quem venceu por último" ─────────────────────────────── */

test("a baixa marcada é lida (o caso Rodrigo, #363)", () => {
  const notas = [
    { at: "2026-09-10T10:00:00Z", by: "frank", note: "triagem" },
    { at: "2026-09-12T14:00:00Z", by: "suporte@lucasarrial.com", note: "...", tipo: "aluno_respondido" },
  ];
  const b = baixaVigente(notas);
  assert.equal(b.desfeita, false);
  assert.equal(b.by, "suporte@lucasarrial.com");
});

test("o DESFAZER vence a baixa anterior — existe 1 na base, não é hipótese", () => {
  const notas = [
    { at: "2026-09-05T10:00:00Z", by: "suporte@lucasarrial.com", tipo: "aluno_respondido" },
    { at: "2026-09-06T10:00:00Z", by: "suporte@lucasarrial.com", tipo: "aluno_respondido_desfeito" },
  ];
  assert.equal(baixaVigente(notas).desfeita, true);
});

test("re-marcar DEPOIS do desfazer volta a valer (a ordem é que manda)", () => {
  const notas = [
    { at: "2026-09-05T10:00:00Z", by: "x@y.com", tipo: "aluno_respondido" },
    { at: "2026-09-06T10:00:00Z", by: "x@y.com", tipo: "aluno_respondido_desfeito" },
    { at: "2026-09-07T10:00:00Z", by: "x@y.com", tipo: "aluno_respondido" },
  ];
  assert.equal(baixaVigente(notas).desfeita, false);
});

test("nota comum não é baixa — senão qualquer triagem do robô viraria 'atendido'", () => {
  assert.equal(baixaVigente([{ at: "2026-09-01T10:00:00Z", by: "frank", note: "olhei" }]), null);
});

test("agent_notes corrompido em string não quebra nem inventa baixa", () => {
  // já apareceu corrompido nesta base — ver varredura_travados.cjs
  assert.equal(baixaVigente("[]"), null);
  assert.equal(baixaVigente(null), null);
  assert.equal(baixaVigente(undefined), null);
});

/* ── classificarQuemFechou: robô × humano × não-sei ─────────────────────── */

test("os robôs medidos em resolved_by são reconhecidos, inclusive com sufixo", () => {
  for (const r of ["frank", "claude", "agent", "backfill", "frank/coder", "frank/rotina-falhas", "carol (entregue ao time)", "claude (sessão 11/08)", "claude-code", "vigia"]) {
    assert.equal(classificarQuemFechou(r), "robo", `${r} devia ser robô`);
  }
});

test("quem tem @ é gente", () => {
  assert.equal(classificarQuemFechou("suporte@lucasarrial.com"), "humano");
  assert.equal(classificarQuemFechou("vitor@lucasarrial.com"), "humano");
});

test("o 'james' e o 'johnny (sessão interativa)' saem como AMBÍGUO, não como resposta", () => {
  // james fechou 18 chamados e é uma pessoa (corrigiu o VAD no 9c376c8), mas
  // "fechou um bug" não é "falou com o aluno". Chutar qualquer lado aqui
  // inventa fato sobre atendimento.
  assert.equal(classificarQuemFechou("james"), "ambiguo");
  assert.equal(classificarQuemFechou("johnny (sessão interativa)"), "ambiguo");
  assert.equal(classificarQuemFechou(""), "ambiguo");
  assert.equal(classificarQuemFechou(null), "ambiguo");
});

test("'frankenstein' não é o frank — o prefixo não pode casar no meio da palavra", () => {
  assert.equal(classificarQuemFechou("frankenstein@aluno.com"), "humano");
});

/* ── o laudo: o aviso não pode sumir ────────────────────────────────────── */

const VAZIO = { email: "x@y.com", atendido: false, temPerfil: false, alcancavelPorWhatsapp: false, incidentes: [], baixas: [], fechamentos: [], whatsapp: [] };

test("SEM REGISTRO SEMPRE vem com o aviso de que isso não é prova de silêncio", () => {
  const txt = renderTexto(VAZIO).join("\n");
  assert.match(txt, /SEM REGISTRO/);
  assert.ok(txt.includes(AVISO), "o aviso é o motivo do arquivo existir — não pode sumir");
  assert.match(txt, /NÃO SIGNIFICA QUE NINGUÉM RESPONDEU/);
});

test("fechar chamado NÃO vira ATENDIDO sozinho — o erro do Rodrigo ao contrário", () => {
  const r = { ...VAZIO, fechamentos: [{ numero: 1, title: "t", by: "suporte@lucasarrial.com", at: "2026-09-10T10:00:00Z", classe: "humano" }] };
  const txt = renderTexto(r).join("\n");
  assert.match(txt, /SEM REGISTRO/, "indício fraco não pode promover a atendido");
  assert.match(txt, /INDÍCIO FRACO/);
  assert.ok(txt.includes(AVISO));
});

test("baixa vigente vira ATENDIDO com data e autor", () => {
  const r = { ...VAZIO, atendido: true, baixas: [{ numero: 363, title: "t", at: "2026-09-12T14:00:00Z", by: "suporte@lucasarrial.com", desfeita: false }] };
  const txt = renderTexto(r).join("\n");
  assert.match(txt, /ATENDIDO/);
  assert.match(txt, /suporte@lucasarrial\.com/);
  assert.match(txt, /12\/09\/2026/);
});

test("baixa desfeita NÃO é atendimento e diz isso na cara", () => {
  const r = { ...VAZIO, baixas: [{ numero: 9, title: "t", at: "2026-09-12T14:00:00Z", by: "x@y.com", desfeita: true }] };
  const txt = renderTexto(r).join("\n");
  assert.match(txt, /SEM REGISTRO/);
  assert.match(txt, /DESFEITA/);
  assert.ok(txt.includes(AVISO));
});
