#!/usr/bin/env node
/**
 * Abre o incidente medido na ronda do VIGIA de 25/09 16hZ:
 * o instrumento que caca "conserto pronto e parado" devolve UNKNOWN pra TODOS
 * os PRs na primeira rodada e a resposta completa na segunda, sem nenhuma
 * mudanca de codigo. Quem roda uma vez so le "nao sei" e segue em frente.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "O INSTRUMENTO QUE CACA CONSERTO PRONTO E PARADO DEVOLVE 'NAO SEI' NA 1a RODADA E A RESPOSTA NA 2a: " +
  "2026-09-24_conserto_pronto_e_parado.cjs:94-99 pede mergeabilidade ao GitHub UMA vez por PR e nao tem " +
  "retentativa — medido nesta ronda, rodada 1 = 69 UNKNOWN e 'nao acredite em nenhum numero', rodadas 2 e 3 " +
  "(mesmo codigo, ~8min depois) = 48 consertos prontos sem merge, 24 parados ha 3d+, 21 apodrecidos, mais velho 36d";

const DESCRICAO = `MEDIDO POR MIM (VIGIA) NA RONDA DE 25/09 16hZ, EM PRODUCAO.

O QUE ESTE CARTAO AFIRMA
O instrumento nao mente e nao inventa: quando o GitHub devolve UNKNOWN ele
RECUSA a responder, de proposito, e isso e bom. O defeito e que ele recusa
DEPOIS DE UMA UNICA TENTATIVA, e a tentativa seguinte funciona. Resultado
pratico: a ronda que roda o instrumento uma vez — que e o jeito como toda ronda
o roda — recebe "nao sei" e segue em frente, e a fila de consertos prontos fica
invisivel naquele dia.

O EXPERIMENTO, QUE E O CORACAO DESTE CARTAO
Tres execucoes do MESMO comando, sem tocar em uma linha de codigo, na mesma
ronda, na mesma maquina, na mesma credencial:

  rodada 1  ->  "69 PR(s) voltaram UNKNOWN (o GitHub nao calculou a
                mergeabilidade). Nao acredite em nenhum numero desta rodada."
  rodada 2  ->  48 conserto(s) pronto(s) sem merge · 24 parado(s) ha 3d+ ·
                21 ja apodrecido(s) · mais velho 36d
  rodada 3  ->  48 · 24 · 21 · 36d   (identica a 2)

Entre a 1 e a 2 passaram ~8 minutos e NENHUMA alteracao. A rodada 1 foi a
outlier; as duas seguintes concordam entre si.

ONDE, COM ARQUIVO E LINHA
  _frank/ferramentas/2026-09-24_conserto_pronto_e_parado.cjs:90-99
    // Um \`pr view\` por PR: e o UNICO jeito de o GitHub calcular mergeable.
    // (ver "ARMADILHA MEDIDA" no cabecalho — o \`list\` devolve UNKNOWN pra todos)
    gh(["pr", "view", String(n), "--json",
        "number,title,createdAt,mergeable,mergeStateStatus,isDraft,headRefName"])

O cabecalho do proprio arquivo (linhas 49-61) JA documenta a armadilha do
\`pr list\` e JA escolheu o caminho certo (um \`pr view\` por PR). O buraco que
sobrou e o degrau de baixo: a chamada e feita UMA vez e o resultado UNKNOWN nao
e retentado. Em :113 o script aborta a rodada inteira quando sobra UNKNOWN —
comportamento honesto, mas que sem retentativa transforma uma resposta obtivel
em silencio.

CONTROLE INDEPENDENTE, NA MESMA JANELA
Enquanto a rodada 1 dizia UNKNOWN pros 69, eu consultei UM PR a mao:
  gh pr view 446 --json mergeable,mergeStateStatus
  -> {"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN"}
Ou seja: o dado ESTAVA disponivel. O instrumento nao estava vendo o que outra
chamada, na mesma hora e com a mesma credencial, via.

O CUSTO, MEDIDO E NAO ADJETIVADO
O que a rodada 1 teria escondido da ronda de hoje:
  48 consertos prontos sem merge
  24 parados ha 3 dias ou mais
  21 ja apodrecidos
  36d o mais velho (PR #9)
E nao e hipotetico que isso importe HOJE: o conserto do #573 (a tela de cadastro
que promete codigo pra quem ja tem conta) esta no PR #446, MERGEABLE e CLEAN,
aberto desde 25/09 14:33:53Z, e o cartao segue \`open\`. O instrumento existe
exatamente pra ninguem esquecer um PR desses.

POR QUE ISTO E ERRO DE SISTEMA E NAO PROCESSO (teste de bolso da ordem de 27/08)
"Se o codigo estivesse certo, isso nao teria acontecido?" — SIM. Uma retentativa
no :96 faz a rodada 1 devolver o mesmo que a 2. Nao depende de ninguem lembrar
de nada, nao depende de disciplina de ronda.

O CONSERTO, QUE NAO E ALCADA DE SENSOR
Retentar os PRs que voltaram UNKNOWN (uma segunda passada basta nas 3 medicoes
de hoje), e so abortar se sobrar UNKNOWN DEPOIS da retentativa. Duas coisas
medidas pra quem for consertar:
  (a) a retentativa precisa ser do \`pr view\` individual, nao do \`pr list\` —
      o \`list\` devolve UNKNOWN sempre, e isso o cabecalho ja provou em 24/09;
  (b) a segunda passada NAO precisa de espera longa: ~8 min separaram minhas
      rodadas, mas o custo real e de 1 chamada extra por PR cego, nao de sleep.

LIMITES DECLARADOS (o que eu NAO provei)
- NAO isolei o mecanismo. A leitura mais provavel e que o primeiro \`pr view\`
  DISPARA o calculo de mergeabilidade no GitHub e volta antes de ele terminar,
  e o segundo colhe o resultado. NAO descarto degradacao transitoria do GitHub
  na rodada 1. Afirmo o COMPORTAMENTO reproduzido (1 cega, 2 e 3 iguais), nao a
  causa dentro do GitHub.
- NAO sei se a rodada 1 falha SEMPRE ou so quando ha PRs nunca tocados. Com 3
  execucoes eu tenho o fenomeno, nao a taxa.
- NAO alterei o instrumento. Sensor (14-A): abro e anoto, nao conserto.

COMO REPRODUZIR / CONFERIR
  node _frank/ferramentas/2026-09-24_conserto_pronto_e_parado.cjs   # 1a vez
  node _frank/ferramentas/2026-09-24_conserto_pronto_e_parado.cjs   # 2a vez
Controle positivo: se a 1a ja responder com numeros, o fenomeno nao reproduziu
HOJE — o que NAO invalida a falta de retentativa, so significa que o GitHub
respondeu de primeira naquela execucao.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "vigia:conserto-parado-sem-retentativa",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 1,
    affected_emails: [],
    reported_by: "vigia",
    first_seen_at: agora,
    last_seen_at: agora,
    agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify(data[0], null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
