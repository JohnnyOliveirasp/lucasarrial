/**
 * Testes do lado ENVIO do laço do bounce.
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/mail-envio.test.ts
 *
 * O QUE ESTES TESTES TRANCAM. O laço "escrevemos e não chegou" depende de UMA
 * coisa: o Message-ID que sai no cabeçalho ser o MESMO que volta no relatório
 * de entrega. Se esse casamento quebrar, nada estoura — a consulta simplesmente
 * devolve menos linhas do que deveria, e a casa volta a achar que avisou gente
 * que não avisou. Falha silenciosa é a única que sobrevive, então ela é o alvo.
 *
 * O CASO CENTRAL É REAL, não inventado: o `MESSAGE_ID_REAL` e o
 * `BOUNCE_REAL` abaixo vêm do uid 116 do INBOX do suporte@, lido em 13/09 com
 * EXAMINE + BODY.PEEK. É o e-mail "Sua plataforma está pronta! 🎉" que a casa
 * mandou pra leusousavedder@gmail.com em 14/08 e que o Gmail recusou com
 * 550-5.1.1 — um dos 17 alunos que ficaram em silêncio sem ninguém saber.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarMessageId, normalizarMessageId, linhaDoEnvio, marcacaoDeNaoEntregue } from "./mail-envio.ts";
import { parseBounce } from "./mail-bounce.ts";

/** uid 116, cabeçalho Message-ID do que A CASA mandou. */
const MESSAGE_ID_REAL = "<fast-1786676412715-yzp93u1361q@fastcloner.com>";

/**
 * uid 116 do INBOX do suporte@, recortado nos blocos que importam (cabeçalho
 * do relatório, o `message/delivery-status` e a cópia dos cabeçalhos do
 * original). O `Diagnostic-Code` é o texto cru do Gmail, sem edição.
 */
const BOUNCE_REAL = [
  "From: Mail Delivery System <MAILER-DAEMON@mail.privateemail.com>",
  "Subject: Undelivered Mail Returned to Sender",
  "Content-Type: multipart/report; report-type=delivery-status; boundary=\"XYZ123\"",
  "",
  "--XYZ123",
  "Content-Type: message/delivery-status",
  "",
  "Final-Recipient: rfc822; leusousavedder@gmail.com",
  "Action: failed",
  "Status: 5.1.1",
  "Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to reach does not exist.",
  "",
  "--XYZ123",
  "Content-Type: message/rfc822",
  "",
  "From: Fast - FastCloner <suporte@fastcloner.com>",
  "To: leusousavedder@gmail.com",
  "Subject: Sua plataforma esta pronta!",
  `Message-ID: ${MESSAGE_ID_REAL}`,
  "",
  "--XYZ123--",
].join("\r\n");

// ---------------------------------------------------------------- o casamento

test("O CASO REAL: o Message-ID que a casa gera casa com o que o bounce devolve", () => {
  const bounce = parseBounce(BOUNCE_REAL, []);
  assert.ok(bounce, "uid 116 tem que ser reconhecido como bounce");
  assert.equal(bounce.tipo, "falha");

  // O lado do ENVIO: a linha que teria sido gravada quando a casa mandou.
  const linha = linhaDoEnvio({
    messageId: MESSAGE_ID_REAL,
    toEmail: "leusousavedder@gmail.com",
    assunto: "Sua plataforma está pronta! 🎉",
    origem: "onboarding-aviso",
  });
  assert.ok(linha);

  // O lado do BOUNCE: a chave que o carimbo vai procurar.
  const chaveDoBounce = normalizarMessageId(bounce.messageIdOriginal);

  // ISTO é o laço. Se esta linha cair, a casa volta a não saber quem não recebeu.
  assert.equal(chaveDoBounce, linha.message_id);
});

test("gerarMessageId mantém o formato que os bounces já na caixa carregam", () => {
  // Formato preservado byte a byte: varredura pra trás precisa continuar casando.
  assert.equal(gerarMessageId(1786676412715, "yzp93u1361q"), MESSAGE_ID_REAL);
  // E o que ele gera é sempre normalizável (casa consigo mesmo).
  const novo = gerarMessageId();
  assert.equal(normalizarMessageId(novo), novo);
});

// ------------------------------------------------- a armadilha do casamento

test("normalizarMessageId casa as duas grafias que os servidores mandam", () => {
  // Com <>, sem <>, com espaço, com caixa alta: tudo é o MESMO envio. Comparar
  // string crua faria o carimbo errar em silêncio.
  const esperado = "<fast-1786676412715-yzp93u1361q@fastcloner.com>";
  for (const variante of [
    MESSAGE_ID_REAL,
    "fast-1786676412715-yzp93u1361q@fastcloner.com",
    "  <fast-1786676412715-yzp93u1361q@fastcloner.com>  ",
    "<FAST-1786676412715-YZP93U1361Q@FastCloner.com>",
  ]) {
    assert.equal(normalizarMessageId(variante), esperado, `falhou em: ${variante}`);
  }
});

test("normalizarMessageId recusa lixo em vez de criar chave que casa errado", () => {
  // Chave lixo casaria com outra chave lixo e carimbaria o envio ERRADO como
  // não-entregue — transformaria aluno atendido em vítima.
  for (const lixo of [null, undefined, "", "   ", "<>", "sem-arroba", "<sem-arroba>"]) {
    assert.equal(normalizarMessageId(lixo), null, `deveria recusar: ${JSON.stringify(lixo)}`);
  }
});

// ------------------------------------------------------------ a linha gravada

test("linhaDoEnvio normaliza a chave e o destinatário", () => {
  const linha = linhaDoEnvio({
    messageId: "fast-1-abc@fastcloner.com",
    toEmail: "  Aluno@Gmail.COM ",
    assunto: "assunto",
  });
  assert.ok(linha);
  assert.equal(linha.message_id, "<fast-1-abc@fastcloner.com>");
  assert.equal(linha.to_email, "aluno@gmail.com");
  // Chamador que não informa origem não vira null silencioso.
  assert.equal(linha.origem, "desconhecida");
  assert.equal(linha.user_id, null);
});

test("linhaDoEnvio devolve null quando a linha não serviria pro casamento", () => {
  // Sem chave, a linha não tem como ser achada por bounce nenhum: não gravar é
  // melhor do que gravar registro morto que infla a tabela e não responde nada.
  assert.equal(linhaDoEnvio({ messageId: "", toEmail: "a@b.com", assunto: "x" }), null);
  assert.equal(linhaDoEnvio({ messageId: "<a@b.com>", toEmail: "  ", assunto: "x" }), null);
});

test("linhaDoEnvio NÃO grava coluna de entrega — só o negativo é fato", () => {
  const linha = linhaDoEnvio({ messageId: "<a@b.com>", toEmail: "a@b.com", assunto: "x" });
  assert.ok(linha);
  // Se alguém adicionar `entregue: true` aqui, este teste cai — e é pra cair.
  // "O SMTP aceitou" não é "o aluno recebeu"; foi essa confusão que criou o #201.
  assert.ok(!("entregue" in linha), "não pode existir coluna de entrega presumida");
  assert.ok(!("bounce_em" in linha), "envio nasce sem carimbo de bounce");
});

// ------------------------------------------------------------------ o carimbo

test("marcacaoDeNaoEntregue guarda a classe e a prova crua do servidor", () => {
  const m = marcacaoDeNaoEntregue({
    classe: "inexistente",
    diagnostico: "smtp; 550-5.1.1   The email account\r\n that you tried to reach does not exist.",
    quando: "2026-08-14T03:00:27.000Z",
  });
  assert.equal(m.bounce_em, "2026-08-14T03:00:27.000Z");
  assert.equal(m.bounce_classe, "inexistente");
  // Espaço em branco colapsado (o DSN quebra linha no meio da frase), mas o
  // texto do servidor continua legível e sem interpretação nossa.
  assert.equal(
    m.bounce_diagnostico,
    "smtp; 550-5.1.1 The email account that you tried to reach does not exist.",
  );
});

test("marcacaoDeNaoEntregue aceita bounce sem diagnóstico sem inventar texto", () => {
  const m = marcacaoDeNaoEntregue({ classe: "desconhecida", diagnostico: null });
  assert.equal(m.bounce_classe, "desconhecida");
  // null, não "sem diagnóstico" — texto inventado num campo de prova vira
  // citação falsa na próxima vez que alguém ler a tabela.
  assert.equal(m.bounce_diagnostico, null);
});

test("marcacaoDeNaoEntregue trunca diagnóstico gigante sem quebrar", () => {
  const m = marcacaoDeNaoEntregue({ classe: "spam-saida", diagnostico: "x".repeat(5000) });
  assert.equal((m.bounce_diagnostico as string).length, 1000);
});
