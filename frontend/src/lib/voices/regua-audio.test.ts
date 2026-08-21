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
  mensagemFalaLimpaInsuficiente,
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

/* ---- o outro mínimo: fala limpa do treino (incidente acf8acd6) ---------- */

test("NUNCA gera a frase impossível '~10min serviram (mínimo: 10min)'", () => {
  // Casos REAIS de training_jobs.useful_seconds, mínimo 600s.
  // dirceu.moura.cruz78 tentou 3x; a 2ª parou a 1,5 SEGUNDO do corte.
  for (const s of [594.2, 598.5, 591.1]) {
    const msg = mensagemFalaLimpaInsuficiente(s, 600);
    assert.ok(msg.includes("~9min"), `${s}s -> ${msg}`);
    assert.ok(!msg.includes("~10min serviram"), `${s}s -> ${msg}`);
  }
});

test("o número exibido é sempre MENOR que o mínimo quando recusa", () => {
  for (let s = 0; s < MIN_USEFUL_SECONDS; s += 3) {
    const msg = mensagemFalaLimpaInsuficiente(s, MIN_USEFUL_SECONDS);
    assert.ok(
      msg.includes(`~${minutosExibidos(s)}min serviram`),
      `${s}s exibiu algo diferente de ${minutosExibidos(s)}min: ${msg}`,
    );
    assert.ok(minutosExibidos(s) < MIN_USEFUL_SECONDS / 60, `${s}s`);
  }
});

test("quem falhou por segundos lê que faltou pouco, não regrava do zero", () => {
  assert.ok(mensagemFalaLimpaInsuficiente(598.5, 600).includes("menos de 1min"));
  assert.ok(mensagemFalaLimpaInsuficiente(591.1, 600).includes("menos de 1min"));
  // 6min úteis (caso ivanildezuca) não é quase-lá: tem que dizer o tamanho real.
  assert.ok(mensagemFalaLimpaInsuficiente(360, 600).includes("Faltaram ~4min"));
});

test("sem número do worker, não inventa número", () => {
  const msg = mensagemFalaLimpaInsuficiente(null, 600);
  assert.ok(msg.includes("não sobrou fala limpa suficiente"), msg);
  assert.ok(!msg.includes("~"), `não podia ter número aproximado: ${msg}`);
});

test("a mensagem continua classificável como user_dataset", () => {
  // `classifyCause` (lib/incidents/classify.ts) casa a MENSAGEM AMIGÁVEL, não o
  // código do worker. Se estes marcadores sumirem do texto, a falha de dataset
  // vira "unknown" e passa a pagear o suporte como se fosse defeito nosso —
  // exatamente o gap 4eed0e0d. Reescrever a frase sem isto é regressão.
  for (const msg of [
    mensagemFalaLimpaInsuficiente(594.2, 600),
    mensagemFalaLimpaInsuficiente(null, 600),
  ]) {
    const e = msg.toLowerCase();
    assert.ok(
      e.includes("fala limpa") || e.includes("serviram para o treino"),
      `perdeu o marcador de user_dataset: ${msg}`,
    );
  }
});

test("a recusa do treino também aponta a PORTA de 20min", () => {
  // O erro do 07745f61: mandar "grave de novo" sem dizer que a porta é 20
  // brutos faz o aluno gravar 12-15min e ser recusado de novo.
  const msg = mensagemFalaLimpaInsuficiente(594.2, 600);
  assert.ok(msg.includes("20min no total"), msg);
  assert.ok(msg.includes("créditos foram devolvidos"), msg);
});
