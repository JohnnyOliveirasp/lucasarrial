/**
 * Testes de regressão da régua de áudio do treino (incidente 07745f61).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/voices/regua-audio.test.ts
 *
 * Os números vêm de casos REAIS medidos no banco em 21/08/2026, não são
 * inventados: 1174s é a voz a046ede6 (kelinnavelar), que leu a frase
 * impossível "Áudio total 20min < mínimo de 20min"; 900s (15min) é o que os
 * e-mails de 01:09 mandaram o aluno gravar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_TOTAL_SECONDS,
  MIN_USEFUL_SECONDS,
  mensagemCurtoDemais,
  minutosExibidos,
} from "./regua-audio.ts";

test("a porta é 20min brutos e o treino 10min limpos", () => {
  assert.equal(MIN_TOTAL_SECONDS, 1200);
  assert.equal(MIN_USEFUL_SECONDS, 600);
});

test("NUNCA gera a frase impossível '20min < mínimo de 20min'", () => {
  // Caso real: kelinnavelar, voz a046ede6, 1174s = 19,57min.
  // Math.round exibia 20 e a frase se contradizia na cara do aluno.
  const msg = mensagemCurtoDemais(1174);
  assert.ok(msg.includes("19min"), msg);
  assert.ok(!msg.includes("20min < mínimo de 20min"), msg);
});

test("arredonda os minutos do aluno pra BAIXO", () => {
  assert.equal(minutosExibidos(1174), 19); // 19,57 -> 19, não 20
  assert.equal(minutosExibidos(1199), 19); // 1 segundo abaixo da porta
  assert.equal(minutosExibidos(0), 0);
  assert.equal(minutosExibidos(-5), 0);
});

test("o número exibido é sempre menor que a porta quando recusa", () => {
  // Qualquer duração que o portão recusa TEM que exibir menos de 20.
  for (let s = 0; s < MIN_TOTAL_SECONDS; s += 7) {
    assert.ok(
      minutosExibidos(s) < MIN_TOTAL_SECONDS / 60,
      `${s}s exibiu ${minutosExibidos(s)}min`,
    );
  }
});

test("diz quanto falta, sempre pelo menos 1min", () => {
  assert.ok(mensagemCurtoDemais(1174).includes("Faltam ~1min"));
  assert.ok(mensagemCurtoDemais(1199).includes("Faltam ~1min"));
  // 15min é o que os e-mails de 01:09 pediram: faltam 5.
  assert.ok(mensagemCurtoDemais(900).includes("Faltam ~5min"));
});

test("diz o alvo e que nada foi cobrado", () => {
  const msg = mensagemCurtoDemais(900);
  assert.ok(msg.includes("20min"), msg);
  assert.ok(msg.includes("nada foi cobrado"), msg);
});
