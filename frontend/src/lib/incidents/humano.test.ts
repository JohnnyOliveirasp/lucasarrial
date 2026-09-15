/**
 * A REGRA da trava do humano, sem banco (#415).
 *
 * O que estes casos protegem, nesta ordem de importância:
 *   - caso entregue e ATIVO cala a casa (o defeito da tuquinha);
 *   - caso FECHADO destrava (senão a trava vira silêncio permanente, que é o
 *     dano pior — é a razão de a fonte da verdade ser a linha viva);
 *   - caso aberto que NUNCA foi entregue não cala nada (senão o aluno espera
 *     um humano que ninguém chamou).
 *
 * Roda com `node --test` pelado (nada aqui toca IO).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIPO_ENTREGUE_HUMANO,
  casoAtivo,
  entregueAoHumano,
  notaEntregueAoHumano,
  travadoPorHumano,
} from "./humano.ts";
import { TIPO_ALUNO_RESPONDIDO } from "./baixa.ts";

const NOTA_COMUM = { at: "2026-09-15T11:00:00Z", by: "carol", note: "qualquer coisa" };
const ENTREGUE = notaEntregueAoHumano({
  at: "2026-09-15T11:55:00Z",
  by: "carol",
  note: "Time avisado no grupo do WhatsApp…",
});

test("o caso da tuquinha: entregue ao time e ainda aberto → a casa CALA", () => {
  assert.equal(
    travadoPorHumano({ status: "investigating", agent_notes: [NOTA_COMUM, ENTREGUE] }),
    true,
    "foi este o caso que rendeu 9 mensagens automáticas em 2h50",
  );
});

test("chamado FECHADO destrava — a trava não pode calar o aluno pra sempre", () => {
  for (const status of ["fixed", "ignored"]) {
    assert.equal(
      travadoPorHumano({ status, agent_notes: [ENTREGUE] }),
      false,
      `${status} significa que ninguém está mais com o caso; a Fast tem que voltar a falar`,
    );
  }
});

test("chamado aberto que NUNCA foi entregue não cala nada", () => {
  assert.equal(
    travadoPorHumano({ status: "open", agent_notes: [NOTA_COMUM] }),
    false,
    "chamado técnico que ninguém pegou não pode deixar o aluno esperando um humano que não foi chamado",
  );
  assert.equal(travadoPorHumano({ status: "open", agent_notes: [] }), false);
  assert.equal(travadoPorHumano({ status: "open", agent_notes: null }), false);
  assert.equal(travadoPorHumano({}), false, "linha sem status nem notas não trava");
});

test("todo status que não é fechamento conta como ATIVO (inclusive um que ninguém mapeou)", () => {
  for (const status of ["open", "investigating", "fixing", "aguardando_aluno", "suporte_necessario"]) {
    assert.equal(casoAtivo({ status }), true, `${status} é caso de pé`);
    assert.equal(travadoPorHumano({ status, agent_notes: [ENTREGUE] }), true);
  }
  assert.equal(
    travadoPorHumano({ status: "status_que_ainda_nao_existe", agent_notes: [ENTREGUE] }),
    true,
    "status desconhecido tem que cair no lado SEGURO (ativo) — destravar por omissão é como a casa volta a falar por cima de gente",
  );
});

test("a marca é a chave `tipo`, não o texto da nota", () => {
  // O texto da nota de entrega já mudou de redação antes (#82 → #153) e vai
  // mudar de novo. Casar por texto seria uma trava que morre no dia em que
  // alguém reescrever a frase — e morre em silêncio.
  assert.equal(ENTREGUE.tipo, TIPO_ENTREGUE_HUMANO);
  assert.equal(
    entregueAoHumano({
      agent_notes: [{ at: "x", by: "carol", note: "Time avisado no grupo do WhatsApp em 15/09…" }],
    }),
    false,
    "nota com o texto da entrega mas SEM tipo não é a marca",
  );
});

test("a nota de entrega preserva at/by/note — quem lê o painel não vê diferença", () => {
  assert.equal(ENTREGUE.at, "2026-09-15T11:55:00Z");
  assert.equal(ENTREGUE.by, "carol");
  assert.equal(ENTREGUE.note, "Time avisado no grupo do WhatsApp…");
});

test("não confunde com a baixa `aluno_respondido` — são tipos diferentes", () => {
  assert.equal(
    entregueAoHumano({
      agent_notes: [{ at: "x", by: "alguem@x.com", note: "respondi", tipo: TIPO_ALUNO_RESPONDIDO }],
    }),
    false,
  );
});
