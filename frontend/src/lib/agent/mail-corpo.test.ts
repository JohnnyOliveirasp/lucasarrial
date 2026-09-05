/**
 * Testes do parser de corpo. Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/mail-corpo.test.ts
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 *
 * ⚠️ HONESTIDADE SOBRE AS AMOSTRAS. Ao contrário do mail-bounce.test.ts, estas
 * NÃO foram baixadas da caixa. A mensagem que gerou o incidente #261 é o uid
 * 436 do INBOX (04/09, 7 KB) e eu não tinha credencial de IMAP no ambiente em
 * que escrevi isto (`SUPPORT_MAIL_*` ausente), então o MIME cru dela não foi
 * lido por mim. O que está aqui é MONTADO à mão seguindo a estrutura que o
 * Apple Mail e o Gmail produzem em `multipart/alternative`, com o `text/plain`
 * vazio e o texto no `text/html`.
 *
 * Pra quem tiver a credencial e quiser cravar com a mensagem REAL, o caminho
 * sancionado (EXAMINE + BODY.PEEK, não marca como lida) foi adicionado no
 * mesmo PR:
 *
 *   node _frank/ferramentas/ler_caixa.cjs --mime 436
 *
 * Ele escreve o MIME cru em `_Bugs/mime/436.eml` (pasta ignorada pelo git) e
 * imprime a prova de que as flags e a fila de não-lidos não mudaram.
 *
 * NOMES E ENDEREÇOS aqui são fictícios de propósito: este repositório é
 * público e amostra de e-mail carrega dado pessoal de aluno.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mailText, stripHtml } from "./mail-corpo.ts";

const CRLF = "\r\n";
const j = (...linhas: string[]) => linhas.join(CRLF);

// --------------------------------------------------------------- amostras

/**
 * O CASO DO #261. `multipart/alternative` com o `text/plain` VAZIO (só o
 * cabeçalho e o boundary logo em seguida) e a mensagem inteira no `text/html`.
 * Antes do fix isto devolvia "", o call site fazia markSeen calado e o aluno
 * sumia da fila sem ninguém saber.
 */
const PLAIN_VAZIO_HTML_CHEIO = j(
  "Return-Path: <aluna@example.com>",
  "From: Aluna Exemplo <aluna@example.com>",
  "To: suporte@fastcloner.com",
  "Subject: Re: Sua conta do Sistema de Geracao Pronto esta pronta",
  "Date: Thu, 4 Sep 2026 13:06:11 -0300",
  "Message-ID: <A1B2C3D4-0000-4444-8888-0123456789AB@example.com>",
  "MIME-Version: 1.0",
  'Content-Type: multipart/alternative; boundary="Apple-Mail-9F2C1B77-1D3A-4E55-9C10-77AA31C2E4B9"',
  "",
  "--Apple-Mail-9F2C1B77-1D3A-4E55-9C10-77AA31C2E4B9",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "",
  "--Apple-Mail-9F2C1B77-1D3A-4E55-9C10-77AA31C2E4B9",
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "<html><head><style>p{margin:0}</style></head><body>",
  "<p>Bom dia! N=C3=A3o consegui acessar o portal com meu e-mail de compra.</p>",
  "<p>Podem verificar, por favor?</p>",
  "</body></html>",
  "--Apple-Mail-9F2C1B77-1D3A-4E55-9C10-77AA31C2E4B9--",
  "",
);

/** O caminho feliz de sempre: plain com texto. Não pode mudar nada nele. */
const PLAIN_CHEIO = j(
  "From: Aluno Exemplo <aluno@example.com>",
  "To: suporte@fastcloner.com",
  "Subject: creditos nao entraram",
  "MIME-Version: 1.0",
  'Content-Type: multipart/alternative; boundary="b0undary-1234567"',
  "",
  "--b0undary-1234567",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Comprei ontem e os cr=C3=A9ditos n=C3=A3o entraram na minha conta.",
  "",
  "--b0undary-1234567",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Comprei ontem e os creditos nao entraram na minha conta.</p>",
  "--b0undary-1234567--",
  "",
);

/** E-mail simples, sem multipart. O corpo é a mensagem toda. */
const SEM_MULTIPART = j(
  "From: Aluno Exemplo <aluno@example.com>",
  "To: suporte@fastcloner.com",
  "Subject: duvida",
  "",
  "Minha voz saiu com a fala cortada no final. O que faco?",
  "",
);

// ------------------------------------------------------------- o incidente

test("#261: text/plain VAZIO cai pro text/html em vez de devolver string vazia", () => {
  const texto = mailText(PLAIN_VAZIO_HTML_CHEIO);

  // O que quebrava: isto era "" e virava markSeen silencioso.
  assert.notEqual(texto, "", "corpo vazio é exatamente o bug do #261");
  assert.ok(texto.length >= 5, `o call site descarta abaixo de 5 chars; veio ${texto.length}`);

  // O texto tem que chegar LEGÍVEL: quoted-printable decodificado com a regra
  // da parte HTML (não a do plain) e as tags fora.
  assert.match(texto, /Bom dia!/);
  assert.match(texto, /Não consegui acessar o portal com meu e-mail de compra/);
  assert.match(texto, /Podem verificar, por favor\?/);
});

test("#261: ao trocar de parte, o encoding usado é o da parte NOVA", () => {
  const texto = mailText(PLAIN_VAZIO_HTML_CHEIO);
  assert.notEqual(texto, "", "sem texto não há o que conferir — o fix de cima falhou");
  // Se o headBlock do plain fosse reaproveitado (ou nenhum decode rodasse),
  // o `=C3=A3` sobreviveria na tela do time e do modelo.
  assert.doesNotMatch(texto, /=C3=A3|=\r?\n/, "quoted-printable não foi decodificado na parte certa");
  // stripHtml rodou: nada de tag nem de <style> vazando.
  assert.doesNotMatch(texto, /<[^>]+>/, "sobrou tag HTML no texto");
  assert.doesNotMatch(texto, /margin:0/, "o bloco <style> vazou pro texto");
});

/**
 * A ARMADILHA DO HEADBLOCK, isolada. Aqui as duas partes declaram encodings
 * DIFERENTES: o plain (vazio) diz base64, o html diz quoted-printable. Se o
 * código cair pro html reaproveitando o headBlock do plain, ele roda
 * `Buffer.from(..., "base64")` em cima de HTML e devolve lixo binário — pior
 * que o corpo vazio, porque o lixo passa do `length < 5` e vai pro modelo.
 */
test("#261: encodings diferentes entre as partes — o html não é decodificado com a regra do plain", () => {
  const trap = j(
    "From: Aluna Exemplo <aluna@example.com>",
    "To: suporte@fastcloner.com",
    "Subject: teste da armadilha",
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="trap-8877665544"',
    "",
    "--trap-8877665544",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    "",
    "--trap-8877665544",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "<p>A gera=C3=A7=C3=A3o travou no meio.</p>",
    "--trap-8877665544--",
    "",
  );
  assert.equal(mailText(trap), "A geração travou no meio.");
});

test("#261: plain vazio de VERDADE (só espaço em branco) também cai pro html", () => {
  const soEspaco = PLAIN_VAZIO_HTML_CHEIO.replace(
    "Content-Transfer-Encoding: quoted-printable\r\n\r\n\r\n--Apple-Mail",
    "Content-Transfer-Encoding: quoted-printable\r\n\r\n   \t \r\n\r\n--Apple-Mail",
  );
  assert.notEqual(soEspaco, PLAIN_VAZIO_HTML_CHEIO, "a amostra não foi alterada — teste inútil");
  assert.match(mailText(soEspaco), /Bom dia!/);
});

// --------------------------------------------------- o que NÃO pode mudar

test("plain com texto continua ganhando do html (byte a byte o de antes)", () => {
  const texto = mailText(PLAIN_CHEIO);
  assert.equal(texto, "Comprei ontem e os créditos não entraram na minha conta.");
});

test("e-mail sem multipart: o corpo é a mensagem inteira", () => {
  assert.match(mailText(SEM_MULTIPART), /Minha voz saiu com a fala cortada no final/);
});

test("mensagem sem uma linha de texto devolve vazio — quem chama trata como evento", () => {
  const soAnexo = j(
    "From: Aluno Exemplo <aluno@example.com>",
    "To: suporte@fastcloner.com",
    "Subject: (sem texto)",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="xyz1234567"',
    "",
    "--xyz1234567",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "",
    "--xyz1234567",
    'Content-Type: image/png; name="print.png"',
    "Content-Transfer-Encoding: base64",
    "",
    "iVBORw0KGgoAAAANSUhEUg==",
    "--xyz1234567--",
    "",
  );
  assert.equal(mailText(soAnexo), "");
});

test("teto de 4000 chars continua valendo", () => {
  const gigante = j(
    "From: Aluno Exemplo <aluno@example.com>",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "a".repeat(9000),
    "",
  );
  assert.equal(mailText(gigante).length, 4000);
});

test("stripHtml tira tag, style e resolve as entidades básicas", () => {
  assert.equal(stripHtml("<style>p{color:red}</style><p>a &amp; b &lt;c&gt;</p>"), "a & b <c>");
});
