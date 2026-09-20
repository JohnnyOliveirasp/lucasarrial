/**
 * Testes do parser de bounce. Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/mail-bounce.test.ts
 *
 * AS AMOSTRAS SÃO REAIS. Foram baixadas da INBOX do suporte@ em 30/08 com
 * EXAMINE + BODY.PEEK (leitura que não marca como lida) e vieram recortadas,
 * não reescritas: os uids 380, 259 e 277 existem na caixa. Isso importa porque
 * as três armadilhas que este módulo evita não são hipóteses — cada uma é uma
 * dessas mensagens:
 *
 *   uid 380 — bounce do Postfix com 550 JFE040000 do filtro de SAÍDA. É o
 *             caso do Tulio Canella do #201, e traz JUNTO o bounce da cópia
 *             interna (suporte@lucasarrial.com) no mesmo relatório.
 *   uid 259 — jellyfish, caixa cheia. `Status: 5.0.0` (permanente) com
 *             `Diagnostic-Code: 452-4.2.2` (temporário): se a classe saísse do
 *             Status, esta seria classificada errado.
 *   uid 277 — jellyfish, `Action: delayed`. NÃO é bounce. Se entrasse como
 *             falha, reabriria o caso de 5 pessoas que receberam a mensagem.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBounce,
  pareceBounce,
  classificarDiagnostico,
  ehInterno,
  planoDoBounce,
  classeComDns,
  pareceFalhaDeMx,
  pareceCaixaInexistente,
  dominioDoEmail,
} from "./mail-bounce.ts";

/** Endereços nossos, como o mail-respond monta na produção. */
const INTERNOS = ["@fastcloner.com", "@lucasarrial.com", "johnny.oliveirasp@gmail.com"];

/** parseBounce que falha o teste em vez de devolver null (encurta os casos). */
function bounceDe(raw: string) {
  const b = parseBounce(raw, INTERNOS);
  assert.ok(b, "esperava reconhecer isto como relatório de entrega");
  return b;
}

// ---------------------------------------------------------------- amostras

/** uid 380 — Postfix, 550 JFE040000, aluno + cópia interna no mesmo relatório. */
const BOUNCE_SPAM_SAIDA = [
  "Return-Path: <>",
  "Delivered-To: suporte@fastcloner.com",
  "Date: Sun, 30 Aug 2026 18:48:13 +0000 (UTC)",
  "From: Mail Delivery System <MAILER-DAEMON@mail.privateemail.com>",
  "Subject: Undelivered Mail Returned to Sender",
  "To: suporte@fastcloner.com",
  "Auto-Submitted: auto-replied",
  "MIME-Version: 1.0",
  "Content-Type: multipart/report; report-type=delivery-status;",
  '\tboundary="4hY1ND2l0Vz2x9G.1788115693/mail.privateemail.com"',
  "Message-Id: <4hY1NF2VbSz2x9J@mail.privateemail.com>",
  "",
  "--4hY1ND2l0Vz2x9G.1788115693/mail.privateemail.com",
  "Content-Description: Notification",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "This is the mail system at host mail.privateemail.com.",
  "",
  "<tuliocanella@hotmail.com>: host",
  "    prod-lbout-phx.jellyfish.systems[198.54.127.244] said: 550 Rejected due to",
  "    high probability of spam. Reason: JFE040000",
  "",
  "--4hY1ND2l0Vz2x9G.1788115693/mail.privateemail.com",
  "Content-Description: Delivery report",
  "Content-Type: message/delivery-status",
  "",
  "Reporting-MTA: dns; mail.privateemail.com",
  "X-Postfix-Sender: rfc822; suporte@fastcloner.com",
  "",
  "Final-Recipient: rfc822; tuliocanella@hotmail.com",
  "Original-Recipient: rfc822;tuliocanella@hotmail.com",
  "Action: failed",
  "Status: 5.0.0",
  "Remote-MTA: dns; prod-lbout-phx.jellyfish.systems",
  "Diagnostic-Code: smtp; 550 Rejected due to high probability of spam. Reason:",
  "    JFE040000",
  "    https://www.namecheap.com/support/knowledgebase/article.aspx/10664/2216/jellyfish-error-codes/",
  "",
  "Final-Recipient: rfc822; suporte@lucasarrial.com",
  "Original-Recipient: rfc822;suporte@lucasarrial.com",
  "Action: failed",
  "Status: 5.0.0",
  "Remote-MTA: dns; prod-lbout-phx.jellyfish.systems",
  "Diagnostic-Code: smtp; 550 Rejected due to high probability of spam. Reason:",
  "    JFE040000",
  "",
  "--4hY1ND2l0Vz2x9G.1788115693/mail.privateemail.com",
  "Content-Description: Undelivered Message",
  "Content-Type: message/rfc822",
  "",
  "Return-Path: <suporte@fastcloner.com>",
  "From: Fast - FastCloner <suporte@fastcloner.com>",
  "To: tuliocanella@hotmail.com",
  "Subject: Sobre o ritmo do seu audio - o ajuste precisa de uma caixa marcada (falha nossa)",
  "Date: Sun, 30 Aug 2026 18:48:11 GMT",
  "Message-ID: <frank-1788115691288-wmam7fq415j@fastcloner.com>",
  "",
  "PHA+T2kgVMO6bGlvLCB0dWRvIGJlbT88L3A+",
  "",
  "--4hY1ND2l0Vz2x9G.1788115693/mail.privateemail.com--",
].join("\r\n");

/** uid 259 — jellyfish, caixa cheia: Status 5.0.0 e diagnóstico 452-4.2.2. */
const BOUNCE_CAIXA_CHEIA = [
  "From: Mail Delivery Subsystem <mailer-daemon@bounces.jellyfish.systems>",
  "To: suporte@fastcloner.com",
  "X-Failed-Recipients: pc.sul157@gmail.com",
  "Auto-Submitted: auto-replied",
  "Subject: Delivery Status Notification (Failure)",
  "In-Reply-To: <4hRNWV0XP4z2x9N@mail.privateemail.com>",
  "Date: Sun, 23 Aug 2026 14:52:40 +0000",
  "MIME-Version: 1.0",
  "Content-Type: multipart/report; report-type=delivery-status;",
  ' boundary="--_NmP-b99b4debb64655ce-Part_1"',
  "",
  "----_NmP-b99b4debb64655ce-Part_1",
  "Content-Type: text/plain",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Delivery to the following recipient failed permanently:",
  "    pc.sul157@gmail.com",
  "",
  "----_NmP-b99b4debb64655ce-Part_1",
  "Content-Type: message/delivery-status",
  "",
  "Reporting-MTA: dns; out-93wp-a30.jellyfish.systems",
  "X-ZoneMTA-Sender: rfc822; suporte@fastcloner.com",
  "",
  "Final-Recipient: rfc822; pc.sul157@gmail.com",
  "Action: failed",
  "Status: 5.0.0",
  "Remote-MTA: dns; gmail-smtp-in.l.google.com",
  "Diagnostic-Code: smtp; 452-4.2.2 The recipient's inbox is out of storage space. Please direct the recipient to https://support.google.com/mail/?p=OverQuotaTemp d75a77b69052e-52e09c67cb5si29956231cf.77 - gsmtp",
  "",
  "----_NmP-b99b4debb64655ce-Part_1",
  "Content-Type: text/rfc822-headers",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "From: Fast - FastCloner <suporte@fastcloner.com>",
  "To: pc.sul157@gmail.com",
  "Subject: Re: problema na geracao",
  "Message-ID: <fast-1787406598000-abc123def@fastcloner.com>",
  "",
  "----_NmP-b99b4debb64655ce-Part_1--",
].join("\r\n");

/** uid 277 — jellyfish, ATRASO. Lista inteira num Final-Recipient só. */
const RELATORIO_DE_ATRASO = [
  "From: Mail Delivery Subsystem <mailer-daemon@bounces.jellyfish.systems>",
  "To: suporte@fastcloner.com",
  "Auto-Submitted: auto-replied",
  "Subject: Delivery Status Notification (Delay)",
  "In-Reply-To: <fast-1787580046343-n89h6hg99h@fastcloner.com>",
  "Date: Mon, 24 Aug 2026 18:06:34 +0000",
  "MIME-Version: 1.0",
  "Content-Type: multipart/report; report-type=delivery-status;",
  ' boundary="--_NmP-da5961a25bf202e2-Part_1"',
  "",
  "----_NmP-da5961a25bf202e2-Part_1",
  "Content-Type: text/plain",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Delivery incomplete",
  "",
  "There was a temporary problem delivering your message =",
  "to fabiano@fshark.com,edukrupeizak@gmail.com,johnny.oliveirasp@gmail.com,=",
  "lucas.m.arrial@gmail.com,rayanne@lucasarrial.com.",
  "",
  "Delivery will be retried=",
  ". You'll be notified if the delivery fails permanently.",
  "",
  "----_NmP-da5961a25bf202e2-Part_1",
  "Content-Type: message/delivery-status",
  "",
  "Reporting-MTA: dns; out-93wp-a21.jellyfish.systems",
  "Arrival-Date: Invalid Date",
  "",
  "Final-Recipient: rfc822; fabiano@fshark.com,edukrupeizak@gmail.com,johnny.oliveirasp@gmail.com,lucas.m.arrial@gmail.com,rayanne@lucasarrial.com",
  "Action: delayed",
  "Status: 4.0.0",
  "Diagnostic-Code: smtp; 451 Temporarily unable to process your email. Please try again later.",
  "",
  "----_NmP-da5961a25bf202e2-Part_1--",
].join("\r\n");

/** E-mail comum de aluno — a linha que não pode ser cruzada por engano. */
const EMAIL_DE_ALUNO = [
  "From: Maria <maria@gmail.com>",
  "To: suporte@fastcloner.com",
  "Subject: Meu video nao gerou",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Oi, tentei gerar e deu erro. Podem ver?",
].join("\r\n");

// ---------------------------------------------------------------- detecção

test("reconhece bounce do Postfix e do jellyfish", () => {
  for (const [nome, raw] of [
    ["postfix", BOUNCE_SPAM_SAIDA],
    ["jellyfish", BOUNCE_CAIXA_CHEIA],
    ["atraso", RELATORIO_DE_ATRASO],
  ] as const) {
    assert.equal(pareceBounce({ raw }), true, `${nome} deveria ser reconhecido como relatório de entrega`);
  }
});

test("e-mail de aluno NÃO é bounce (o falso positivo cala o aluno)", () => {
  assert.equal(pareceBounce({ raw: EMAIL_DE_ALUNO, fromEmail: "maria@gmail.com", subject: "Meu video nao gerou" }), false);
  assert.equal(parseBounce(EMAIL_DE_ALUNO, INTERNOS), null);
});

test("aluno reclamando DE bounce não vira bounce (assunto parecido, remetente humano)", () => {
  const raw = [
    "From: Joao <joao@gmail.com>",
    "To: suporte@fastcloner.com",
    "Subject: Undeliverable - nao consigo receber de voces",
    "",
    "Toda vez que voces mandam volta.",
  ].join("\r\n");
  assert.equal(parseBounce(raw, INTERNOS), null);
});

// ---------------------------------------------------------------- classes

test("550 JFE040000 é spam da NOSSA saída, não do destino", () => {
  const b = parseBounce(BOUNCE_SPAM_SAIDA, INTERNOS);
  assert.ok(b);
  assert.equal(b.tipo, "falha");
  const tulio = b.destinatarios.find((d) => d.email === "tuliocanella@hotmail.com");
  assert.ok(tulio, "o aluno tem que aparecer");
  assert.equal(tulio.classe, "spam-saida");
  assert.equal(tulio.acao, "failed");
  assert.match(tulio.diagnostico, /JFE040000/);
});

test("ARMADILHA: a classe sai do Diagnostic-Code, não do Status (5.0.0 com 452-4.2.2)", () => {
  const b = parseBounce(BOUNCE_CAIXA_CHEIA, INTERNOS);
  assert.ok(b);
  const dest = b.destinatarios[0];
  assert.equal(dest.email, "pc.sul157@gmail.com");
  // O Status do DSN diz 5.0.0 (permanente). O diagnóstico diz 452-4.2.2.
  // Quem manda é o diagnóstico: caixa cheia é temporário e reenviar funciona.
  assert.equal(dest.classe, "caixa-cheia");
});

test("classificação por diagnóstico, uma classe por causa", () => {
  assert.equal(classificarDiagnostico("smtp; 550 Rejected due to high probability of spam. Reason: JFE040000"), "spam-saida");
  assert.equal(classificarDiagnostico("smtp; 452-4.2.2 The recipient's inbox is out of storage space"), "caixa-cheia");
  assert.equal(classificarDiagnostico("smtp; 550-5.1.1 The email account that you tried to reach does not exist"), "inexistente");
  assert.equal(
    classificarDiagnostico("smtp; 550 5.7.1 Service unavailable, Client host blocked ... S3150"),
    "bloqueio-destino",
  );
  assert.equal(classificarDiagnostico("smtp; 451 Temporarily unable to process your email"), "temporaria");
  // Sem diagnóstico não se inventa classe — vira caso pra olho humano.
  assert.equal(classificarDiagnostico(""), "desconhecida");
  assert.equal(classificarDiagnostico("", "4.0.0"), "temporaria");
});

// ------------------------------------------- as 3 lacunas medidas em 13/09
// Todas saíram da varredura da caixa do suporte@ nesta data. As três caíam em
// `desconhecida`, que é a classe que NÃO ensina nada a ninguém: o chamado
// reabre, mas sem dizer se o culpado é a casa, o endereço ou o destino.

test("MESMA frase do Gmail, com e sem o código, tem que dar a MESMA classe", () => {
  // O defeito de 13/09 em uma linha: uid 607 trazia "550-5.1.1" na frente e
  // virava `inexistente`; uid 588/589/590/591/606 traziam a MESMA frase sem o
  // código e viravam `desconhecida`. Mesma causa, dois destinos.
  const COM_CODIGO =
    "smtp; 550-5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces. For more information, go to https://support.google.com/mail/?p=NoSuchUser 5a478bee46e88-33ba502862dsi25833762eec.41 - gsmtp";
  const SEM_CODIGO =
    "smtp; The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces. For more information, go to https://support.google.com/mail/?p=NoSuchUser";
  assert.equal(classificarDiagnostico(COM_CODIGO), "inexistente");
  assert.equal(classificarDiagnostico(SEM_CODIGO), "inexistente");
  assert.equal(classificarDiagnostico(COM_CODIGO), classificarDiagnostico(SEM_CODIGO));
});

test("spam de SAÍDA sem o código JFE ainda é nosso — uid 608, luctec@ (13/09)", () => {
  // O Namecheap nem sempre carimba o JFE. Sem a frase solta valendo, este
  // bounce virava `desconhecida` e a casa não ficava sabendo que quem recusou
  // foi o relay DELA. Prova de que é saída: o mesmo relatório derrubou o aluno
  // e a nossa própria cópia interna.
  assert.equal(classificarDiagnostico("smtp; 550 Rejected due to high probability of spam"), "spam-saida");
});

test("domínio com MX nulo é permanente, não 'desconhecida' — uid 605, Sheila (13/09)", () => {
  // "gmail.com.br" publica MX nulo (`0 .`, RFC 7505): declara que não aceita
  // e-mail. Ela pagou R$ 649,45 e a carta de acesso quicou 11s depois da
  // compra. Reenviar nunca vai funcionar — a orientação certa é confirmar o
  // endereço real no cadastro/Hotmart, que é a de `inexistente`.
  assert.equal(
    classificarDiagnostico(
      'smtp; DNS Error: Failed to resolve any IP addresses for the Mail Exchange (MX) server associated with "gmail.com.br"',
    ),
    "inexistente",
  );
});

test("'No MX SERVER found': a FRASE não decide mais sozinha — quem julga é o DNS (#402)", () => {
  // Texto CRU do servidor, copiado do `bounce_diagnostico` das duas linhas de
  // `emails_enviados` (guitaschetti@pradocomunicacao.com, 21:55Z e 22:10Z).
  const REAL =
    "smtp; DNS Error: DNS error occurred while resolving the Mail Exchange (MX) server " +
    "for the specified domain (pradocomunicacao.com). No MX server found";

  // ⚠️ ESTE TESTE MUDOU DE LADO, e a troca é deliberada.
  //
  // A primeira correção do #402 alargou o regex (`record|hosts?|servers?`) e
  // este teste exigia `inexistente` DA FRASE. O #284 substituiu esse desenho:
  // adivinhar a redação de cada provedor já furou três vezes no mesmo arquivo,
  // então a frase virou REDE e o juiz virou o DNS (`refinarPorDns`).
  //
  // Logo, o classificador PURO defere — `desconhecida` — e é isso que se afirma
  // aqui. Não é regressão: o veredito permanente sai do caminho com DNS, e está
  // coberto em mail-bounce-dns.test.ts.
  //
  // Por que deferir é o lado seguro quando o resolvedor não responde: errar pra
  // "continua tentando" custa um reenvio; errar pro outro lado abandona um
  // aluno alcançável. Em 14/09 eu quase declarei o guitaschetti inalcançável
  // lendo `0 dominio.com.br.` como se fosse MX nulo — e 7 e-mails nossos já
  // tinham chegado nele.
  assert.equal(classificarDiagnostico(REAL), "desconhecida");

  // As duas redações do MESMO servidor têm que dar a MESMA classe — foi a lição
  // de 13/09 (mesma frase do Gmail com e sem código dava classes diferentes).
  // Continua valendo, agora no patamar de "ambas deferem ao DNS".
  assert.equal(
    classificarDiagnostico(REAL),
    classificarDiagnostico(
      "smtp; DNS Error: DNS error occurred while resolving the Mail Exchange (MX) " +
        "server for the specified domain (outro.exemplo). No MX server found",
    ),
  );
});

test("queda transitória de DNS NÃO vira 'endereço não existe'", () => {
  // O padrão do MX é estreito de propósito. Carimbar qualquer erro de DNS como
  // permanente faria a casa parar de escrever pra um aluno alcançável.
  assert.equal(classificarDiagnostico("smtp; 451 4.4.0 DNS query timed out, try again later"), "temporaria");

  // GUARDA DO #402: `servers?` entrou na alternância, e não pode ter alargado o
  // padrão pra "DNS" solto. Estes seguem transitórios — sem o literal "no mx",
  // nada aqui casa o bloco de `inexistente`.
  assert.equal(classificarDiagnostico("smtp; 451 DNS error occurred while resolving the MX"), "temporaria");
  assert.equal(
    classificarDiagnostico("smtp; 421 4.4.3 Temporary DNS failure resolving the mail server, retrying"),
    "temporaria",
  );
});

// ------------------------------------- #402: quem julga falha de MX é o DNS
// A ferida de 13/09 reabriu em 14/09 pela TERCEIRA vez no mesmo arquivo: o
// Google escreve "No MX server found" e o padrão exigia "no mx record|hosts",
// então um bounce PERMANENTE (`pradocomunicacao.com`, sem MX e sem A) caiu em
// `desconhecida`. A correção não é a terceira redação do regex — é parar de
// julgar pela frase e perguntar ao DNS. Estes testes são sobre o SIGNIFICADO
// do veredito; a leitura do DNS em si está no `mail-bounce-dns.test.ts`.

/** O texto EXATO do bounce de `guitaschetti@pradocomunicacao.com` (14/09, 2 bounces). */
const DNS_GOOGLE_SEM_MX =
  "smtp; DNS Error: DNS error occurred while resolving the Mail Exchange (MX) server for the specified domain (pradocomunicacao.com). No MX server found";

/** O de 13/09, que a redação estreita já pegava. */
const DNS_MX_FRASE_PREVISTA =
  'smtp; DNS Error: Failed to resolve any IP addresses for the Mail Exchange (MX) server associated with "gmail.com.br"';

test("#402: 'No MX server found' com domínio sem registro é PERMANENTE, não 'desconhecida'", () => {
  // Uma palavra fora do regex ("server" em vez de "record") custou a classe
  // certa em dois bounces reais. Pela frase, isto ainda é `desconhecida` — e é
  // esse o ponto: a frase não decide mais sozinha.
  assert.equal(classificarDiagnostico(DNS_GOOGLE_SEM_MX), "desconhecida");
  // Medido no DNS: o domínio não publica MX nem A. Aí sim, permanente.
  assert.equal(classeComDns("desconhecida", DNS_GOOGLE_SEM_MX, "sem-registro"), "inexistente");
});

test("#402: domínio que RESOLVE desmente a frase — não vira 'endereço não existe'", () => {
  // Este é o medo que estava escrito no comentário do padrão estreito desde
  // sempre, e que nenhuma redação conseguia resolver: a MESMA frase sai numa
  // queda transitória de resolvedor. Com o domínio no ar, a falha foi de
  // momento — e o DNS derruba até o `inexistente` que a frase tinha cravado.
  assert.equal(classificarDiagnostico(DNS_MX_FRASE_PREVISTA), "inexistente");
  assert.equal(classeComDns("inexistente", DNS_MX_FRASE_PREVISTA, "resolve"), "temporaria");
  assert.equal(classeComDns("desconhecida", DNS_GOOGLE_SEM_MX, "resolve"), "temporaria");
});

test("#402: DNS que não respondeu NÃO vira veredito — a classe do texto fica de pé", () => {
  // SERVFAIL/timeout é ignorância nossa, não prova sobre o aluno. Carimbar
  // permanente aqui faria a casa parar de escrever pra alguém alcançável.
  assert.equal(classeComDns("desconhecida", DNS_GOOGLE_SEM_MX, "indeterminado"), "desconhecida");
  assert.equal(classeComDns("inexistente", DNS_MX_FRASE_PREVISTA, "indeterminado"), "inexistente");
});

test("#402: evidência de CAIXA inexistente ganha do DNS — 'user unknown' é sobre o endereço", () => {
  // Domínio que resolve não desmente "esta caixa não existe": são camadas
  // diferentes. Sem esta trava, um bounce que citasse DNS de passagem
  // rebaixaria um endereço morto a "falha temporária" e a casa reenviaria pra
  // sempre.
  const MISTO = "smtp; 550-5.1.1 user unknown — DNS error while resolving the Mail Exchange (MX) server";
  assert.equal(classificarDiagnostico(MISTO), "inexistente");
  assert.equal(classeComDns("inexistente", MISTO, "resolve"), "inexistente");
});

test("#402: o DNS do destino não opina sobre spam de SAÍDA nem sobre caixa cheia", () => {
  // A culpa do spam-saída é do NOSSO relay; a caixa cheia é fato do destino.
  // Deixar o DNS "corrigir" essas classes apagaria a prova que já temos.
  assert.equal(classeComDns("spam-saida", DNS_GOOGLE_SEM_MX, "sem-registro"), "spam-saida");
  assert.equal(classeComDns("caixa-cheia", DNS_GOOGLE_SEM_MX, "sem-registro"), "caixa-cheia");
  // E bounce que não culpa MX/DNS nem chega a ser consultado.
  assert.equal(pareceFalhaDeMx("smtp; 452-4.2.2 out of storage space"), false);
  assert.equal(classeComDns("caixa-cheia", "smtp; 452-4.2.2 out of storage space", "sem-registro"), "caixa-cheia");
});

test("#402: a detecção de 'isto é sobre MX/DNS' é LARGA porque não decide nada", () => {
  // Cada provedor escreve do seu jeito. Errar de menos aqui devolve a classe de
  // hoje; errar de mais custa uma consulta que responde "resolve" e não muda
  // nada — por isso ela pode ser larga, e é o que tira a gente da corrida.
  for (const frase of [
    DNS_GOOGLE_SEM_MX,
    DNS_MX_FRASE_PREVISTA,
    "smtp; 550 5.4.1 No MX hosts for domain",
    "smtp; Host or domain name not found. Name service error for name=exemplo.com type=MX",
    "smtp; 550 unrouteable address",
    "smtp; retry timeout exceeded: unable to resolve exemplo.com",
  ]) {
    assert.equal(pareceFalhaDeMx(frase), true, `deveria mandar perguntar ao DNS: ${frase}`);
  }
  assert.equal(pareceFalhaDeMx("smtp; 550 Rejected due to high probability of spam"), false);
  assert.equal(pareceFalhaDeMx("smtp; 550-5.1.1 The email account that you tried to reach does not exist"), false);
});

test("dominioDoEmail: o ponto final do ENDEREÇO é notação, não alvo de MX", () => {
  // Confusão que já custou um diagnóstico errado numa ronda: o ponto do FQDN
  // não tem nada a ver com o alvo `.` de um MX nulo.
  assert.equal(dominioDoEmail("guitaschetti@pradocomunicacao.com"), "pradocomunicacao.com");
  assert.equal(dominioDoEmail("Fulano@Exemplo.COM."), "exemplo.com");
  assert.equal(dominioDoEmail("sem-arroba"), "");
});

test("JFE ganha de 'spam' genérico: precisamos saber que o barramento foi NOSSO", () => {
  // As duas frases aparecem juntas no bounce real. Se 'blocked/policy' vencesse,
  // a gente culparia o destino por um filtro que é da nossa própria saída.
  assert.equal(
    classificarDiagnostico("smtp; 550 Rejected due to high probability of spam. Reason: JFE040000 blocked by policy"),
    "spam-saida",
  );
});

// ---------------------------------------------------------------- atraso

test("ARMADILHA: 'Action: delayed' NÃO é falha — ninguém ficou sem resposta", () => {
  const b = parseBounce(RELATORIO_DE_ATRASO, INTERNOS);
  assert.ok(b);
  assert.equal(b.tipo, "atraso");
  // Os 5 endereços da lista separada por vírgula têm que sair todos.
  assert.equal(b.destinatarios.length, 5);
  assert.ok(b.destinatarios.every((d) => d.acao === "delayed"));
});

// ---------------------------------------------------------------- interno

test("ARMADILHA: bounce da CÓPIA INTERNA não é bounce do aluno", () => {
  const b = parseBounce(BOUNCE_SPAM_SAIDA, INTERNOS);
  assert.ok(b);
  const aluno = b.destinatarios.filter((d) => !d.interno);
  const nossos = b.destinatarios.filter((d) => d.interno);
  assert.deepEqual(aluno.map((d) => d.email), ["tuliocanella@hotmail.com"]);
  assert.deepEqual(nossos.map((d) => d.email), ["suporte@lucasarrial.com"]);
});

test("ehInterno casa domínio e endereço exato, e não pega o aluno", () => {
  assert.equal(ehInterno("suporte@lucasarrial.com", INTERNOS), true);
  assert.equal(ehInterno("johnny.oliveirasp@gmail.com", INTERNOS), true);
  assert.equal(ehInterno("tuliocanella@hotmail.com", INTERNOS), false);
  // Não pode casar por "contém": um aluno com o domínio no meio do endereço.
  assert.equal(ehInterno("fake@lucasarrial.com.br", INTERNOS), false);
});

// ---------------------------------------------------------------- original

test("acha o Message-ID e o assunto do que A GENTE mandou", () => {
  const b = parseBounce(BOUNCE_SPAM_SAIDA, INTERNOS);
  assert.ok(b);
  assert.equal(b.messageIdOriginal, "<frank-1788115691288-wmam7fq415j@fastcloner.com>");
  assert.match(b.assuntoOriginal ?? "", /ritmo do seu audio/);
});

test("jellyfish: pega o original pelo text/rfc822-headers", () => {
  const b = parseBounce(BOUNCE_CAIXA_CHEIA, INTERNOS);
  assert.ok(b);
  assert.equal(b.messageIdOriginal, "<fast-1787406598000-abc123def@fastcloner.com>");
});

test("assunto original com acento vem LEGÍVEL (vira título de chamado)", () => {
  // Encoded-word real do uid 259, ainda em quoted-printable (=3D é '=').
  const raw = BOUNCE_CAIXA_CHEIA.replace(
    "Subject: Re: problema na geracao",
    "Subject: =3D?UTF-8?B?RGV2b2x2ZW1vcyBzZXVzIGNyw6lkaXRvcw==3D?=3D",
  );
  const b = parseBounce(raw, INTERNOS);
  assert.ok(b);
  assert.equal(b.assuntoOriginal, "Devolvemos seus créditos");
  assert.doesNotMatch(b.assuntoOriginal ?? "", /=\?UTF-8/, "não pode sobrar encoded-word no quadro");
});

test("sem cópia anexada, cai no In-Reply-To do próprio bounce", () => {
  const semAnexo = RELATORIO_DE_ATRASO;
  const b = parseBounce(semAnexo, INTERNOS);
  assert.ok(b);
  assert.equal(b.messageIdOriginal, "<fast-1787580046343-n89h6hg99h@fastcloner.com>");
});

// ---------------------------------------------------------------- plano

test("plano: aluno vira chamado com a CLASSE na assinatura", () => {
  const p = planoDoBounce(bounceDe(BOUNCE_SPAM_SAIDA));
  assert.equal(p.tipo, "falha");
  assert.equal(p.alunos.length, 1, "a cópia interna não pode virar chamado de aluno");
  const a = p.alunos[0];
  assert.equal(a.email, "tuliocanella@hotmail.com");
  // Sem a classe na assinatura, um aluno que hoje quica por caixa cheia e
  // amanhã por endereço inexistente somaria ocorrência no MESMO chamado e o
  // segundo problema nunca apareceria no quadro.
  assert.equal(a.signature, "fast-bounce:spam-saida:tuliocanella@hotmail.com");
});

test("plano: culpa NOSSA vai pra fila técnica; endereço do aluno vai pra atendimento", () => {
  // spam da nossa saída = existe ação nossa (reputação) → tecnico
  const nosso = planoDoBounce(bounceDe(BOUNCE_SPAM_SAIDA));
  assert.equal(nosso.alunos[0].categoria, "tecnico");
  // caixa cheia do aluno = ninguém aqui conserta; precisa de gente → atendimento
  const dele = planoDoBounce(bounceDe(BOUNCE_CAIXA_CHEIA));
  assert.equal(dele.alunos[0].categoria, "atendimento");
});

test("plano: a descrição diz que o aluno NÃO recebeu e o que fazer", () => {
  const a = planoDoBounce(bounceDe(BOUNCE_CAIXA_CHEIA)).alunos[0];
  assert.match(a.descricao, /NÃO foi entregue/);
  assert.match(a.descricao, /PRÓXIMO PASSO:/);
  // O diagnóstico cru é a prova — não pode sumir na tradução.
  assert.match(a.descricao, /452-4\.2\.2/);
  assert.match(a.motivoReabertura, /caixa-cheia/);
});

test("plano: ATRASO não gera chamado nenhum", () => {
  const p = planoDoBounce(bounceDe(RELATORIO_DE_ATRASO));
  assert.equal(p.tipo, "atraso");
  assert.equal(p.alunos.length, 0);
  assert.equal(p.interno, null);
});

test("plano: bounce só da cópia interna não toca caso de aluno, mas registra a saída suja", () => {
  // Mesmo bounce, sem o aluno: sobra só suporte@lucasarrial.com.
  const soNosso = BOUNCE_SPAM_SAIDA.replace(/tuliocanella@hotmail\.com/g, "suporte@fastcloner.com");
  const p = planoDoBounce(bounceDe(soNosso));
  assert.equal(p.alunos.length, 0, "nenhum aluno ficou sem resposta neste bounce");
  assert.ok(p.interno, "mas a saída recusando é sinal e tem que virar chamado");
  assert.equal(p.interno.categoria, "tecnico");
  assert.equal(p.interno.signature, "fast-bounce:interno:spam-saida");
});

// ---------------------------------------------------------------- truncado

test("bounce truncado (só cabeçalhos) ainda entrega o destinatário pelo X-Failed-Recipients", () => {
  const soCabecalho = [
    "From: Mail Delivery Subsystem <mailer-daemon@bounces.jellyfish.systems>",
    "To: suporte@fastcloner.com",
    "X-Failed-Recipients: pc.sul157@gmail.com",
    "Subject: Delivery Status Notification (Failure)",
    "",
  ].join("\r\n");
  const b = parseBounce(soCabecalho, INTERNOS);
  assert.ok(b);
  assert.equal(b.tipo, "falha");
  assert.deepEqual(b.destinatarios.map((d) => d.email), ["pc.sul157@gmail.com"]);
  // Sem diagnóstico a gente NÃO inventa a causa.
  assert.equal(b.destinatarios[0].classe, "desconhecida");
});

// ------------------------------------------- endereço obsoleto (#440/#441)

/**
 * O endereço que quicou ainda é o do cadastro?
 *
 * OS CASOS SÃO REAIS, medidos em 17/09 contra o banco vivo. Dos 16 chamados
 * `fast-bounce:` dos últimos 30 dias, 5 eram de endereço que não consta mais
 * em `sgp_pedidos.email` nem em `profiles.email` (#339, #378, #401, #440,
 * #441) e 11 eram de endereço VIGENTE — e são estes 11 que não podem
 * regredir: bounce de endereço bom continua abrindo chamado normal, vivo.
 *
 * A armadilha que estes testes guardam é a do `null`: "não consegui perguntar"
 * NÃO é "não achei". Confundir os dois marcaria chamado legítimo como fantasma
 * toda vez que o banco piscasse, e em silêncio.
 */
import { decidirCadastro, notaDeObsoleto, veredictoDoCadastro, type Cadastro } from "./mail-bounce-cadastro-pure.ts";

/** Porta falsa: responde o que o teste mandar, sem banco. */
function cadastroFalso(r: { emSgp: boolean | null; emProfiles: boolean | null }): Cadastro {
  return { emSgp: async () => r.emSgp, emProfiles: async () => r.emProfiles };
}

test("cadastro: endereço que AINDA é do cadastro segue vigente (chamado normal, vivo)", async () => {
  // Os 11 medidos em 17/09 — o lado que não pode regredir.
  assert.equal(decidirCadastro({ emSgp: true, emProfiles: false }), "vigente");
  assert.equal(decidirCadastro({ emSgp: false, emProfiles: true }), "vigente");
  assert.equal(decidirCadastro({ emSgp: true, emProfiles: true }), "vigente");
  assert.equal(
    await veredictoDoCadastro("lucianadox1@gmail.com", cadastroFalso({ emSgp: true, emProfiles: false })),
    "vigente",
  );
});

test("cadastro: endereço que sumiu dos DOIS cadastros é obsoleto (#440 Robério)", async () => {
  assert.equal(decidirCadastro({ emSgp: false, emProfiles: false }), "obsoleto");
  assert.equal(
    await veredictoDoCadastro("roberioaraujohairstylist@gmmail.com", cadastroFalso({ emSgp: false, emProfiles: false })),
    "obsoleto",
  );
});

test("cadastro: UMA tabela sozinha não decide — as duas são consultadas", async () => {
  // Medido: dos 11 vigentes, 1 só existe em sgp_pedidos e 8 só em profiles.
  // Quem olhasse só `profiles` marcaria o aluno do SGP como fantasma.
  assert.equal(decidirCadastro({ emSgp: true, emProfiles: false }), "vigente");
  // E quem olhasse só `sgp_pedidos` marcaria os 8 da plataforma.
  assert.equal(decidirCadastro({ emSgp: false, emProfiles: true }), "vigente");
});

test("cadastro: erro de consulta é 'não sei' e NUNCA vira obsoleto", async () => {
  // `null` = a pergunta não foi respondida. O chamado tem que nascer ABERTO.
  assert.equal(decidirCadastro({ emSgp: null, emProfiles: null }), "nao-sei");
  assert.equal(decidirCadastro({ emSgp: false, emProfiles: null }), "nao-sei");
  assert.equal(decidirCadastro({ emSgp: null, emProfiles: false }), "nao-sei");
  // Um `false` + um `null` NÃO somam "não está em lugar nenhum".
  assert.notEqual(decidirCadastro({ emSgp: false, emProfiles: null }), "obsoleto");
  assert.equal(
    await veredictoDoCadastro("alguem@exemplo.com", cadastroFalso({ emSgp: false, emProfiles: null })),
    "nao-sei",
  );
});

test("cadastro: achou na primeira tabela não pergunta à segunda", async () => {
  let perguntou = false;
  const c: Cadastro = {
    emSgp: async () => true,
    emProfiles: async () => {
      perguntou = true;
      return false;
    },
  };
  assert.equal(await veredictoDoCadastro("x@y.com", c), "vigente");
  assert.equal(perguntou, false, "consulta desnecessária ao profiles");
});

test("cadastro: porta que LANÇA não derruba a varredura, vira 'não sei'", async () => {
  // `tratarSeForBounce` não pode lançar: exceção aqui trava a fila inteira.
  const explode: Cadastro = {
    emSgp: async () => {
      throw new Error("supabase fora do ar");
    },
    emProfiles: async () => false,
  };
  assert.equal(await veredictoDoCadastro("x@y.com", explode), "nao-sei");
});

test("cadastro: endereço vazio não vira obsoleto", async () => {
  assert.equal(await veredictoDoCadastro("", cadastroFalso({ emSgp: false, emProfiles: false })), "nao-sei");
});

test("nota do obsoleto NÃO nomeia endereço substituto e proíbe trocar cadastro", () => {
  const nota = notaDeObsoleto("roberioaraujohairstylist@gmmail.com", "2026-09-17T01:00:00.000Z");
  // Diz o que foi medido...
  assert.match(nota, /não consta em/i);
  assert.match(nota, /roberioaraujohairstylist@gmmail\.com/);
  // ...e não chuta o substituto. O prefixo do Robério casa o e-mail da Hotmart
  // (roberioaraujo18@gmail.com), que é OUTRO — escrevê-lo aqui teria virado a
  // ordem de trocar um cadastro verificado e em uso. É o defeito, não a cura.
  assert.doesNotMatch(nota, /roberioaraujo18/);
  assert.doesNotMatch(nota, /cadastro atual (é|:)\s*\S+@/i);
  // E manda explicitamente NÃO trocar cadastro por causa deste chamado.
  assert.match(nota, /NÃO troque o cadastro/);
  // O caminho que funciona é procurar pelo NOME.
  assert.match(nota, /NOME/);
});

// ---------------------------------------------------------------------------
// "mailbox unavailable" do Outlook (Aline, 20/09) — e os CONTROLES NEGATIVOS.
//
// Os diagnósticos abaixo são os TEXTOS REAIS lidos de `emails_enviados` nesta
// ronda (11 bounces: temporaria 4 · desconhecida 3 · inexistente 2 ·
// caixa-cheia 2), não exemplo inventado. Se alguém mexer no padrão, o que
// segura a mão é o controle negativo: as 6 linhas que JÁ estavam certas têm
// que continuar na classe delas.
// ---------------------------------------------------------------------------

/** O texto real do bounce da Aline, na íntegra. */
const ALINE =
  "smtp; 550 5.5.0 Requested action not taken: mailbox unavailable (S2017062302). " +
  "[SJ1PEPF00002313.namprd03.prod.outlook.com 2026-09-20T10:22:13.299Z 08DF145A87CDB346]";

test("Outlook '550 5.5.0 mailbox unavailable' é caixa INEXISTENTE, não 'desconhecida'", () => {
  // A aluna pagou 10:22, a carta morreu 10:25 e ela ficou parecendo atendida.
  assert.equal(classificarDiagnostico(ALINE), "inexistente");
  assert.equal(pareceCaixaInexistente(ALINE), true);
});

test("o DNS não desmente a Aline: hotmail.com.br resolve, mas o defeito é a CAIXA", () => {
  // O bounce não culpa MX/DNS, então `classeComDns` nem opina.
  assert.equal(pareceFalhaDeMx(ALINE), false);
  assert.equal(classeComDns("inexistente", ALINE, "resolve"), "inexistente");
});

test("CONTROLE: 'mailbox unavailable' com 4xx continua TEMPORÁRIA (450 do RFC 5321)", () => {
  // Mesma frase, outro lado da cerca: 450 é caixa ocupada, reenviar funciona.
  const r450 = "smtp; 450 4.2.1 Requested mail action not taken: mailbox unavailable";
  assert.equal(classificarDiagnostico(r450), "temporaria");
  assert.equal(pareceCaixaInexistente(r450), false);
});

test("CONTROLE: 550 E 4xx no MESMO texto — o temporário ganha, não abandona o aluno", () => {
  // Caso MISTO, e é ele que faz a guarda de 4xx valer alguma coisa: o relay da
  // frente carimba o SEU 550 enquanto CITA a resposta 4xx do servidor remoto
  // (o arquivo já conhece o gênero — ver armadilha 2, Status 5.0.0 com
  // Diagnostic-Code 452-4.2.2). Sem a guarda isto viraria 'inexistente' e a
  // casa desistiria de um endereço que só estava em greylist: o erro caro, o de
  // abandonar aluno alcançável.
  const misto =
    "smtp; 550 5.5.0 Requested action not taken: mailbox unavailable; " +
    "remote host said: 451 4.7.1 Greylisted, please try again later";
  assert.equal(pareceCaixaInexistente(misto), false);
  assert.notEqual(classificarDiagnostico(misto), "inexistente");
});

test("CONTROLE: 'mailbox unavailable' com bloqueio explícito fica em bloqueio-destino", () => {
  const bloq = "smtp; 550 5.7.1 mailbox unavailable; message blocked by policy";
  assert.equal(classificarDiagnostico(bloq), "bloqueio-destino");
});

test("CONTROLE: 550 que NÃO é caixa inexistente — o spam da nossa SAÍDA (uid 608)", () => {
  // Medido, não teórico: se o padrão usasse `550` nu, este viraria 'inexistente'
  // e a casa deixaria de saber que o barramento foi DELA.
  const luctec = "smtp; 550 Rejected due to high probability of spam";
  assert.equal(classificarDiagnostico(luctec), "spam-saida");
  assert.equal(pareceCaixaInexistente(luctec), false);
});

test("CONTROLE NEGATIVO: os 4 bounces reais 'temporaria' continuam temporários", () => {
  const reais = [
    "smtp; Network error: Network error when connecting to MX server gmmail.com[64.99.64.37] for gmmail.com: Connection timed out",
    "smtp; Network error: Network error when connecting to MX server hotmaim.com[20.112.250.133] for hotmaim.com: Connection timed out",
    "smtp; Network error: Network error when connecting to MX server hotmal.com[20.70.246.20] for hotmal.com: Connection timed out",
    "smtp; Network error: Network error when connecting to MX server hormail.com[104.215.95.187] for hormail.com: Connection timed out",
  ];
  for (const d of reais) {
    assert.equal(pareceCaixaInexistente(d), false, d);
    // Estes culpam MX e o DNS é quem julga: com domínio que resolve, temporária.
    assert.equal(classeComDns(classificarDiagnostico(d), d, "resolve"), "temporaria", d);
  }
});

test("CONTROLE NEGATIVO: os 2 bounces reais de caixa CHEIA continuam caixa-cheia", () => {
  // O primeiro diz "mailbox full" (não "unavailable") e ainda é 554 permanente:
  // mesmo assim caixa-cheia ganha, porque é julgada ANTES de inexistente.
  const thallita =
    "smtp;554 5.2.2 mailbox full; STOREDRV.Deliver.Exception:QuotaExceededException." +
    "MapiExceptionStorageShutoffQuotaExceeded; Failed to process message due to a permanent exception";
  const pcsul =
    "smtp; 452-4.2.2 The recipient's inbox is out of storage space. Please direct the recipient to " +
    "https://support.google.com/mail/?p=OverQuotaTemp a92af1059eb24-144cdfc65c2si5254137c88.43 - gsmtp";
  assert.equal(classificarDiagnostico(thallita), "caixa-cheia");
  assert.equal(classificarDiagnostico(pcsul), "caixa-cheia");
  assert.equal(pareceCaixaInexistente(thallita), false);
  assert.equal(pareceCaixaInexistente(pcsul), false);
});

test("CONTROLE NEGATIVO: 552 over quota é caixa-cheia, não endereço inexistente", () => {
  const over = "smtp; 552 5.2.2 Requested mail action aborted: exceeded storage allocation (over quota)";
  assert.equal(classificarDiagnostico(over), "caixa-cheia");
});

test("CONTROLE NEGATIVO: 'No MX server found' continua na mão do DNS, não vira frase-juiz", () => {
  // As outras 2 'desconhecida' reais da tabela. Ficam assim DE PROPÓSITO (#402).
  const prado =
    "smtp; DNS Error: DNS error occurred while resolving the Mail Exchange (MX) server for the " +
    "specified domain (pradocomunicacao.com). No MX server found";
  assert.equal(classificarDiagnostico(prado), "desconhecida");
  assert.equal(pareceCaixaInexistente(prado), false);
  assert.equal(classeComDns("desconhecida", prado, "sem-registro"), "inexistente");
  assert.equal(classeComDns("desconhecida", prado, "resolve"), "temporaria");
});

test("diagnóstico vazio/null não quebra e cai em 'desconhecida'", () => {
  assert.equal(classificarDiagnostico(""), "desconhecida");
  assert.equal(classificarDiagnostico("", null), "desconhecida");
  assert.equal(classificarDiagnostico(null as unknown as string), "desconhecida");
  assert.equal(classificarDiagnostico(undefined as unknown as string), "desconhecida");
  assert.equal(pareceCaixaInexistente(null as unknown as string), false);
  assert.equal(pareceCaixaInexistente(undefined as unknown as string), false);
  // Vazio com Status 4.x continua temporário (o Status só manda sem diagnóstico).
  assert.equal(classificarDiagnostico("", "4.4.1"), "temporaria");
});
