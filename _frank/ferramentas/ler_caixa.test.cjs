/**
 * Testes das funções PURAS do ler_caixa (sem banco, sem rede, sem IMAP):
 *
 *   node --test _frank/ferramentas/ler_caixa.test.cjs
 *
 * POR QUE EXISTEM. A ferramenta tinha a MESMA cegueira do caminho de produção
 * (#261): escolhia o `text/plain` pela presença do cabeçalho, nunca pelo
 * conteúdo. Com o plain vazio ela imprimia "(sem corpo em texto)" — foi o
 * sintoma do #248, que fechou como `ignored` porque a causa não tinha sido
 * reproduzida. O efeito prático era o pior possível: quem abrisse a caixa na
 * mão pra investigar o silêncio da Fast via exatamente o mesmo nada que ela.
 * A ferramenta cega é o que impede a gente de enxergar o próprio bug.
 *
 * As amostras são MONTADAS à mão (estrutura de multipart/alternative de Apple
 * Mail/Gmail), não baixadas da caixa — e os endereços são fictícios porque
 * este repositório é público.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { mailText, parteDeTexto } = require("./ler_caixa.cjs");

const j = (...linhas) => linhas.join("\r\n");

const PLAIN_VAZIO_HTML_CHEIO = j(
  "From: Aluna Exemplo <aluna@example.com>",
  "To: suporte@fastcloner.com",
  "Subject: Re: Sua conta esta pronta",
  "MIME-Version: 1.0",
  'Content-Type: multipart/alternative; boundary="Apple-Mail-9F2C1B77-1D3A"',
  "",
  "--Apple-Mail-9F2C1B77-1D3A",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "",
  "--Apple-Mail-9F2C1B77-1D3A",
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "<p>N=C3=A3o consegui acessar o portal com meu e-mail de compra.</p>",
  "--Apple-Mail-9F2C1B77-1D3A--",
  "",
);

test("#261/#248: plain vazio não imprime mais '(sem corpo em texto)' — cai pro html", () => {
  const corpo = mailText(PLAIN_VAZIO_HTML_CHEIO, 4000);
  assert.notEqual(corpo, "", "corpo vazio aqui é o que virava '(sem corpo em texto)'");
  assert.match(corpo, /Não consegui acessar o portal com meu e-mail de compra/);
  assert.doesNotMatch(corpo, /=C3=A3/, "decodificou com a regra da parte errada");
  assert.doesNotMatch(corpo, /<[^>]+>/, "sobrou tag HTML");
});

test("plain com texto continua ganhando do html", () => {
  const raw = j(
    "From: Aluno Exemplo <aluno@example.com>",
    'Content-Type: multipart/alternative; boundary="b0undary-1234567"',
    "",
    "--b0undary-1234567",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Os cr=C3=A9ditos n=C3=A3o entraram.",
    "",
    "--b0undary-1234567",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<p>versao html que NAO deve aparecer</p>",
    "--b0undary-1234567--",
    "",
  );
  assert.equal(mailText(raw, 4000), "Os créditos não entraram.");
});

test("teto de chars continua valendo", () => {
  const raw = j("From: a@example.com", "Content-Type: text/plain; charset=utf-8", "", "a".repeat(500), "");
  assert.equal(mailText(raw, 120).length, 120);
});

// ------------------------------------------ o mesmo furo, via BODYSTRUCTURE

const PARTE = (numero, subtipo, bytes) => ({ numero, tipo: "TEXT", subtipo, bytes, encoding: "QUOTED-PRINTABLE" });

test("parteDeTexto: plain de 0 byte não sequestra a escolha — vai no html que TEM texto", () => {
  const escolhida = parteDeTexto([PARTE("1", "PLAIN", 0), PARTE("2", "HTML", 1840)]);
  assert.equal(escolhida.numero, "2", "escolheu o plain vazio e a mensagem sairia como 'corpo NÃO baixado'");
});

test("parteDeTexto: plain com bytes continua ganhando do html", () => {
  const escolhida = parteDeTexto([PARTE("1", "PLAIN", 320), PARTE("2", "HTML", 1840)]);
  assert.equal(escolhida.numero, "1");
});

test("parteDeTexto: nenhuma com bytes devolve a que existe (quem chama trata o 0)", () => {
  const escolhida = parteDeTexto([PARTE("1", "PLAIN", 0), PARTE("2", "HTML", 0)]);
  assert.equal(escolhida.numero, "1");
  assert.equal(parteDeTexto([]), null);
});
