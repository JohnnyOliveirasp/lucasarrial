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
import { parseBounce, pareceBounce, classificarDiagnostico, ehInterno, planoDoBounce } from "./mail-bounce.ts";

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
