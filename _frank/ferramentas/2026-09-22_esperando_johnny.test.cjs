/**
 * Testes da leitura de marca do esperando_johnny.cjs. Sem banco, sem rede:
 *
 *   node --test "_frank/ferramentas/2026-09-22_esperando_johnny.test.cjs"
 *
 * ⚠️ Leia `# pass` / `# skipped`, nunca so o codigo de saida (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que nao RODOU tambem sai com exit 0.
 *
 * POR QUE ESTES CASOS (#554, 24/09). Um retrofit as 17:48Z escreveu a MESMA
 * nota de manutencao em 21 cartoes vivos, virando a ULTIMA nota de todos.
 * A leitura antiga (`agent_notes -> -1`, literal) parou de ver a marca de
 * decisao e 4 cartoes da fila do Johnny sumiram da varredura — 3 deles de
 * dinheiro de aluno. O conserto: "ultima nota" passa a ser "ultima nota
 * SUBSTANTIVA" (pula nota de manutencao, andando pra tras). Este arquivo
 * trava esse comportamento: se o proximo retrofit voltar a enterrar a fila,
 * o teste "nota de manutencao nao muda a saida" tem que quebrar ANTES.
 *
 * Os textos das notas sao REAIS (copiados do banco em 24/09), nao frases
 * fabricadas — regra da casa: detector se testa com o texto que existe.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { ultimaNota, ehNotaManutencao, casa } = require("./2026-09-22_esperando_johnny.cjs");

// ---------------------------------------------------------------------------
// Textos reais (banco, 24/09).
// ---------------------------------------------------------------------------

// Inicio VERBATIM da nota que o retrofit de 24/09 17:48Z gravou em 21 cartoes
// (lido do 8b8fc4c8). Nasceu SEM `tipo:"manutencao"` — e o caso da ponte.
const NOTA_RETROFIT_REAL =
  'RETROFIT DA TRAVA DO HUMANO (#415) — marca posta à mão pela ronda de 24/09.\n\n' +
  'O QUE MUDOU NESTE CARTÃO: a nota de entrega ao time ganhou `tipo="entregue_humano"`.\n' +
  'NADA MAIS foi tocado — nem status, nem crédito, nem acesso, nem texto de nota.';

// Nota substantiva real do 52b22304 (fila do Johnny): cita a regra de alcada
// 9-A, que e uma das MARCAS. E o tipo de nota que a varredura TEM que ver.
const NOTA_SUBSTANTIVA_9A =
  "9-A: devolver ou nao o credito das geracoes que o nosso proprio laudo " +
  "chamou de fracas e uma decisao de saldo de aluno — mexer em saldo e sempre do Johnny.";

// Nota substantiva real do proprio #554 (e693222b): CITA a frase do retrofit
// NO MEIO do texto (posicao 207 no banco). NAO e nota de manutencao — quem a
// escreveu leu o caso. Se a ponte casar aqui, ela esta larga demais.
const NOTA_QUE_CITA_RETROFIT =
  "=== FRANK, 24/09 ~18h30Z — MEDI O RECADO. PREMISSA CONFIRMADA, NUMERO CORRIGIDO. ===\n" +
  "CAUSA CONFIRMADA NO CODIGO: ultimaNota() (~208) le SO a ultima nota. Em 24/09 17:48Z o " +
  "RETROFIT DA TRAVA DO HUMANO (#415) escreveu nota nova em cartoes vivos e virou a ultima " +
  "de todos — a decisao segue sendo do Johnny e o cartao nao pode sumir da varredura.";

const nota = (note, extra) => ({ at: "2026-09-24T17:48:30.000Z", by: "frank", note, ...extra });

// ---------------------------------------------------------------------------
// ehNotaManutencao: o que e e o que NAO e manutencao.
// ---------------------------------------------------------------------------

test("tipo:'manutencao' marca a nota como manutencao, qualquer que seja o texto", () => {
  assert.equal(ehNotaManutencao(nota("backfill de rotulo, escrita em lote", { tipo: "manutencao" })), true);
});

test("ponte: a nota real do retrofit de 24/09 (sem campo tipo) e manutencao", () => {
  assert.equal(ehNotaManutencao(nota(NOTA_RETROFIT_REAL)), true);
});

test("nota substantiva que CITA o retrofit no meio do texto NAO e manutencao (e693222b)", () => {
  assert.equal(ehNotaManutencao(nota(NOTA_QUE_CITA_RETROFIT)), false);
});

test("nota substantiva comum nao e manutencao; degenerados nao explodem", () => {
  assert.equal(ehNotaManutencao(nota(NOTA_SUBSTANTIVA_9A)), false);
  assert.equal(ehNotaManutencao(null), false);
  assert.equal(ehNotaManutencao(undefined), false);
  assert.equal(ehNotaManutencao("string solta"), false);
  assert.equal(ehNotaManutencao({ at: "2026-09-24T00:00:00Z", by: "frank" }), false); // sem note
});

// ---------------------------------------------------------------------------
// ultimaNota: a REGRESSAO do #554. Nota de manutencao num cartao da fila
// NAO pode mudar a saida da varredura.
// ---------------------------------------------------------------------------

/** Cartao como o 52b22304 ANTES do retrofit: ultima nota substantiva com marca. */
const cartaoNaFila = () => ({
  id: "52b22304-0000-4000-8000-000000000001",
  status: "aguardando_aluno",
  agent_notes: [
    nota("apurei o caso; laudo interno chamou as geracoes de fracas"),
    nota(NOTA_SUBSTANTIVA_9A),
  ],
});

test("REGRESSAO #554: escrever nota de manutencao num cartao da fila NAO muda a saida", () => {
  const antes = cartaoNaFila();
  const marcaAntes = casa(ultimaNota(antes));
  assert.ok(marcaAntes, "pre-condicao: o cartao TEM que estar visivel antes do retrofit");

  // O retrofit de 24/09, como aconteceu: nota em lote SEM campo tipo (ponte)...
  const depoisPonte = cartaoNaFila();
  depoisPonte.agent_notes.push(nota(NOTA_RETROFIT_REAL));
  assert.equal(casa(ultimaNota(depoisPonte)), marcaAntes, "retrofit sem tipo (ponte) enterrou o cartao");

  // ...e como DEVE acontecer daqui pra frente: nota em lote com tipo:"manutencao".
  const depoisTipo = cartaoNaFila();
  depoisTipo.agent_notes.push(nota("ajuste de rotulo em lote, ninguem leu o caso", { tipo: "manutencao" }));
  assert.equal(casa(ultimaNota(depoisTipo)), marcaAntes, "nota tipo:manutencao enterrou o cartao");

  // Duas manutencoes empilhadas (retrofit + backfill) tambem nao enterram.
  const depoisDuas = cartaoNaFila();
  depoisDuas.agent_notes.push(nota(NOTA_RETROFIT_REAL));
  depoisDuas.agent_notes.push(nota("backfill do campo tipo", { tipo: "manutencao" }));
  assert.equal(casa(ultimaNota(depoisDuas)), marcaAntes, "pilha de manutencao enterrou o cartao");
});

test("nota SUBSTANTIVA nova continua mandando: quem supera a marca, some da fila (correto)", () => {
  // O criterio 1 continua de pe: a leitura NAO varre a pilha atras de marca.
  // Se a ultima substantiva nao tem marca, o cartao sai — e assim que deve ser.
  const c = cartaoNaFila();
  c.agent_notes.push(nota("resolvido: o Lucas decidiu no grupo, credito devolvido, caso encerrado"));
  assert.equal(casa(ultimaNota(c)), null);
});

test("cartao cuja pilha inteira e manutencao devolve null (nada substantivo pra ler)", () => {
  const c = { id: "x", status: "open", agent_notes: [nota(NOTA_RETROFIT_REAL), nota("lote", { tipo: "manutencao" })] };
  assert.equal(ultimaNota(c), null);
});

test("degenerados de agent_notes: null, vazio, string — como antes, sem explodir", () => {
  assert.equal(ultimaNota({ agent_notes: null }), null);
  assert.equal(ultimaNota({ agent_notes: [] }), null);
  assert.equal(ultimaNota({ agent_notes: "string corrompida" }), null);
  // ultima nota sem campo note (substantiva vazia) devolve "" — semantica antiga.
  assert.equal(ultimaNota({ agent_notes: [{ at: "2026-09-24T00:00:00Z", by: "frank" }] }), "");
});

// ---------------------------------------------------------------------------
// A SEMANTICA VELHA erra nestes mesmos casos — teste que passa nos dois lados
// nao prova nada (padrao do percepcao_travada.test.cjs).
// ---------------------------------------------------------------------------

test("prova do defeito: a leitura VELHA (agent_notes -> -1 literal) enterra o cartao", () => {
  const velha = (r) => {
    const n = r.agent_notes;
    if (!Array.isArray(n) || n.length === 0) return null;
    const u = n[n.length - 1];
    return (u && (u.note || "")) || "";
  };
  const c = cartaoNaFila();
  c.agent_notes.push(nota(NOTA_RETROFIT_REAL));
  assert.equal(casa(velha(c)), null, "a leitura velha DEVERIA falhar aqui; se casou, este teste perdeu o sentido");
  assert.ok(casa(ultimaNota(c)), "a leitura nova tem que ver a marca no mesmo cartao");
});

// ---------------------------------------------------------------------------
// Tripwire no fonte: o conserto nao pode ser desfeito em refatoracao muda.
// ---------------------------------------------------------------------------

test("tripwire: ultimaNota() usa ehNotaManutencao e o fonte mantem a ponte ancorada no inicio", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(require.resolve("./2026-09-22_esperando_johnny.cjs"), "utf8");
  const corpo = src.match(/function ultimaNota[\s\S]*?\n\}/);
  assert.ok(corpo, "ultimaNota() sumiu do fonte");
  assert.match(corpo[0], /ehNotaManutencao/, "ultimaNota() nao consulta mais ehNotaManutencao — o #554 volta");
  assert.match(src, /\/\^\\s\*RETROFIT DA TRAVA DO HUMANO\/i/, "a ponte perdeu a ancora ^ do inicio — nota que CITA o retrofit viraria manutencao");
});
