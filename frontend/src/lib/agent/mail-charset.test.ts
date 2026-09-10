/**
 * Testes do decodificador de charset e do `mailText` (incidente #320).
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/mail-charset.test.ts
 *
 * OS CASOS SÃO REAIS. Os fixtures de bytes vêm dos uids 460, 484, 498 e 503 do
 * INBOX do suporte@, baixados em 09/09 com EXAMINE + BODY.PEEK (leitura que não
 * marca como lida — a fila da Fast é o não-lido, marcar faz ela nunca responder
 * aquele aluno). Os quatro declaram `charset "UTF-8"` no BODYSTRUCTURE, e nos
 * quatro o charset era ignorado.
 *
 * O caso que causou o DANO: uid 503, aluno de Portugal, PAGANTE (e-mail no chamado #320).
 * Às 11:21Z ele escreveu "Não consigo pagar" em text/plain UTF-8
 * quoted-printable BEM FORMADO. Às 11:25Z a Fast respondeu que o corpo "parece
 * estar vazio ou com problema de codificação" e pediu REENVIO. Às 11:29Z ele
 * respondeu "Vejam se conseguem resolver caso contrário CANCELO SUBSCRIÇÃO".
 *
 * A armadilha que estes testes trancam: o U+FFFD não vinha do e-mail do aluno —
 * ele NASCIA dentro do `mailText`, quando `.replace(/\s+/g, " ")` rodava sobre
 * a string de BYTES e comia o 0xA0 do `à` (C3 A0). Um teste que só alimente
 * bytes já quebrados NÃO pega esse defeito; por isso os casos abaixo mandam
 * bytes VÁLIDOS e cobram texto limpo na saída.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bytesDeQuotedPrintable,
  charsetDeclarado,
  decodificarBytes,
  utf8Valido,
  mailText,
  fronteirasDeclaradas,
} from "./mail-charset.ts";


// ---------- helpers: monta MIME cru como ele chega do socket (1 char = 1 byte) ----------

/** Texto → corpo quoted-printable, como um cliente de e-mail geraria. */
function paraQuotedPrintable(texto: string, charset: BufferEncoding = "utf8"): string {
  return [...Buffer.from(texto, charset)]
    .map((b) => (b >= 33 && b <= 126 && b !== 61) || b === 32 || b === 13 || b === 10
      ? String.fromCharCode(b)
      : "=" + b.toString(16).toUpperCase().padStart(2, "0"))
    .join("");
}

function mimePlain(corpoQP: string, charset = "UTF-8"): string {
  return [
    "From: aluno@exemplo.com",
    "Subject: teste",
    `Content-Type: text/plain; charset="${charset}"`,
    "Content-Transfer-Encoding: quoted-printable",
    "",
    corpoQP,
  ].join("\r\n");
}

// ---------- charsetDeclarado ----------

test("charsetDeclarado lê o charset do bloco de cabeçalho, com e sem aspas", () => {
  assert.equal(charsetDeclarado('Content-Type: text/plain; charset="UTF-8"'), "utf-8");
  assert.equal(charsetDeclarado("Content-Type: text/plain; charset=iso-8859-1"), "iso-8859-1");
  assert.equal(charsetDeclarado("Content-Type: text/plain; CHARSET=Windows-1252"), "windows-1252");
  assert.equal(charsetDeclarado("Content-Type: text/plain"), null);
});

// ---------- decodificarBytes ----------

test("UTF-8 declarado e válido decodifica exato", () => {
  const buf = Buffer.from("Não consigo pagar às 10:50 — ação", "utf8");
  assert.equal(decodificarBytes(buf, "utf-8"), "Não consigo pagar às 10:50 — ação");
});

test("latin1 declarado decodifica pelos bytes, não como UTF-8", () => {
  const buf = Buffer.from("Não é possível", "latin1");
  assert.equal(decodificarBytes(buf, "iso-8859-1"), "Não é possível");
});

test("windows-1252: aspas curvas da faixa 0x80-0x9F não viram controle invisível", () => {
  // 0x93/0x94 = “ ” no cp1252; em latin1 puro seriam caracteres de controle.
  const buf = Buffer.from([0x93, 0x6f, 0x69, 0x94, 0x20, 0x96, 0x20, 0xe9]);
  assert.equal(decodificarBytes(buf, "windows-1252"), "“oi” – é");
});

test("declaração mentirosa: diz UTF-8 mas manda latin1 puro -> cai pro single-byte", () => {
  const buf = Buffer.from("Não é possível ação", "latin1");
  // Todo caractere não-ASCII quebraria: a declaração não vale, mede e troca.
  assert.equal(decodificarBytes(buf, "utf-8"), "Não é possível ação");
});

test("declaração mentirosa ao contrário: diz latin1 mas manda UTF-8 válido", () => {
  const buf = Buffer.from("Não é possível", "utf8");
  assert.equal(decodificarBytes(buf, "iso-8859-1"), "Não é possível");
});

test("SEM tudo-ou-nada: byte ruim residual corrompe UM caractere, não o texto todo", () => {
  // 40 acentos bons + 1 byte solto no meio (o padrão real: lixo na citação).
  const bom = Buffer.from("ação ".repeat(40), "utf8");
  const buf = Buffer.concat([bom, Buffer.from([0xc3]), Buffer.from(" fim da frase", "utf8")]);
  const texto = decodificarBytes(buf, "utf-8");
  assert.ok(texto.startsWith("ação ação"), "o começo do texto tem que estar legível");
  assert.ok(texto.endsWith("fim da frase"), "o fim do texto tem que estar legível");
  assert.equal([...texto].filter((c) => c === "�").length, 1, "só 1 U+FFFD, no byte ruim");
  assert.ok(!texto.includes("Ã§"), "não pode sobrar mojibake");
});

test("charset ausente: UTF-8 válido é reconhecido sem precisar de rótulo", () => {
  assert.equal(decodificarBytes(Buffer.from("coração", "utf8"), null), "coração");
});

test("utf8Valido separa UTF-8 estrito de bytes latin1", () => {
  assert.equal(utf8Valido(Buffer.from("ação", "utf8")), true);
  assert.equal(utf8Valido(Buffer.from("ação", "latin1")), false);
});

test("buffer vazio não explode", () => {
  assert.equal(decodificarBytes(Buffer.alloc(0), "utf-8"), "");
});

// ---------- bytesDeQuotedPrintable ----------

test("quoted-printable vira BYTES (não string de bytes), soft break some", () => {
  const buf = bytesDeQuotedPrintable("N=C3=A3o consigo=\r\n pagar");
  assert.deepEqual([...buf.subarray(0, 4)], [0x4e, 0xc3, 0xa3, 0x6f]);
  assert.equal(buf.toString("utf8"), "Não consigo pagar");
});

test("'=' que não é escape hex válido é preservado como byte literal", () => {
  assert.equal(bytesDeQuotedPrintable("2 =ZZ 3").toString("utf8"), "2 =ZZ 3");
});

// ================= O TESTE OBRIGATÓRIO DO CARD =================

test("REGRESSÃO #320: fala do aluno com acento + bytes ruins SÓ na citação sai legível", () => {
  const falaDoAluno = "Não consigo pagar, já tentei três vezes às 10:50";
  const citacao = "\r\n\r\n> Olá, Duarte,\r\n> Aqui é da equipa do FastCloner. Corrigindo o que dissemos hoje de manhã,";

  // Fala nova: quoted-printable UTF-8 BEM FORMADO. Citação: 2 bytes ruins.
  const corpo =
    paraQuotedPrintable(falaDoAluno) +
    paraQuotedPrintable(citacao) +
    "=C3=28=A0"; // lixo de 2 bytes, exatamente como chega colado na citação

  const texto = mailText(mimePlain(corpo));

  assert.ok(
    texto.startsWith(falaDoAluno),
    `a fala do aluno tinha que sair inteira e legível, saiu: ${JSON.stringify(texto.slice(0, 80))}`,
  );
  assert.ok(!texto.includes("Ã£"), "não pode sobrar mojibake na fala do aluno");
  assert.ok(!texto.includes("Ã©"), "não pode sobrar mojibake na citação");
  assert.ok(texto.includes("manhã"), "a citação também tinha que sair legível");
});

test("REGRESSÃO #320: o 0xA0 do 'às' sobrevive ao colapso de espaço em branco", () => {
  // Esta é a causa de raiz: `\s` casa U+00A0, e 0xA0 é byte de continuação do
  // `à` (C3 A0). Rodar o colapso sobre BYTES comia o acento mais comum do
  // português. O texto abaixo é UTF-8 perfeito — se sair quebrado, é bug nosso.
  const texto = mailText(mimePlain(paraQuotedPrintable("escreveu às 10:50 e à noite")));
  assert.equal(texto, "escreveu às 10:50 e à noite");
  assert.equal([...texto].filter((c) => c === "�").length, 0);
});

test("REGRESSÃO #320: NBSP de verdade (C2 A0) não arrasta o acento vizinho", () => {
  // "\u00a0" é NBSP: bytes C2 A0. É o que cliente de e-mail manda em "R$\u00a0100".
  // O colapso sobre BYTES comia o A0 e deixava o C2 órfão — e o U+FFFD daí
  // condenava o texto inteiro pela guarda tudo-ou-nada. O "é" logo em seguida
  // está aí de propósito: se a ordem regredir, ele quebra junto.
  const texto = mailText(mimePlain(paraQuotedPrintable("o preço é R$\u00a0100 à vista")));
  assert.ok(texto.includes("preço"), `saiu: ${JSON.stringify(texto)}`);
  assert.ok(texto.includes("à vista"), `saiu: ${JSON.stringify(texto)}`);
  assert.ok(!texto.includes("\uFFFD"), `sobrou U+FFFD: ${JSON.stringify(texto)}`);
  assert.ok(!texto.includes("Ã"), `sobrou mojibake: ${JSON.stringify(texto)}`);
});

// ---------- mailText: caminhos que não podem regredir ----------

test("mailText: corpo latin1 declarado sai legível", () => {
  const corpo = paraQuotedPrintable("Não é possível", "latin1");
  assert.equal(mailText(mimePlain(corpo, "ISO-8859-1")), "Não é possível");
});

test("mailText: base64 UTF-8", () => {
  const raw = [
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("Olá, não consegui gerar o vídeo", "utf8").toString("base64"),
  ].join("\r\n");
  assert.equal(mailText(raw), "Olá, não consegui gerar o vídeo");
});

test("mailText: 8bit sem transfer encoding (bytes crus no socket)", () => {
  const raw = [
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    Buffer.from("Olá, é urgente", "utf8").toString("latin1"), // como vem do socket
  ].join("\r\n");
  assert.equal(mailText(raw), "Olá, é urgente");
});

test("mailText: text/html vira texto sem tag e com acento certo", () => {
  const raw = [
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    paraQuotedPrintable("<div><p>Não consigo <b>pagar</b> às 10h</p></div>"),
  ].join("\r\n");
  assert.equal(mailText(raw), "Não consigo pagar às 10h");
});

test("mailText: multipart para no boundary e prefere text/plain", () => {
  const raw = [
    'Content-Type: multipart/alternative; boundary="000000000000abac"',
    "",
    "--000000000000abac",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    paraQuotedPrintable("Não consigo pagar"),
    "--000000000000abac",
    "Content-Type: text/html; charset=UTF-8",
    "",
    "<p>Não consigo pagar</p>",
    "--000000000000abac--",
  ].join("\r\n");
  assert.equal(mailText(raw), "Não consigo pagar");
});

test("mailText: corpo vazio continua vazio (não inventa texto)", () => {
  assert.equal(mailText(mimePlain("")), "");
});

test("mailText: teto de 4000 chars (BODY_MAX) preservado", () => {
  assert.equal(mailText(mimePlain(paraQuotedPrintable("a".repeat(9000)))).length, 4000);
});

// ---------- cabeçalho (decodeWord via mailText não é exportado; testa o efeito) ----------

test("decodificarBytes cobre o encoded-word ISO-8859-1 que o Assunto usava errado", () => {
  // =?ISO-8859-1?Q?Refer=EAncia?= — antes virava U+FFFD por assumir UTF-8.
  const bytes = bytesDeQuotedPrintable("Refer=EAncia");
  assert.equal(decodificarBytes(bytes, "iso-8859-1"), "Referência");
});

// ================= FRONTEIRA MIME DECLARADA (caso Marcelo, 10/09) =================
//
// A guarda existe porque a fronteira era ADIVINHADA por formato de linha
// (`--` + 6 caracteres) e o separador de encaminhamento do Gmail
// (`--------- Mensagem encaminhada ---------`) casava nele: o corpo inteiro era
// decepado no caractere 1, `mailText` devolvia "" e `mail-respond.ts:256`
// marcava a mensagem como lida e descartava. Foi assim que o pedido de saída de
// um aluno pagante ("Eu não quero mais seguir no programa.") chegou mudo na
// Fast, a 2 dias do fim da janela de reembolso dele.

test("fronteirasDeclaradas lê boundary com e sem aspas, e não repete", () => {
  const raw = [
    'Content-Type: multipart/mixed; boundary="AAA111bbb"',
    "Content-Type: multipart/alternative; boundary=CCC222ddd",
    'Content-Type: multipart/mixed; boundary="AAA111bbb"',
  ].join("\r\n");
  assert.deepEqual(fronteirasDeclaradas(raw), ["AAA111bbb", "CCC222ddd"]);
});

test("fronteirasDeclaradas: mensagem de uma parte só não declara fronteira nenhuma", () => {
  assert.deepEqual(fronteirasDeclaradas(mimePlain("oi")), []);
});

test("REGRESSÃO Marcelo: separador de encaminhamento do Gmail NÃO é fronteira MIME", () => {
  const corpo = [
    "--------- Mensagem encaminhada ---------",
    "De: Fast - FastCloner <suporte@fastcloner.com>",
    "Assunto: o prazo vai ate 11/09",
    "",
    "(o nosso proprio aviso, citado inteiro pelo aluno)",
    "",
    "Eu nao quero mais seguir no programa.",
  ].join("\r\n");

  const raw = [
    "From: aluno@exemplo.com",
    'Content-Type: multipart/alternative; boundary="00000000000062bc80065b11fd4c"',
    "",
    "--00000000000062bc80065b11fd4c",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    paraQuotedPrintable(corpo),
    "--00000000000062bc80065b11fd4c--",
  ].join("\r\n");

  const texto = mailText(raw);
  assert.ok(
    texto.includes("Eu nao quero mais seguir no programa."),
    `a frase do aluno vem DEPOIS da citação e tinha que sobreviver, saiu: ${JSON.stringify(texto.slice(0, 120))}`,
  );
  assert.ok(texto.length > 5, "corpo < 5 chars vira markSeen+skipped em mail-respond.ts:256");
});

test("a fronteira REAL continua cortando: a parte html não vaza pro texto", () => {
  const raw = [
    "From: aluno@exemplo.com",
    'Content-Type: multipart/alternative; boundary="LIMITE-2026"',
    "",
    "--LIMITE-2026",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    paraQuotedPrintable("quero cancelar"),
    "--LIMITE-2026",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    "<p>quero cancelar</p>",
    "--LIMITE-2026--",
  ].join("\r\n");

  const texto = mailText(raw);
  assert.equal(texto, "quero cancelar");
  assert.ok(!texto.includes("<p>"), "a parte html não pode vazar pra dentro do text/plain");
});

test("fronteira com caractere especial de regex é tratada como literal", () => {
  // RFC 2046 permite ( ) + / ? = _ , - . : na fronteira — todos especiais em regex.
  const b = "a+b(c)/d?e.f";
  const raw = [
    "From: aluno@exemplo.com",
    `Content-Type: multipart/alternative; boundary="${b}"`,
    "",
    `--${b}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    paraQuotedPrintable("quero sair"),
    `--${b}--`,
  ].join("\r\n");
  assert.equal(mailText(raw), "quero sair");
});
