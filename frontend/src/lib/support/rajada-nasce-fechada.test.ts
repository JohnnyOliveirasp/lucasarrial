/**
 * Prova da decisão "a rajada nasce fechada?" (#183).
 *
 * Esta linha errou DUAS vezes e por isso ganhou teste:
 *   1. antes de 29/08 ela nem existia — a classificação input×técnico era
 *      descartada e TODA rajada nascia `open`, inclusive arquivo ruim do aluno;
 *   2. em 29/08 ela passou a ler `alertSupport === false` como "erro do aluno".
 *      Esse campo é SOBRECARREGADO: `studio/face.ts:174` e `studio/scenes.ts:261`
 *      passam `false` em falha TÉCNICA NOSSA. Uma rajada dessas nasceria
 *      `ignored` e, como `reopened = closed && !userError`, NUNCA mais reabriria.
 *
 * Os casos (c) e (d) abaixo são exatamente esse falso negativo. Eles passam
 * hoje porque `inputError` só chega true do classificador de input de verdade.
 *
 * roda: cd frontend && npx tsx --test src/lib/support/rajada-nasce-fechada.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { rajadaNasceFechada } from "./failure-alert";

test("(a) erro de INPUT do aluno, aluno NÃO travado -> nasce fechada", () => {
  assert.equal(rajadaNasceFechada({ rawError: "no_speech", inputError: true, stuck: false }), true);
});

test("(b) mesmo erro de input, aluno TRAVADO -> nasce ABERTA (escalateStuckUser)", () => {
  assert.equal(rajadaNasceFechada({ rawError: "no_speech", inputError: true, stuck: true }), false);
});

test("(c) F4 rosto: falha técnica nossa que passa alertSupport:false -> ABERTA", () => {
  // face.ts:174 — o e-mail já saiu por segmento, aqui é só o estorno.
  // inputError NÃO é derivado de alertSupport, então tem que chegar false.
  assert.equal(
    rajadaNasceFechada({ rawError: "rosto falhou — estorno automático da tentativa", inputError: false, stuck: false }),
    false,
  );
});

test("(d) cena reprovada no QA de texto ilegível (defeito NOSSO) -> ABERTA", () => {
  // scenes.ts:261 — failScene(..., alertSupport=false)
  assert.equal(
    rajadaNasceFechada({
      rawError: "A cena saiu com texto ilegível (QA automático). Gere as cenas de novo.",
      inputError: false,
      stuck: false,
    }),
    false,
  );
});

test("(e) moderação nasce fechada SEMPRE, travado ou não (regra do Johnny 17/08)", () => {
  for (const stuck of [false, true]) {
    assert.equal(rajadaNasceFechada({ rawError: "flagged by content policy", inputError: false, stuck }), true);
    assert.equal(rajadaNasceFechada({ rawError: "NSFW detected", inputError: false, stuck }), true);
    assert.equal(rajadaNasceFechada({ rawError: "conteúdo impróprio", inputError: false, stuck }), true);
  }
});

test("(f) falha técnica genérica -> ABERTA (o caso comum, comportamento antigo)", () => {
  assert.equal(rajadaNasceFechada({ rawError: "RunPod FAILED", inputError: false, stuck: false }), false);
  assert.equal(rajadaNasceFechada({ rawError: "", inputError: false, stuck: false }), false);
});

test("(g) os 4 códigos de input do studio/finalize entram todos na válvula", () => {
  for (const e of ["audio_too_long", "video_too_long", "no_speech", "video_sem_audio"]) {
    assert.equal(rajadaNasceFechada({ rawError: e, inputError: true, stuck: false }), true, e);
  }
});
