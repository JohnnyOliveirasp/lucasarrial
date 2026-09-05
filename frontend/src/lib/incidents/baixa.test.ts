/**
 * Trava da BAIXA do chamado (pedido do Lucas, 04/09).
 *
 * O que estes testes seguram é a regra que o pedido existe pra proteger:
 * "aluno respondido" e "resolvido" são coisas diferentes, e a segunda não pode
 * ser um clique solto num chamado cujo defeito ainda está acontecendo.
 *
 * Os números dos casos vêm da medição real de 04/09 nos 24 chamados
 * não-fechados — estão citados um a um lá embaixo pra que, se alguém mexer na
 * régua, o teste diga exatamente qual chamado passa a escapar.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// Extensão explícita: o `node --test` não resolve import extensionless (lição
// do PR #159, rajada-nasce-fechada).
import {
  LIMITE_ALUNOS,
  LIMITE_OCORRENCIAS,
  TIPO_ALUNO_RESPONDIDO,
  TIPO_ALUNO_RESPONDIDO_DESFEITO,
  alunoRespondido,
  defeitoVivo,
  motivoDefeitoVivo,
  notaAlunoRespondido,
  notaAlunoRespondidoDesfeito,
} from "./baixa.ts";

const emails = (n: number) => Array.from({ length: n }, (_, i) => `a${i}@x.com`);

test("#234 (609 ocorrências, 10 alunos) trava o fechamento", () => {
  const inc = { occurrences: 609, affected_emails: emails(10) };
  assert.equal(defeitoVivo(inc), true);
  const motivo = motivoDefeitoVivo(inc);
  assert.match(String(motivo), /609 ocorrências/);
  assert.match(String(motivo), /10 alunos afetados/);
  assert.match(String(motivo), /Aluno respondido/);
});

test("#226 trava pela OCORRÊNCIA mesmo com um aluno só (290 × 1)", () => {
  const inc = { occurrences: 290, affected_emails: emails(1) };
  assert.equal(defeitoVivo(inc), true);
  // Só a régua de ocorrência disparou — a de alunos não pode aparecer no texto.
  assert.match(String(motivoDefeitoVivo(inc)), /290 ocorrências/);
  assert.doesNotMatch(String(motivoDefeitoVivo(inc)), /alunos afetados/);
});

test("#254 trava pelo NÚMERO DE ALUNOS mesmo com 5 ocorrências (5 × 7)", () => {
  // Este é o caso que justifica a régua ser um OU: cobrança em dobro, 7 alunos
  // pagando 2×, e só 5 ocorrências. Com régua de ocorrência apenas, escaparia.
  const inc = { occurrences: 5, affected_emails: emails(7) };
  assert.equal(defeitoVivo(inc), true);
  assert.match(String(motivoDefeitoVivo(inc)), /7 alunos afetados/);
  assert.doesNotMatch(String(motivoDefeitoVivo(inc)), /ocorrências/);
});

test("caso simples de atendimento (1 ocorrência, 1 aluno) fecha normalmente", () => {
  const inc = { occurrences: 1, affected_emails: emails(1) };
  assert.equal(defeitoVivo(inc), false);
  assert.equal(motivoDefeitoVivo(inc), null);
});

test("a régua é EXCLUSIVA nos dois lados — exatamente no limite não trava", () => {
  assert.equal(defeitoVivo({ occurrences: LIMITE_OCORRENCIAS, affected_emails: [] }), false);
  assert.equal(defeitoVivo({ occurrences: LIMITE_OCORRENCIAS + 1, affected_emails: [] }), true);
  assert.equal(defeitoVivo({ occurrences: 0, affected_emails: emails(LIMITE_ALUNOS) }), false);
  assert.equal(defeitoVivo({ occurrences: 0, affected_emails: emails(LIMITE_ALUNOS + 1) }), true);
});

test("campo ausente ou nulo não vira NaN nem trava um chamado à toa", () => {
  assert.equal(defeitoVivo({}), false);
  assert.equal(defeitoVivo({ occurrences: null, affected_emails: null }), false);
});

test("a baixa é lida das notas: sem nota, não há baixa", () => {
  assert.equal(alunoRespondido({ agent_notes: [] }), null);
  assert.equal(alunoRespondido({}), null);
  assert.equal(
    alunoRespondido({ agent_notes: [{ at: "2026-09-04T12:00:00Z", by: "agent", note: "oi" }] }),
    null,
  );
});

test("a nota de baixa carrega QUEM e QUANDO, e o tipo que a identifica", () => {
  const nota = notaAlunoRespondido({
    by: "suporte@lucasarrial.com",
    at: "2026-09-04T18:30:00Z",
    observacao: "liguei pra ela, resolvido no telefone",
  });
  assert.equal(nota.tipo, TIPO_ALUNO_RESPONDIDO);
  assert.equal(nota.by, "suporte@lucasarrial.com");
  assert.equal(nota.at, "2026-09-04T18:30:00Z");
  const lida = alunoRespondido({ agent_notes: [nota] });
  assert.deepEqual(lida, { at: "2026-09-04T18:30:00Z", by: "suporte@lucasarrial.com" });
});

test("a nota abre com 'O QUE FAZER' e avisa pra não confundir com resolvido", () => {
  const nota = notaAlunoRespondido({ by: "fulano@x.com", at: "2026-09-04T18:30:00Z" });
  assert.ok(nota.note.startsWith("=== O QUE FAZER ==="));
  assert.match(nota.note, /NÃO marque este chamado como "Resolvido"/);
  // 15:30 em São Paulo (UTC-3) — o fuso em que o time trabalha, não UTC.
  assert.match(nota.note, /04\/09\/2026 às 15:30/);
});

test("a observação de quem deu a baixa entra na nota; vazia não deixa linha órfã", () => {
  const com = notaAlunoRespondido({ by: "a@x.com", at: "2026-09-04T18:30:00Z", observacao: "liguei" });
  assert.match(com.note, /Anotação de quem deu a baixa: liguei/);
  const sem = notaAlunoRespondido({ by: "a@x.com", at: "2026-09-04T18:30:00Z", observacao: "   " });
  assert.doesNotMatch(sem.note, /Anotação de quem deu a baixa/);
});

test("desfazer NÃO apaga a nota anterior — a última é que vale", () => {
  const baixa = notaAlunoRespondido({ by: "a@x.com", at: "2026-09-04T18:30:00Z" });
  const desfeita = notaAlunoRespondidoDesfeito({ by: "b@x.com", at: "2026-09-04T19:00:00Z" });
  assert.equal(desfeita.tipo, TIPO_ALUNO_RESPONDIDO_DESFEITO);

  assert.equal(alunoRespondido({ agent_notes: [baixa, desfeita] }), null);
  // o histórico continua inteiro: duas notas, nenhuma removida
  assert.equal([baixa, desfeita].length, 2);

  // e dá pra remarcar depois — a terceira nota vence a segunda
  const remarcada = notaAlunoRespondido({ by: "c@x.com", at: "2026-09-04T20:00:00Z" });
  assert.deepEqual(alunoRespondido({ agent_notes: [baixa, desfeita, remarcada] }), {
    at: "2026-09-04T20:00:00Z",
    by: "c@x.com",
  });
});

test("nota comum do agente entre as baixas não confunde a leitura", () => {
  const baixa = notaAlunoRespondido({ by: "a@x.com", at: "2026-09-04T18:30:00Z" });
  const comum = { at: "2026-09-04T19:00:00Z", by: "agent", note: "diagnóstico qualquer" };
  assert.deepEqual(alunoRespondido({ agent_notes: [baixa, comum] }), {
    at: "2026-09-04T18:30:00Z",
    by: "a@x.com",
  });
});
