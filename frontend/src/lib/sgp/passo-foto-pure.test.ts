/**
 * Tela 2 do SGP — o que estes testes protegem:
 *
 *  1. o botão "Continuar" nunca fica cinza sem a tela dizer POR QUÊ (caso
 *     amanda.rosaleal@gmail.com, 13/09: 6 fotos aprovadas, contador verde,
 *     botão morto, zero pista de que faltavam os 5 checkboxes);
 *  2. a régua NÃO afrouxou: 4 aprovadas + 5 itens continuam obrigatórios, e
 *     cinco cópias do mesmo item não valem cinco itens;
 *  3. o que volta do banco pra reidratar os checkboxes é higienizado (é isso
 *     que faz atualizar a página deixar de apagar as marcações).
 *
 * Rodar (Node >= 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/passo-foto-pure.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cienciaValida,
  motivosBloqueioFoto,
  podeContinuarFoto,
  podeGuardarRascunhoCiencia,
} from "./passo-foto-pure.ts";
import { CIENCIA_FOTO, SGP_FOTOS_MIN } from "./types.ts";

const TODAS = [...CIENCIA_FOTO];

test("(d) com tudo certo, nada bloqueia — o botão acende", () => {
  const estado = { aprovadas: SGP_FOTOS_MIN, ocupado: false, ciencia: CIENCIA_FOTO.length };
  assert.deepEqual(motivosBloqueioFoto(estado), []);
  assert.equal(podeContinuarFoto(estado), true);
});

test("(a) faltando 1 confirmação, o motivo diz que falta 1 — mesmo com foto sobrando", () => {
  const motivos = motivosBloqueioFoto({ aprovadas: 6, ocupado: false, ciencia: CIENCIA_FOTO.length - 1 });
  assert.deepEqual(motivos, [{ tipo: "ciencia", faltam: 1 }]);
});

test("(a2) sem marcar nada, o motivo diz que faltam os 5 — é o caso da Amanda", () => {
  const motivos = motivosBloqueioFoto({ aprovadas: 6, ocupado: false, ciencia: 0 });
  assert.deepEqual(motivos, [{ tipo: "ciencia", faltam: CIENCIA_FOTO.length }]);
  assert.equal(podeContinuarFoto({ aprovadas: 6, ocupado: false, ciencia: 0 }), false);
});

test("(b) faltando foto aprovada, o motivo diz quantas faltam", () => {
  const motivos = motivosBloqueioFoto({ aprovadas: 2, ocupado: false, ciencia: CIENCIA_FOTO.length });
  assert.deepEqual(motivos, [{ tipo: "fotos", faltam: SGP_FOTOS_MIN - 2 }]);
});

test("faltando foto E confirmação, a tela mostra os dois — não um de cada vez", () => {
  const motivos = motivosBloqueioFoto({ aprovadas: 1, ocupado: false, ciencia: 2 });
  assert.deepEqual(motivos, [
    { tipo: "fotos", faltam: SGP_FOTOS_MIN - 1 },
    { tipo: "ciencia", faltam: CIENCIA_FOTO.length - 2 },
  ]);
});

test("com foto em voo, o único motivo é 'aguardando' — número no meio do upload é mentira curta", () => {
  const motivos = motivosBloqueioFoto({ aprovadas: 0, ocupado: true, ciencia: 0 });
  assert.deepEqual(motivos, [{ tipo: "ocupado" }]);
});

test("a régua não afrouxou: 1 foto a menos que o mínimo ainda bloqueia", () => {
  assert.equal(
    podeContinuarFoto({ aprovadas: SGP_FOTOS_MIN - 1, ocupado: false, ciencia: CIENCIA_FOTO.length }),
    false,
  );
});

test("(c) o que volta do banco reidrata os 5 checkboxes marcados", () => {
  assert.deepEqual(cienciaValida(TODAS), TODAS);
  assert.equal(podeContinuarFoto({ aprovadas: 6, ocupado: false, ciencia: cienciaValida(TODAS).length }), true);
});

test("(c2) rascunho parcial volta parcial, na ordem da lista da tela", () => {
  assert.deepEqual(cienciaValida(["nitida", "luz"]), ["luz", "nitida"]);
});

test("cinco cópias do mesmo item valem 1, não 5", () => {
  const repetido = Array.from({ length: 5 }, () => "luz");
  assert.deepEqual(cienciaValida(repetido), ["luz"]);
  assert.equal(podeContinuarFoto({ aprovadas: 6, ocupado: false, ciencia: cienciaValida(repetido).length }), false);
});

test("(c3) o rascunho só é gravado enquanto o aluno está NA tela 2 e não confirmou", () => {
  assert.equal(podeGuardarRascunhoCiencia({ status: "foto", ciencia_foto_at: null }), true);
});

test("depois do Continuar, o rascunho não reescreve o registro de ciência", () => {
  // Mesmo voltando pra tela 2, ciencia_foto vira o par de ciencia_foto_at.
  assert.equal(podeGuardarRascunhoCiencia({ status: "foto", ciencia_foto_at: "2026-09-13T15:31:00Z" }), false);
  assert.equal(podeGuardarRascunhoCiencia({ status: "audio", ciencia_foto_at: "2026-09-13T15:31:00Z" }), false);
  assert.equal(podeGuardarRascunhoCiencia({ status: "enviado", ciencia_foto_at: null }), false);
});

test("lixo no banco/corpo do request não vira confirmação", () => {
  assert.deepEqual(cienciaValida(["luz", "inventado", 7, null, { a: 1 }]), ["luz"]);
  assert.deepEqual(cienciaValida(null), []);
  assert.deepEqual(cienciaValida(undefined), []);
  assert.deepEqual(cienciaValida("luz"), []);
});
