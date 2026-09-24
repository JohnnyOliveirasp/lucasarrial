/**
 * Testes da montagem de mensagem do enviar_email.cjs (#559).
 *
 * O teste que IMPORTA é o primeiro: sem --em-resposta-a, a mensagem tem que
 * sair BYTE A BYTE igual ao que o script sempre montou — são 243 cartas do
 * caminho normal que não podem mudar. O padrão-ouro abaixo é a lógica antiga
 * copiada VERBATIM do enviar_email.cjs em f3ef55a9 (linhas 465-490), inclusive
 * o Content-Transfer-Encoding: base64 que impede o aluno de ler "vocÃª".
 * Se alguém mexer na montagem, este teste diz exatamente qual byte mudou.
 *
 *   node --test _frank/ferramentas/_montar_mensagem.test.cjs
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { montarMensagem } = require("./_montar_mensagem.cjs");

// ---- PADRÃO-OURO: cópia congelada da montagem antiga (f3ef55a9) ----
// Não "melhore" isto: o valor dele é ser o passado imutável contra o qual o
// presente é comparado. Data fixa no lugar de new Date() é a única diferença.
const b64Antigo = (s) => Buffer.from(s, "utf8").toString("base64");
const cabecalhoAntigo = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64Antigo(s)}?=`);
function montagemAntiga({ user, dest, bcc, assunto, html, messageId, agora }) {
  return [
    `From: Fast - FastCloner <${user}>`,
    `To: ${dest}`,
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${cabecalhoAntigo(assunto)}`,
    `Date: ${agora.toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64Antigo(html).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}
// ---- fim do padrão-ouro ----

const FIXO = {
  user: "suporte@fastcloner.com",
  messageId: "<frank-1758750000000-teste559@fastcloner.com>",
  agora: new Date("2026-09-24T21:00:00Z"),
};

// Corpo com acento e linha começando com "A" repetida pra passar de 76 colunas
// de base64 — cobre encoded-word do assunto, o wrap e o CRLF do join.
const CASOS = [
  { nome: "ascii sem bcc", dest: "aluno@x.com", bcc: null, assunto: "Seu acesso voltou", html: "<p>ola</p>" },
  {
    nome: "acento + bcc (encoded-word e wrap de 76 colunas)",
    dest: "aluno@x.com",
    bcc: "suporte@lucasarrial.com",
    assunto: "Você não está sozinho — resposta da equipe",
    html: `<p>Você já pode gerar o vídeo de novo.</p>\n<p>${"A".repeat(200)}</p>`,
  },
];

test("SEM --em-resposta-a: byte a byte igual à montagem de sempre (protege as 243 cartas do caminho normal)", () => {
  for (const c of CASOS) {
    const antiga = montagemAntiga({ ...FIXO, ...c });
    const nova = montarMensagem({ ...FIXO, ...c, emRespostaA: null });
    assert.equal(nova, antiga, `caso "${c.nome}" divergiu da montagem antiga`);
    // Cinto extra: o encoding que evita o "vocÃª" continua declarado.
    assert.match(nova, /^Content-Transfer-Encoding: base64$/m);
  }
});

test("COM --em-resposta-a: In-Reply-To e References presentes, corretos, e NADA além deles muda", () => {
  const idDoAluno = "<CAF0-carta-do-aluno@mail.gmail.com>";
  for (const c of CASOS) {
    const nova = montarMensagem({ ...FIXO, ...c, emRespostaA: idDoAluno });
    const linhas = nova.split("\r\n");

    // Os dois cabeçalhos existem, com o valor exato, logo após o Message-ID —
    // mesma posição do padrão do mail-smtp.ts:151.
    const iMsgId = linhas.indexOf(`Message-ID: ${FIXO.messageId}`);
    assert.ok(iMsgId >= 0, "Message-ID sumiu");
    assert.equal(linhas[iMsgId + 1], `In-Reply-To: ${idDoAluno}`);
    assert.equal(linhas[iMsgId + 2], `References: ${idDoAluno}`);

    // Removendo SÓ essas duas linhas, sobra exatamente a mensagem de sempre:
    // prova que a flag não arrasta nenhuma outra mudança junto.
    const semThread = linhas.filter((l, i) => i !== iMsgId + 1 && i !== iMsgId + 2).join("\r\n");
    assert.equal(semThread, montagemAntiga({ ...FIXO, ...c }), `caso "${c.nome}": a flag mudou algo além dos 2 cabeçalhos`);
  }
});

test("emRespostaA ausente (undefined) se comporta igual a null", () => {
  const c = CASOS[0];
  assert.equal(montarMensagem({ ...FIXO, ...c }), montarMensagem({ ...FIXO, ...c, emRespostaA: null }));
});
