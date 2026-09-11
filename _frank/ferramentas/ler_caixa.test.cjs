/**
 * Testes do parse do ler_caixa.cjs. Sem rede, sem IMAP, sem caixa viva:
 *
 *   node --test _frank/ferramentas/ler_caixa.test.cjs
 *
 * O QUE ESTES TESTES SEGURAM (#351)
 * A ferramenta tinha um PORTE do `mailText` de produção. Em 10/09 o #337 tirou
 * de produção o palpite de fronteira MIME e a cópia daqui não foi junto. O
 * palpite (`/\r?\n--[-=_a-zA-Z0-9]{6,}/`) casa na linha que o Gmail põe em TODO
 * encaminhamento — `--------- Mensagem encaminhada ---------` — então o corpo
 * era decepado no começo e a ferramenta imprimia "(sem corpo em texto)".
 *
 * Isso disparava no pior caso possível: encaminhar o nosso aviso de cobrança é
 * o que o aluno faz quando está CONTESTANDO DINHEIRO. O Vigia lê a caixa com
 * esta ferramenta em toda ronda, então o pedido virava silêncio — e silêncio
 * não vira achado. Caso real: uid 517, pagante, com a frase "Eu não quero mais
 * seguir no programa" invisível por 2 dias, janela de reembolso fechando.
 *
 * As fixtures são SINTÉTICAS e o endereço é fake de propósito: este repo é
 * público e e-mail de aluno é dado pessoal (não se commita, nem em teste).
 * A estrutura, essa sim, é a do uid 517 medida no MIME cru: multipart/
 * alternative, text/plain quoted-printable, charset UTF-8 declarado.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { mailText, header, textoDaParte, partesDoBodystructure, parteDeTexto } = require("./ler_caixa.cjs");
// `stripHtml` não é tocado por esta correção: serve pra reconstruir o mailText
// ANTIGO fielmente no teste de não-tautologia lá embaixo.
const { stripHtml } = require("../../frontend/src/lib/agent/mail-charset.ts");

// ---------- fixtures ----------

/** Texto → quoted-printable UTF-8 (só o que as fixtures precisam). */
function paraQP(s) {
  return [...Buffer.from(s, "utf8")]
    .map((b) => (b >= 0x21 && b <= 0x7e && b !== 0x3d ? String.fromCharCode(b) : b === 0x20 || b === 0x0a || b === 0x0d ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, "0")}`))
    .join("");
}

const FRASE = "Eu não quero mais seguir no programa.";

/** Encaminhamento do Gmail: a linha de "Mensagem encaminhada" ABRE o corpo. */
function encaminhamentoDoGmail(frase = FRASE) {
  const b = "00000000000062bc80065b11fd4c";
  const corpo = [
    "--------- Mensagem encaminhada ---------",
    "De: Fast - FastCloner <suporte@fastcloner.com>",
    "Data: ter., 9 de set. de 2026 às 10:50",
    "Assunto: Você foi cobrado hoje (R$97) - o prazo vai até 11/09",
    "",
    "Olá! Identificamos a cobrança de hoje no seu cartão.",
    "",
    frase,
  ].join("\r\n");
  return [
    "From: Fulano de Tal <fulano@exemplo.invalid>",
    "To: suporte@fastcloner.com",
    "Subject: Fwd: Voce foi cobrado hoje (R$97)",
    `Content-Type: multipart/alternative; boundary="${b}"`,
    "",
    `--${b}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    paraQP(corpo),
    `--${b}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    paraQP(`<div>${corpo}</div>`),
    `--${b}--`,
    "",
  ].join("\r\n");
}

// ---------- o defeito do #351 ----------

test("encaminhamento do Gmail NÃO volta vazio (o defeito do #351)", () => {
  const corpo = mailText(encaminhamentoDoGmail(), 4000);
  assert.notEqual(corpo.trim(), "", "corpo veio vazio: o palpite de fronteira voltou");
  assert.ok(corpo.includes(FRASE), `a frase do aluno sumiu do corpo: ${JSON.stringify(corpo.slice(0, 120))}`);
});

test("a linha de encaminhamento é CONTEÚDO, não separador", () => {
  const corpo = mailText(encaminhamentoDoGmail(), 4000);
  assert.ok(corpo.includes("Mensagem encaminhada"), "a linha do Gmail deveria estar no corpo");
  assert.ok(corpo.length > 200, `corpo decepado: ${corpo.length} chars`);
});

test("a fronteira DECLARADA continua cortando (o html não vaza no plain)", () => {
  const corpo = mailText(encaminhamentoDoGmail(), 4000);
  assert.ok(!corpo.includes("<div>"), "vazou a parte text/html: a fronteira declarada não cortou");
});

test("acento sobrevive (charset declarado, não tudo-ou-nada)", () => {
  const corpo = mailText(encaminhamentoDoGmail(), 4000);
  assert.ok(corpo.includes("não"), "mojibake: 'não' não sobreviveu");
  assert.ok(corpo.includes("às 10:50"), "mojibake no 'à' (C3 A0), o caso do #320");
  assert.ok(!corpo.includes("�"), "apareceu U+FFFD no texto");
});

test("mensagem de UMA parte só: '-----' no corpo é conteúdo, não fronteira", () => {
  const raw = [
    "From: Fulano <fulano@exemplo.invalid>",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    "Segue o comprovante:",
    "--------- PIX ---------",
    "valor: R$97,00",
    "Podem conferir, por favor?",
    "",
  ].join("\r\n");
  const corpo = mailText(raw, 4000);
  assert.ok(corpo.includes("PIX"), "cortou numa fronteira que não foi declarada");
  assert.ok(corpo.includes("Podem conferir"), "perdeu o fim do corpo");
});

test("--corpo N é respeitado (maxChars chega na produção)", () => {
  const corpo = mailText(encaminhamentoDoGmail(), 50);
  assert.equal(corpo.length, 50, `maxChars ignorado: ${corpo.length} chars`);
});

// ---------- PROVA DE QUE O TESTE MORDE (não é tautologia) ----------

test("o mailText ANTIGO falha nestas fixtures (senão o teste não prova nada)", () => {
  // Cópia FIEL da função que estava em ler_caixa.cjs antes desta correção
  // (só o `stripHtml` local virou o importado — é byte a byte o mesmo e não
  // foi tocado aqui). Se um dia ela passar, é porque a fixture parou de
  // reproduzir o defeito, e aí os testes acima viraram tautologia.
  function mailTextAntigo(raw, maxChars) {
    const plainIdx = raw.search(/Content-Type:\s*text\/plain/i);
    const htmlIdx = raw.search(/Content-Type:\s*text\/html/i);
    const idx = plainIdx >= 0 ? plainIdx : htmlIdx;
    let seg = idx >= 0 ? raw.slice(idx) : raw;
    const headBlock = seg.slice(0, 400);
    const start = seg.search(/\r?\n\r?\n/);
    seg = start >= 0 ? seg.slice(start) : seg;
    const boundary = seg.search(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
    if (boundary > 0) seg = seg.slice(0, boundary);
    if (/quoted-printable/i.test(headBlock)) {
      seg = seg.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    } else if (/base64/i.test(headBlock)) {
      try {
        seg = Buffer.from(seg.replace(/\s+/g, ""), "base64").toString("utf8");
      } catch {
        /* fica como está */
      }
    }
    let text = idx === htmlIdx && idx >= 0 ? stripHtml(seg) : seg.replace(/\s+/g, " ").trim();
    try {
      const round = Buffer.from(text, "latin1").toString("utf8");
      if (!/�/.test(round)) text = round;
    } catch {
      /* mantém */
    }
    return text.slice(0, maxChars);
  }

  const antigo = mailTextAntigo(encaminhamentoDoGmail(), 4000);
  assert.equal(antigo.trim(), "", `o código antigo deveria devolver VAZIO aqui, devolveu ${JSON.stringify(antigo.slice(0, 80))}`);

  const novo = mailText(encaminhamentoDoGmail(), 4000);
  assert.ok(novo.includes(FRASE), "o código novo precisa achar o que o antigo perdia");
});

// ---------- caminho da mensagem GRANDE (parte de texto sozinha) ----------

const BS_517 =
  '* 516 FETCH (UID 517 BODYSTRUCTURE (("text" "plain" ("charset" "UTF-8") NIL NIL "quoted-printable" 3513 90 NIL NIL NIL NIL)' +
  '("text" "html" ("charset" "UTF-8") NIL NIL "quoted-printable" 4173 90 NIL NIL NIL NIL) "alternative" ' +
  '("boundary" "00000000000062bc80065b11fd4c") NIL NIL NIL))';

test("BODYSTRUCTURE: o charset declarado é capturado (era descartado)", () => {
  const pt = parteDeTexto(partesDoBodystructure(BS_517));
  assert.ok(pt, "não achou a parte de texto");
  assert.equal(pt.subtipo, "PLAIN");
  assert.equal(pt.charset, "utf-8", "o CHARSET do BODYSTRUCTURE foi descartado de novo");
});

test("parte grande: acento decodificado pelo charset declarado", () => {
  const pt = { encoding: "QUOTED-PRINTABLE", charset: "utf-8", subtipo: "PLAIN" };
  const texto = textoDaParte(paraQP("Não recebi o áudio às 10:50."), pt);
  assert.equal(texto, "Não recebi o áudio às 10:50.");
});

test("parte grande: byte ruim na citação NÃO condena a frase inteira (fim do tudo-ou-nada)", () => {
  const pt = { encoding: "", charset: "utf-8", subtipo: "PLAIN" };
  // texto UTF-8 válido + 1 byte solto (0x96), o lixo típico colado numa citação
  const bytes = Buffer.concat([Buffer.from("Não consigo gerar o vídeo. ", "utf8"), Buffer.from([0x96])]);
  const texto = textoDaParte(bytes.toString("latin1"), pt);
  assert.ok(texto.includes("Não consigo gerar o vídeo."), `a frase do aluno foi destruída: ${JSON.stringify(texto)}`);
});

test("parte grande declarada latin1 é decodificada como latin1", () => {
  const pt = { encoding: "", charset: "iso-8859-1", subtipo: "PLAIN" };
  const texto = textoDaParte(Buffer.from("Não", "latin1").toString("latin1"), pt);
  assert.equal(texto, "Não");
});

// ---------- cabeçalho ----------

test("header decodifica encoded-word com charset próprio", () => {
  const raw = ["From: =?ISO-8859-1?Q?Jo=E3o_Silva?= <joao@exemplo.invalid>", "Subject: teste", ""].join("\r\n");
  assert.ok(header(raw, "From").includes("João Silva"), `encoded-word não decodificou: ${header(raw, "From")}`);
});
