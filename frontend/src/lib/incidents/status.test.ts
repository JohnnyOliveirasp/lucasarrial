/**
 * Trava do vocabulário de status.
 *
 * Existe por um sintoma específico: a lista estava copiada em duas rotas, e
 * status que entra numa e não na outra produz o pior erro possível — a tela
 * oferece o botão, a rota devolve "Invalid 'status'", e quem clicou acha que o
 * painel quebrou.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { INCIDENT_STATUSES, isIncidentStatus } from "./status.ts";
import { CLOSED_STATUSES } from "./closure.ts";

test("os status que já existiam continuam válidos", () => {
  for (const s of ["open", "investigating", "fixing", "aguardando_aluno", "fixed", "ignored"]) {
    assert.equal(isIncidentStatus(s), true, s);
  }
});

test("suporte_necessario é status válido (pedido do Lucas, 04/09)", () => {
  assert.equal(isIncidentStatus("suporte_necessario"), true);
  assert.ok(INCIDENT_STATUSES.includes("suporte_necessario"));
});

test("suporte_necessario NÃO é fechamento — o caso continua no quadro", () => {
  // O pedido era dar uma gaveta pro time, não uma forma de sumir com o caso.
  assert.equal(CLOSED_STATUSES.has("suporte_necessario"), false);
});

test("lixo não passa", () => {
  for (const v of ["", "resolvido", "OPEN", null, undefined, 7, {}]) {
    assert.equal(isIncidentStatus(v), false, String(v));
  }
});

test("todo status fechado está na lista de status", () => {
  for (const s of CLOSED_STATUSES) assert.ok(INCIDENT_STATUSES.includes(s as never), s);
});
