/**
 * node --test src/lib/payments/orphan-ciclo.test.ts
 *
 * Os casos com nome de gente são os medidos em produção em 08/09/2026 — se um
 * deles quebrar, o sweeper voltou a calar pagante que foi cobrado de novo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ancoraDoCiclo,
  decidirAcaoConvite,
  registroDoConvite,
  type RegistroConvite,
} from "./orphan-ciclo.ts";

const DIA = 24 * 60 * 60 * 1000;
const LEMBRETE = 3 * DIA;
const AGORA = Date.parse("2026-09-08T13:00:00.000Z");

test("nunca procurado recebe convite", () => {
  assert.equal(
    decidirAcaoConvite({
      registro: undefined,
      ultimoPagamentoIso: "2026-09-01T14:15:16.174608+00:00",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "convite",
  );
});

test("Joseph: calado em 07/08, cobrado de novo em 17/08 — ciclo reabre", () => {
  const registro: RegistroConvite = {
    first: "2026-08-04T01:27:41.776Z",
    reminder: "2026-08-07T14:00:43.669Z",
  };
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: "2026-08-17T14:13:47.982633+00:00",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "convite",
  );
});

test("EZ: convite+lembrete de agosto, pagou US$20 em 01/09 — ciclo reabre", () => {
  const registro: RegistroConvite = {
    first: "2026-08-26T14:00:12.059Z",
    reminder: "2026-08-30T14:00:15.195Z",
  };
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: "2026-09-01T14:15:16.174608+00:00",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "convite",
  );
});

test("ciclo já atendido não repete: cicloEm igual ao último pagamento cala", () => {
  const registro: RegistroConvite = {
    first: "2026-08-04T01:27:41.776Z",
    reminder: "2026-08-07T14:00:43.669Z",
    cicloEm: "2026-08-17T14:13:47.982Z",
  };
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: "2026-08-17T14:13:47.982633+00:00",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "nada",
  );
});

test("ARMADILHA DO FORMATO: o MESMO instante em dois formatos não reabre ciclo", () => {
  // String compare diria que "…982633+00:00" < "…982Z" e, pior, no sentido
  // inverso o `6` < `Z` faria um pagamento NOVO parecer velho. Aqui é em ms.
  const registro: RegistroConvite = {
    first: "2026-08-01T00:00:00.000Z",
    reminder: null,
    cicloEm: "2026-08-17T14:13:47.982Z",
  };
  const acao = decidirAcaoConvite({
    registro,
    ultimoPagamentoIso: "2026-08-17T14:13:47.982633+00:00",
    agoraMs: AGORA,
    lembreteAposMs: LEMBRETE,
  });
  assert.notEqual(acao, "convite", "mesmo instante não pode contar como pagamento novo");
});

test("registro antigo sem cicloEm ancora no first", () => {
  assert.equal(
    ancoraDoCiclo({ first: "2026-08-04T01:27:41.776Z", reminder: null }),
    "2026-08-04T01:27:41.776Z",
  );
  assert.equal(
    ancoraDoCiclo({ first: "2026-08-04T01:27:41.776Z", reminder: null, cicloEm: "2026-08-17T00:00:00.000Z" }),
    "2026-08-17T00:00:00.000Z",
  );
});

test("sem pagamento novo, o lembrete único ainda sai depois da espera", () => {
  const registro: RegistroConvite = {
    first: "2026-09-01T00:00:00.000Z",
    reminder: null,
    cicloEm: "2026-09-01T00:00:00.000Z",
  };
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: "2026-09-01T00:00:00.000Z",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "lembrete",
  );
});

test("lembrete não sai antes da espera vencer", () => {
  const registro: RegistroConvite = {
    first: "2026-09-07T12:00:00.000Z",
    reminder: null,
    cicloEm: "2026-09-07T12:00:00.000Z",
  };
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: "2026-09-07T12:00:00.000Z",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "nada",
  );
});

test("lembrete já enviado e sem pagamento novo = silêncio", () => {
  const registro: RegistroConvite = {
    first: "2026-08-04T01:27:41.776Z",
    reminder: "2026-08-07T14:00:43.669Z",
    cicloEm: "2026-08-04T01:27:41.776Z",
  };
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: "2026-08-01T00:00:00.000Z",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "nada",
  );
});

test("falha fechada: pagamento com data ilegível não reabre ciclo", () => {
  const registro: RegistroConvite = {
    first: "2026-08-04T01:27:41.776Z",
    reminder: "2026-08-07T14:00:43.669Z",
  };
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: "nao-e-data",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "nada",
  );
  assert.equal(
    decidirAcaoConvite({
      registro,
      ultimoPagamentoIso: null,
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "nada",
  );
});

test("registroDoConvite carimba o pagamento que o ciclo atendeu", () => {
  const r = registroDoConvite("2026-09-08T13:00:00.000Z", "2026-09-01T14:15:16.174608+00:00");
  assert.equal(r.first, "2026-09-08T13:00:00.000Z");
  assert.equal(r.reminder, null);
  assert.equal(r.cicloEm, "2026-09-01T14:15:16.174608+00:00");

  // Escrito o registro, o mesmo pagamento não reabre de novo (idempotente).
  assert.equal(
    decidirAcaoConvite({
      registro: r,
      ultimoPagamentoIso: "2026-09-01T14:15:16.174608+00:00",
      agoraMs: AGORA,
      lembreteAposMs: LEMBRETE,
    }),
    "nada",
  );
});
