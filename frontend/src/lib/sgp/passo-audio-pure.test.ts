/**
 * Tela 3 do SGP — o que estes testes protegem:
 *
 *  1. o botão "Continuar" nunca fica cinza sem a tela dizer POR QUÊ (caso
 *     katarinadasilva98, #492: faltavam 30 SEGUNDOS de fala aprovada e a
 *     tela nunca disse — espelho do caso amanda.rosaleal na tela de foto);
 *  2. a régua NÃO afrouxou: 20–60 min de FALA aprovada + 4 itens continuam
 *     obrigatórios, e quatro cópias do mesmo item não valem quatro itens;
 *  3. o que volta do banco pra reidratar os checkboxes é higienizado (é isso
 *     que faz atualizar a página deixar de apagar as marcações).
 *
 * Rodar (Node >= 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/passo-audio-pure.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cienciaValida,
  motivosBloqueioAudio,
  podeContinuarAudio,
  podeGuardarRascunhoCienciaAudio,
} from "./passo-audio-pure.ts";
import { CIENCIA_AUDIO, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MIN_SEGUNDOS } from "./types.ts";

const TODAS = [...CIENCIA_AUDIO];

test("(d) com tudo certo, nada bloqueia — o botão acende", () => {
  const estado = { totalFala: SGP_AUDIO_MIN_SEGUNDOS, ocupado: false, ciencia: CIENCIA_AUDIO.length };
  assert.deepEqual(motivosBloqueioAudio(estado), []);
  assert.equal(podeContinuarAudio(estado), true);
});

test("(a) faltando 30 segundos de fala, o motivo diz 30 SEGUNDOS — é o caso da katarinadasilva98", () => {
  const motivos = motivosBloqueioAudio({
    totalFala: SGP_AUDIO_MIN_SEGUNDOS - 30,
    ocupado: false,
    ciencia: CIENCIA_AUDIO.length,
  });
  assert.deepEqual(motivos, [{ tipo: "fala", faltamSegundos: 30 }]);
});

test("(a2) fala fracionada arredonda pra CIMA — nunca prometer menos do que falta", () => {
  const motivos = motivosBloqueioAudio({
    totalFala: SGP_AUDIO_MIN_SEGUNDOS - 29.2,
    ocupado: false,
    ciencia: CIENCIA_AUDIO.length,
  });
  assert.deepEqual(motivos, [{ tipo: "fala", faltamSegundos: 30 }]);
});

test("(b) faltando 1 confirmação, o motivo diz que falta 1 — mesmo com fala sobrando", () => {
  const motivos = motivosBloqueioAudio({
    totalFala: SGP_AUDIO_MIN_SEGUNDOS + 60,
    ocupado: false,
    ciencia: CIENCIA_AUDIO.length - 1,
  });
  assert.deepEqual(motivos, [{ tipo: "ciencia", faltam: 1 }]);
});

test("(b2) sem marcar nada, o motivo diz que faltam os 4", () => {
  const estado = { totalFala: SGP_AUDIO_MIN_SEGUNDOS, ocupado: false, ciencia: 0 };
  assert.deepEqual(motivosBloqueioAudio(estado), [{ tipo: "ciencia", faltam: CIENCIA_AUDIO.length }]);
  assert.equal(podeContinuarAudio(estado), false);
});

test("faltando fala E confirmação, a tela mostra os dois — não um de cada vez", () => {
  const motivos = motivosBloqueioAudio({ totalFala: SGP_AUDIO_MIN_SEGUNDOS - 300, ocupado: false, ciencia: 2 });
  assert.deepEqual(motivos, [
    { tipo: "fala", faltamSegundos: 300 },
    { tipo: "ciencia", faltam: CIENCIA_AUDIO.length - 2 },
  ]);
});

test("com áudio em voo, o único motivo é 'aguardando' — número no meio da análise é mentira curta", () => {
  const motivos = motivosBloqueioAudio({ totalFala: 0, ocupado: true, ciencia: 0 });
  assert.deepEqual(motivos, [{ tipo: "ocupado" }]);
});

test("a régua não afrouxou: 1 segundo a menos que o mínimo ainda bloqueia", () => {
  assert.equal(
    podeContinuarAudio({ totalFala: SGP_AUDIO_MIN_SEGUNDOS - 1, ocupado: false, ciencia: CIENCIA_AUDIO.length }),
    false,
  );
});

test("a régua não afrouxou por cima: passar de 60 min bloqueia e diz quanto sobra", () => {
  const motivos = motivosBloqueioAudio({
    totalFala: SGP_AUDIO_MAX_SEGUNDOS + 90,
    ocupado: false,
    ciencia: CIENCIA_AUDIO.length,
  });
  assert.deepEqual(motivos, [{ tipo: "excesso", sobramSegundos: 90 }]);
  assert.equal(
    podeContinuarAudio({ totalFala: SGP_AUDIO_MAX_SEGUNDOS + 1, ocupado: false, ciencia: CIENCIA_AUDIO.length }),
    false,
  );
});

test("exatamente 60 min ainda passa — o teto é inclusivo, como sempre foi", () => {
  assert.equal(
    podeContinuarAudio({ totalFala: SGP_AUDIO_MAX_SEGUNDOS, ocupado: false, ciencia: CIENCIA_AUDIO.length }),
    true,
  );
});

test("(c) o que volta do banco reidrata os 4 checkboxes marcados", () => {
  assert.deepEqual(cienciaValida(TODAS), TODAS);
  assert.equal(
    podeContinuarAudio({ totalFala: SGP_AUDIO_MIN_SEGUNDOS, ocupado: false, ciencia: cienciaValida(TODAS).length }),
    true,
  );
});

test("(c2) rascunho parcial volta parcial, na ordem da lista da tela", () => {
  assert.deepEqual(cienciaValida(["fala_natural", "30min"]), ["30min", "fala_natural"]);
});

test("quatro cópias do mesmo item valem 1, não 4", () => {
  const repetido = Array.from({ length: 4 }, () => "silencio");
  assert.deepEqual(cienciaValida(repetido), ["silencio"]);
  assert.equal(
    podeContinuarAudio({ totalFala: SGP_AUDIO_MIN_SEGUNDOS, ocupado: false, ciencia: cienciaValida(repetido).length }),
    false,
  );
});

test("(c3) o rascunho só é gravado enquanto o aluno está NA tela 3 e não confirmou", () => {
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "audio", ciencia_audio_at: null }), true);
});

test("depois do Continuar, o rascunho não reescreve o registro de ciência", () => {
  // Mesmo voltando pra tela 3, ciencia_audio vira o par de ciencia_audio_at.
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "audio", ciencia_audio_at: "2026-09-22T15:31:00Z" }), false);
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "revisao", ciencia_audio_at: "2026-09-22T15:31:00Z" }), false);
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "enviado", ciencia_audio_at: null }), false);
});

test("lixo no banco/corpo do request não vira confirmação", () => {
  assert.deepEqual(cienciaValida(["silencio", "inventado", 7, null, { a: 1 }]), ["silencio"]);
  assert.deepEqual(cienciaValida(null), []);
  assert.deepEqual(cienciaValida(undefined), []);
  assert.deepEqual(cienciaValida("silencio"), []);
});
