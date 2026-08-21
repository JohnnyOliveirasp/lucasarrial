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
  contarSlotsDoEnvio,
  mensagemCurtoDemais,
  mensagemEnvioIncompleto,
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

/* ───────────────────────── envio incompleto (2c5bab42) ───────────────────
 * As chaves vêm de casos REAIS medidos em 21/08: jrfengenhariadf tinha 4 de
 * 7 slots e leu "Áudio total 10min < mínimo de 20min"; leandro.fitoway tinha
 * 6 de 14 e leu a MESMA frase, pela terceira vez.
 * ------------------------------------------------------------------------ */

const chave = (i: number) => `u/v/raw/${String(i).padStart(3, "0")}_a.mp3`;

test("conta slots emitidos pela numeração da chave, sem persistir nada", () => {
  // jrfengenhariadf, voz 1858c53b: chegaram 4, o maior índice é 006 → 7 slots.
  const c = contarSlotsDoEnvio([0, 1, 3, 6].map(chave));
  assert.deepEqual(c, { esperados: 7, chegaram: 4, faltando: 3, ignorados: 0 });
});

test("envio COMPLETO não acusa buraco", () => {
  const c = contarSlotsDoEnvio([0, 1, 2, 3].map(chave));
  assert.deepEqual(c, { esperados: 4, chegaram: 4, faltando: 0, ignorados: 0 });
});

test("arquivo truncado (no bucket, fora do filtro) conta como faltando", () => {
  // 002 existe no R2 mas com poucos bytes: não vira treino. Pro aluno o
  // efeito é o mesmo, e o total precisa refletir isso.
  const c = contarSlotsDoEnvio([0, 1, 3].map(chave), [0, 1, 2, 3].map(chave));
  assert.deepEqual(c, { esperados: 4, chegaram: 3, faltando: 1, ignorados: 0 });
});

test("sem numeração legível devolve zeros — nunca 'não faltou nada'", () => {
  // Caminho do Drive / import antigo: chave sem o prefixo NNN_.
  const c = contarSlotsDoEnvio(["u/v/raw/audio.mp3", "u/v/outro.mp3"]);
  assert.deepEqual(c, { esperados: 0, chegaram: 0, faltando: 0, ignorados: 0 });
});

/* --------------------------------------------------------------------------
 * SLOT COM FOTO NÃO É BURACO — regressão do falso positivo MEDIDO em 21/08
 * na voz 8aca0126 (csitya100). O import do Drive numera TODO arquivo da
 * pasta, inclusive as fotos/PDFs que o `910ea757` mandou ignorar. Antes
 * deste fix a recusa dizia "recebemos apenas 7 dos 20 arquivos — 13 não
 * chegaram até nós": a casa se acusando de perder 6 JPEG + 7 PDF que nunca
 * foram áudio, e mandando o aluno reenviar foto.
 * ------------------------------------------------------------------------ */

const chaveExt = (i: number, ext: string) =>
  `u/v/raw/${String(i).padStart(3, "0")}_a.${ext}`;

test("slot ocupado por FOTO/PDF sai da conta — não é arquivo perdido", () => {
  // A voz REAL do csitya100: 000 mp3 · 001-006 jpeg · 007-012 mp4 · 013-019 pdf.
  const todas = [
    chaveExt(0, "mp3"),
    ...[1, 2, 3, 4, 5, 6].map((i) => chaveExt(i, "jpeg")),
    ...[7, 8, 9, 10, 11, 12].map((i) => chaveExt(i, "mp4")),
    ...[13, 14, 15, 16, 17, 18, 19].map((i) => chaveExt(i, "pdf")),
  ];
  const utilizaveis = todas.filter((k) => /\.(mp3|mp4)$/.test(k));
  const c = contarSlotsDoEnvio(utilizaveis, todas);
  // 20 slots - 13 não-áudio = 7 esperados, e os 7 chegaram: ZERO buraco.
  assert.deepEqual(c, { esperados: 7, chegaram: 7, faltando: 0, ignorados: 13 });
});

test("foto ignorada NÃO esconde o áudio que sumiu de verdade", () => {
  // 000 mp3 ok · 001 jpeg (ignorado) · 002 mp3 NUNCA chegou · 003 mp3 ok.
  const todas = [chaveExt(0, "mp3"), chaveExt(1, "jpeg"), chaveExt(3, "mp3")];
  const utilizaveis = [chaveExt(0, "mp3"), chaveExt(3, "mp3")];
  const c = contarSlotsDoEnvio(utilizaveis, todas);
  assert.deepEqual(c, { esperados: 3, chegaram: 2, faltando: 1, ignorados: 1 });
});

test("a recusa por envio incompleto NÃO manda o aluno gravar mais", () => {
  // O estrago do 2c5bab42: mandar "grave mais" pra quem já gravou o dobro e
  // teve metade perdida no NOSSO envio.
  const msg = mensagemEnvioIncompleto(617, 4, 7);
  assert.ok(msg.includes("4 dos 7"), msg);
  assert.ok(/envie de novo/i.test(msg), msg);
  // Nao prometer retomada: o produto NAO tem resume, o aluno recria a voz.
  assert.ok(!/de onde parou|retoma/i.test(msg), msg);
  assert.ok(msg.includes("Não é que você gravou pouco"), msg);
  assert.ok(!/grave mais|adicione mais gravação/i.test(msg), msg);
});

test("o minuto do envio incompleto também arredonda pra BAIXO", () => {
  // Mesmo compromisso da porta: nunca exibir um número que se contradiz.
  assert.ok(mensagemEnvioIncompleto(1174, 6, 14).includes("~19min"));
});

test("UM arquivo perdido concorda no singular", () => {
  // Caso real: voz `99379e28` (catarinacouras), 4 de 5 — lia "1 não chegaram".
  const msg = mensagemEnvioIncompleto(1080, 4, 5);
  assert.ok(msg.includes("1 não chegou até nós"), msg);
  assert.ok(!msg.includes("não chegaram"), msg);
});

test("mais de um arquivo perdido continua no plural", () => {
  const msg = mensagemEnvioIncompleto(617, 4, 7);
  assert.ok(msg.includes("3 não chegaram até nós"), msg);
});
