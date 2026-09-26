/**
 * Testes da logica pura de 2026-09-22_esperando_johnny.cjs — sem banco:
 *
 *   node --test "_frank/ferramentas/2026-09-22_esperando_johnny.test.cjs"
 *
 * Ate 26/09 este arquivo nao tinha teste nenhum: a IIFE de baixo rodava sem
 * guarda de `require.main`, entao so dava pra exercitar a logica RODANDO
 * contra o banco de verdade. A guarda + `module.exports` que acompanham este
 * teste (incidente 4f328521) tornaram a logica pura importavel sem mudar o
 * comportamento de quem roda o arquivo na mao.
 *
 * TESTE OBRIGATORIO do incidente 4f328521: `reportar.ts` passou a empurrar
 * uma nota de sistema ("REABERTURA: ...") na reabertura automatica. Essa
 * nota TEM que ser reconhecida como NEUTRA aqui — senao ela vira a ULTIMA
 * nota e enterra a nota substantiva de baixo, apagando o cartao desta fila
 * (a mesma doenca medida no #554 e no 02581255).
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { ehNeutra, ultimaNota, casa, NOTA_NEUTRA } = require("./2026-09-22_esperando_johnny.cjs");

// O texto EXATO que frontend/src/lib/incidents/reportar.ts produz na
// reabertura automatica (ver o template literal em abrirChamadoReportado).
const notaReabertura = (reportedBy, statusAnterior) =>
  `REABERTURA: novo relato (${reportedBy}) apontou pra este chamado após status "${statusAnterior}" — reaberto.`;

test("ehNeutra reconhece a nota de REABERTURA do reportar.ts, com os canais reais", () => {
  assert.ok(ehNeutra(notaReabertura("fast", "fixed")));
  assert.ok(ehNeutra(notaReabertura("carol-grupo", "ignored")));
  assert.ok(ehNeutra(notaReabertura("carol-zap", "fixed")));
});

test("ehNeutra NAO casa uma nota substantiva qualquer (nao virou coringa)", () => {
  assert.equal(ehNeutra("9-A: estornar 84.720 cr (decisao do Johnny)"), false);
  assert.equal(ehNeutra("REABERTURA manual feita pelo Frank, decisao dele"), false);
});

test("TESTE OBRIGATORIO (4f328521): nota substantiva + reabertura automatica -> ultimaNota() AINDA acha a substantiva", () => {
  const cartao = {
    id: "cc33dd44-0000-4000-8000-000000000001",
    agent_notes: [
      { by: "frank", at: "2026-09-20T10:00:00Z", note: "medindo o caso, nada decidido ainda" },
      // A nota substantiva: e ELA que carrega a marca de "espera o Johnny".
      { by: "frank", at: "2026-09-24T10:00:00Z", note: "9-A: estornar 84.720 cr das animacoes sobrescritas — decisao do Johnny" },
      // Empilhada por CIMA pela reabertura automatica do reportar.ts.
      { by: "system", at: "2026-09-26T15:00:00Z", note: notaReabertura("fast", "fixed") },
    ],
  };

  const nota = ultimaNota(cartao);
  assert.match(nota, /9-A: estornar 84\.720 cr/, "andou pra tras e achou a nota substantiva, nao a de sistema");
  assert.ok(casa(nota), "a marca da nota substantiva continua casando depois de pular a nota neutra");
});

test("sem a marca de REABERTURA em NOTA_NEUTRA, a mesma nota de sistema ENTERRARIA a substantiva (prova de regressao)", () => {
  const semAReabertura = NOTA_NEUTRA.filter((p) => !p.test(notaReabertura("fast", "fixed")));
  // Simula o detector ANTES deste conserto: sem a entrada nova, a nota de
  // reabertura nao e neutra, vira a ultima "de verdade", e ela nao carrega
  // marca nenhuma de decisao do Johnny — o cartao desapareceria da fila.
  const ehNeutraAntiga = (t) => !!t && semAReabertura.some((p) => p.test(t));
  assert.equal(ehNeutraAntiga(notaReabertura("fast", "fixed")), false);
  assert.equal(casa(notaReabertura("fast", "fixed")), null, "a nota de sistema nao carrega marca nenhuma sozinha");
});

test("NOTA_NEUTRA continua reconhecendo os dois padroes antigos (retrofit + carimbo da Fast)", () => {
  assert.ok(ehNeutra("RETROFIT DA TRAVA DO HUMANO (#415): NADA MAIS foi tocado"));
  assert.ok(ehNeutra("o aluno mandou outro e-mail e a Fast não respondeu"));
});
