#!/usr/bin/env node
/**
 * Abre (JA FECHADO) o incidente do defeito medido e corrigido na ronda de
 * 10/09 ~12hZ: a fronteira MIME era ADIVINHADA por formato de linha, e o
 * separador de encaminhamento do Gmail casava nela — a Fast recebia "" e
 * marcava a mensagem do aluno como lida, em silencio.
 *
 * Nasce fixed de proposito: causa medida, fix na main, deploy SUCCESS
 * conferido pelo DESFECHO do run, e o aluno afetado ja respondido. O que
 * sobrou (autorizar o reembolso dele) e decisao de dinheiro e mora no #265 +
 * grupo, nao neste defeito.
 *
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = ["marcelopersonalthe32@gmail.com"];

const TITULO =
  "A FAST OUVE SILENCIO QUANDO O ALUNO ENCAMINHA: mailText (mail-charset.ts:267) ADIVINHAVA a fronteira MIME " +
  "por formato de linha (`--` + 6 chars) e o separador do Gmail '--------- Mensagem encaminhada ---------' casava nela. " +
  "Corpo decepado no char 1, mailText devolvia '' e mail-respond.ts:256 marcava como LIDA e descartava. " +
  "Custou o pedido de saida de um pagante a 2 dias do fim da janela de reembolso dele";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 10/09 ~11-12hZ, NO MIME REAL.
Nao e a planilha (ordem de 29/08): e a caixa do suporte@ e o leitor de e-mail da Fast.

O DEFEITO, EM DUAS LINHAS DE CODIGO
frontend/src/lib/agent/mail-charset.ts, mailText(), linhas 267-268 (antes do fix):

    const boundary = seg.search(/\\r?\\n--[-=_a-zA-Z0-9]{6,}/);
    if (boundary > 0) seg = seg.slice(0, boundary);

Nao lia \`boundary=\` nenhum: adivinhava a fronteira MIME por FORMATO DE LINHA
("-- seguido de 6+ caracteres"). O Gmail abre todo encaminhamento com

    --------- Mensagem encaminhada ---------

que casa nesse padrao (\`--\` + 7 hifens). O corpo era decepado no CARACTERE 1 e
mailText devolvia STRING VAZIA.

O SEGUNDO ANDAR, QUE E O QUE TRANSFORMA BUG EM SILENCIO
frontend/src/lib/agent/mail-respond.ts:255-259:

    const text = skip ? "" : mailText(raw);
    if (skip || text.length < 5) { await markSeen(mail.uid); return "skipped"; }

Corpo com menos de 5 chars nao vira "erro", vira markSeen + skipped. A mensagem
do aluno e MARCADA COMO LIDA e sai da fila da Fast sem nunca ter sido lida por
ninguem. Nao gera alerta, nao gera bounce, nao gera chamado: gera nada.

O CUSTO, MEDIDO NUM CASO CONCRETO
marcelopersonalthe32@gmail.com, PAGANTE (R$97 cobrados em 05/09 11:17 BRT,
acesso ate 05/10, 298.950 creditos), escreveu em 09/09 19:37Z (uid 517)
encaminhando o NOSSO PROPRIO aviso de prazo. No fim da mensagem, a frase dele:

    "Eu nao quero mais seguir no programa."

E exatamente o pedido de saida que a casa tinha pedido POR ESCRITO em dois
e-mails ("me responda dizendo isso ate 11/09 que eu levo o pedido na hora" —
uid 1076 de 05/09 e uid 1382 de 09/09). O text/plain da mensagem tem 3.513
bytes e a frase esta la. A Fast recebeu 0 chars e arquivou.
A janela de reembolso da cobranca de 05/09 fecha em 12/09 00:00 — ultimo dia
util 11/09. O aluno pediu dentro do prazo e a nossa caixa transformou o pedido
dele em silencio.

PROVA NO ARQUIVO REAL (nao em fixture montada por mim)
Baixei o MIME cru do uid 517 por BODY.PEEK (FLAGS inalteradas, provado) e rodei
a mailText DE PRODUCAO em cima dele:
  antes do fix:  0 chars, frase ausente
  depois do fix: 2.905 chars, frase presente
Controle: o text/plain existe no MIME (idx 6891) e a frase esta no cru.

ALCANCE MEDIDO, COM O LIMITE DECLARADO
Comparei a mailText ANTES (extraida do git em a90e9b0^, a funcao de verdade,
nao reimplementacao minha) contra a DEPOIS, nos MIMEs REAIS de 131 mensagens do
INBOX (uids 407-556, de 01/09 13:50 BRT a 10/09 08:38 BRT). Criterio de "mudo"
e o da producao (< 5 chars), nao um limiar meu.
  recuperadas (antes muda, depois fala): 1 — o uid 517, o Marcelo.
  continuam mudas nas duas versoes: 0.
CONTROLE POSITIVO: o instrumento e obrigado a reencontrar o uid 517 e aborta se
nao reencontrar — "zero" de instrumento cego ja enganou esta casa em 07/09.
LIMITE HONESTO, QUE NAO ESTA NO NUMERO: sao as ultimas 131 de 555 mensagens da
caixa, e 19 foram puladas por passarem de 400KB. Entao o que esta medido e "1
nos ultimos 9 dias", NAO "1 na historia". Quem quiser o total tem que varrer o
resto da caixa.

POR QUE NAO E DUPLICATA (checado antes de abrir, §3.2 da ordem de 27/08)
Varri a familia inteira. Os dois vizinhos estao IGNORED e sao outro defeito:
  #261 (ab485826) — escolhe o text/plain sem conferir se esta vazio (HTML puro).
  #248 (1b5dbfa0) — o ler_caixa fica cego pra quem escreve em HTML puro.
Aqui o text/plain EXISTE, esta cheio, e e a nossa regua que o joga fora. E
defeito de fronteira, nao de escolha de parte.

A CORRECAO (em producao)
Nao alarga o palpite: PARA DE ADIVINHAR. Fronteira MIME nao se deduz do formato
da linha — vem declarada em \`boundary=\` no Content-Type. E mensagem de uma
parte so nao tem fronteira nenhuma, entao qualquer "-----" no corpo dela e
CONTEUDO, nao separador.
  - fronteirasDeclaradas(raw): colhe todo \`boundary=\`, com e sem aspas.
  - o corte usa a primeira fronteira DECLARADA que aparecer, e ela entra no
    RegExp como LITERAL (RFC 2046 permite ( ) + / ? = . , todos especiais).
  - sem fronteira declarada, nao corta nada.
PR #232, merge a90e9b0. Sem migration (funcao pura, nenhuma coluna nova), entao
nao cai no "DDL commitado != DDL aplicado".

GUARDA
28/28 em mail-charset.test.ts (era 23) e 79/79 em src/lib/agent. eslint limpo.
Os testes sao provados NAO-DECORATIVOS: restaurando a regra antiga, 2 deles
falham ("REGRESSAO Marcelo" e "fronteira com caractere especial de regex").
Um dos testes novos afirma o outro lado: a fronteira REAL continua cortando, a
parte text/html nao vaza pro texto.`;

const RESOLUCAO = `FECHADO NA MESMA RONDA EM QUE FOI ACHADO (10/09 ~12hZ), e o que o BANCO e o
GitHub confirmam DEPOIS de gravar, nao o que o script planejava fazer:

1. CAUSA: mailText adivinhava a fronteira MIME; o separador de encaminhamento
   do Gmail casava no palpite e zerava o corpo.
2. FIX EM PRODUCAO: PR #232, merge a90e9b0 na main. "Deploy Frontend
   (production)" run de 10/09 11:49:15Z — conferido o DESFECHO: completed /
   SUCCESS, headSha a90e9b0. Nao e "build verde", e o deploy do proprio sha.
3. PROVADO NO ARQUIVO REAL: uid 517, 0 chars -> 2.905 chars, com a frase do
   aluno presente.
4. ALUNO AVISADO: escrevi para marcelopersonalthe32@gmail.com em 10/09,
   copia CONFIRMADA em Enviados, uid 1592 (regra do #210). Assumi a falha,
   registrei o pedido de saida DELE COM A DATA ORIGINAL (09/09, dentro da
   janela), e disse com todas as letras que o caminho da Hotmart e dele e nao
   depende de nos — porque o prazo fecha em 11/09 e nao seria honesto pedir
   que ele espere a nossa decisao com o relogio correndo.
5. CREDITO: nada a devolver neste defeito. Os 10.000 do treino que falhou em
   10/08 ja tinham voltado no mesmo minuto; saldo 298.950 intacto.

O QUE NAO ESTA NESTE CHAMADO, DE PROPOSITO: autorizar a devolucao dos R$ 97 e
encerrar a assinatura sao decisao de dinheiro, nao sao minhas, e estao
escaladas no grupo + #265. Fechar aqui e sobre o MECANISMO que emudeceu o
aluno — esse esta consertado e provado.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "fixed",
    signature: "frank:mailtext-fronteira-mime-adivinhada",
    title: TITULO,
    description: DESCRICAO,
    occurrences: AFETADOS.length,
    affected_emails: AFETADOS,
    reported_by: "frank",
    first_seen_at: "2026-09-09T19:37:52.000Z",
    last_seen_at: agora,
    resolution_note: RESOLUCAO,
    resolved_commit: "a90e9b0",
    resolved_by: "frank",
    resolved_at: agora,
    agent_notes: [],
  };

  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(
      JSON.stringify(
        {
          ...linha,
          description: "<" + DESCRICAO.length + " chars>",
          resolution_note: "<" + RESOLUCAO.length + " chars>",
        },
        null,
        2,
      ),
    );
    return;
  }

  const { data, error } = await db
    .from("incidents")
    .insert(linha)
    .select("id, numero, title, status, resolved_commit");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify({ ...data[0], title: data[0].title.slice(0, 80) + "..." }, null, 2));
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
