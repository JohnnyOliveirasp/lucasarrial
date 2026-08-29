/**
 * Incidente #184 (29/08): HTML do Drive era SEMPRE lido como "arquivo privado",
 * então a cota de download estourada virava e-mail culpando o aluno por um
 * compartilhamento que já estava certo (johnathan.ppires@gmail.com, 2 dias
 * parado com 0 vozes).
 *
 * Estes testes travam as duas metades da correção: o DIAGNÓSTICO (qual HTML é
 * qual) e o DONO (quem leva a culpa). Sem rede: o fetch e a espera são
 * injetados.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/drive.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classificarHtmlDoDrive,
  mensagemHtmlDoDrive,
  downloadDriveFile,
  downloadDriveFileToPath,
  type DriveDeps,
} from "./drive.ts";
import { classificarErro, dependeDoAluno } from "./erro-dono.ts";

// ── Corpos reais ──────────────────────────────────────────────────────────
// Medido em 29/08 na pasta do aluno: 2009 bytes, este é o miolo.
const HTML_QUOTA = `<!DOCTYPE html><html><head><title>Google Drive - Quota exceeded</title></head>
<body><p>Sorry, you can't view or download this file at this time.</p>
<p>Too many users have viewed or downloaded this file recently. Please try
accessing the file again later.</p><a href="https://accounts.google.com/">Sign in</a></body></html>`;

const HTML_LOGIN = `<!DOCTYPE html><html><head><title>Meet Google Drive</title></head>
<body><form action="https://accounts.google.com/ServiceLogin">Sign in to continue</form></body></html>`;

const HTML_ESTRANHO = `<!DOCTYPE html><html><head><title>Error 500</title></head>
<body><h1>Something went wrong</h1></body></html>`;

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

// ── 3. Retry da cota ──────────────────────────────────────────────────────

function respostaQuota(): Response {
  return new Response(HTML_QUOTA, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function respostaArquivo(corpo = "conteudo-de-video"): Response {
  return new Response(corpo, {
    status: 206,
    headers: {
      "content-type": "video/mp4",
      "content-disposition": 'attachment; filename="aula.mp4"',
    },
  });
}

/** fetch falso + relógio falso: nenhum sono real, nenhuma rede. */
function deps(respostas: Response[]): DriveDeps & { chamadas: () => number; esperas: () => number[] } {
  let i = 0;
  const esperas: number[] = [];
  return {
    fetchImpl: (async () => {
      const r = respostas[Math.min(i, respostas.length - 1)];
      i++;
      return r;
    }) as unknown as typeof fetch,
    esperar: async (ms: number) => {
      esperas.push(ms);
    },
    chamadas: () => i,
    esperas: () => esperas,
  };
}

test("cota persistente: para em 3 tentativas e lança o erro transitório", async () => {
  const d = deps([respostaQuota(), respostaQuota(), respostaQuota()]);
  await assert.rejects(
    () => downloadDriveFile(ID, 10_000_000, d),
    (e: Error) => {
      assert.match(e.message, /limitou temporariamente/i);
      assert.equal(dependeDoAluno(e.message), false);
      return true;
    },
  );
  assert.equal(d.chamadas(), 3, "exatamente 3 tentativas");
  assert.deepEqual(d.esperas(), [2_000, 5_000], "backoff só ENTRE tentativas");
});

test("cota que passa na 2ª tentativa: o arquivo é baixado, ninguém é avisado", async () => {
  const d = deps([respostaQuota(), respostaArquivo()]);
  const file = await downloadDriveFile(ID, 10_000_000, d);
  assert.equal(file.contentType, "video/mp4");
  assert.equal(file.filename, "aula.mp4");
  assert.equal(file.bytes.toString(), "conteudo-de-video");
  assert.equal(d.chamadas(), 2);
});

test("privado NÃO é retentado — 1 tentativa só, e a culpa é do aluno", async () => {
  const d = deps([
    new Response(HTML_LOGIN, { status: 200, headers: { "content-type": "text/html" } }),
  ]);
  await assert.rejects(
    () => downloadDriveFile(ID, 10_000_000, d),
    (e: Error) => {
      assert.match(e.message, /não está público/);
      assert.equal(dependeDoAluno(e.message), true);
      return true;
    },
  );
  assert.equal(d.chamadas(), 1, "sem retry: permissão não passa sozinha");
  assert.deepEqual(d.esperas(), []);
});

test("arquivo normal passa direto, sem espera", async () => {
  const d = deps([respostaArquivo("abc")]);
  const file = await downloadDriveFile(ID, 10_000_000, d);
  assert.equal(file.bytes.toString(), "abc");
  assert.equal(d.chamadas(), 1);
  assert.deepEqual(d.esperas(), []);
});

test("a variante STREAMING tem o mesmo diagnóstico e o mesmo retry", async () => {
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "drive-test-"));
  const dest = join(dir, "saida.mp4");

  // 1) cota persistente: mesma mensagem transitória, mesmas 3 tentativas.
  const d1 = deps([respostaQuota(), respostaQuota(), respostaQuota()]);
  await assert.rejects(
    () => downloadDriveFileToPath(ID, dest, 10_000_000, d1),
    (e: Error) => {
      assert.match(e.message, /limitou temporariamente/i);
      assert.equal(dependeDoAluno(e.message), false);
      return true;
    },
  );
  assert.equal(d1.chamadas(), 3);

  // 2) cota que passa: o arquivo chega ao disco de verdade.
  const d2 = deps([respostaQuota(), respostaArquivo("bytes-em-disco")]);
  const r = await downloadDriveFileToPath(ID, dest, 10_000_000, d2);
  assert.equal(r.contentType, "video/mp4");
  assert.equal((await readFile(dest)).toString(), "bytes-em-disco");
  assert.equal(d2.chamadas(), 2);
});

test("teto de bytes continua valendo depois da mudança", async () => {
  const d = deps([respostaArquivo("12345678901234567890")]);
  await assert.rejects(
    () => downloadDriveFile(ID, 5, d),
    /teto|passou de/i,
  );
});
