/**
 * Incidente #184 (29/08): HTML do Drive era SEMPRE lido como "arquivo privado",
 * então a cota de download estourada virava e-mail culpando o aluno por um
 * compartilhamento que já estava certo (johnathan.ppires@gmail.com, 2 dias
 * parado com 0 vozes).
 *
 * Estes testes travam as duas metades daquela correção: o DIAGNÓSTICO (qual
 * HTML é qual) e o DONO (quem leva a culpa). O retry e o download em pedaços
 * estão em drive.test.ts.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/drive-html.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarHtmlDoDrive, mensagemHtmlDoDrive } from "./drive.ts";
import { classificarErro, dependeDoAluno } from "./erro-dono.ts";
import { HTML_ESTRANHO, HTML_LOGIN, HTML_QUOTA } from "./drive-html.fixtures.ts";

const ID = "1AbCdEfGhIjK";

// ── 1. Diagnóstico ────────────────────────────────────────────────────────

test("cota é reconhecida como quota, não como privado", () => {
  assert.equal(classificarHtmlDoDrive(HTML_QUOTA), "quota");
});

test("a página de cota tem 'Sign in' e mesmo assim NÃO cai em privado (ordem das regras)", () => {
  // Trava a armadilha: se alguém trocar a ordem dos testes de regex, este quebra.
  assert.match(HTML_QUOTA, /Sign in/);
  assert.equal(classificarHtmlDoDrive(HTML_QUOTA), "quota");
});

test("página de login continua sendo privado", () => {
  assert.equal(classificarHtmlDoDrive(HTML_LOGIN), "privado");
});

test("HTML que não é nem cota nem login vira desconhecido", () => {
  assert.equal(classificarHtmlDoDrive(HTML_ESTRANHO), "desconhecido");
});

// ── 2. Dono do erro: quem leva a culpa ────────────────────────────────────

test("mensagem de COTA é erro NOSSO — o aluno não é avisado", () => {
  const msg = mensagemHtmlDoDrive("quota", ID);
  assert.equal(dependeDoAluno(msg), false);
  assert.equal(classificarErro(msg), "nosso");
  // E não pode acusar o aluno de nada:
  assert.doesNotMatch(msg, /não está público|permiss/i);
  assert.match(msg, /link está correto/i);
});

test("mensagem de PRIVADO continua indo pro aluno, palavra por palavra como antes", () => {
  const msg = mensagemHtmlDoDrive("privado", ID);
  assert.equal(
    msg,
    `Arquivo ${ID} não está público no Drive (veio página HTML, não o arquivo)`,
  );
  assert.equal(dependeDoAluno(msg), true);
});

test("mensagem DESCONHECIDA não afirma que é permissão", () => {
  const msg = mensagemHtmlDoDrive("desconhecido", ID);
  assert.doesNotMatch(msg, /não está público|permiss/i);
  // Pela regra invertida de 22/08 o que não é comprovadamente nosso é avisado.
  assert.equal(dependeDoAluno(msg), true);
});
