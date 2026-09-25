#!/usr/bin/env node
/**
 * Abre o chamado medido na ronda do VIGIA de 25/09 ~22hZ:
 * o `percepcao_travada.cjs` — instrumento que uma ORDEM PERMANENTE (17/09)
 * manda rodar toda ronda — le `agent_notes[-1]` cru e fica cego em 22 dos 164
 * cartoes vivos, porque a ultima nota deles e carimbo escrito em LOTE.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "O DETECTOR DE PERCEPCAO FICA CEGO QUANDO ALGUEM CARIMBA O CARTAO EM LOTE: percepcao_travada.cjs:206 " +
  "le agent_notes[-1] cru, entao em 22 dos 164 cartoes vivos (13%) ele avalia o carimbo do lote e nao o " +
  "estado do caso. E o MESMO defeito do #554, que foi consertado so no esperando_johnny.cjs e nao neste " +
  "arquivo. Dano medido HOJE: 0 — o numero '0 travado em percepcao' que a ordem de 17/09 exige toda ronda " +
  "esta CERTO hoje, mas e inverificavel em 13% da frota";

const DESCRICAO = `MEDIDO POR MIM (VIGIA) NA RONDA DE 25/09 ~22hZ, EM PRODUCAO.
Regra 14-A: eu abro e anoto. Nao fecho, nao reabro, nao respondo aluno, nao
mexo em credito. Este cartao e sobre INSTRUMENTO, nao sobre aluno — nenhum
aluno esta esperando por causa dele HOJE, e isso esta medido abaixo.

== O QUE E ==
A ordem permanente de 17/09 ("precisa de um humano olhar" deixa de ser motivo
pra card parar) diz, com estas palavras: "O instrumento canonico e
_frank/ferramentas/percepcao_travada.cjs — rode ELE a cada ronda, nao o SQL".
Toda ronda publica o numero que ele devolve.

Esse instrumento decide por UMA nota so:

  _frank/ferramentas/percepcao_travada.cjs:206
    const ultima = i.agent_notes[i.agent_notes.length - 1];
    const marca = marcaDe(ultima?.note);
    if (!marca) continue;

E 'marcaDe' (linha 189) desconta exatamente UM boilerplate, o do sensor:
  const BOILERPLATE = "precisa de olho humano, nao de codigo";   (linha 61)

Quem escreve uma nota de MANUTENCAO em lote por cima de N cartoes empurra o
estado real pra posicao -2 e o detector passa a avaliar o carimbo. Carimbo nao
tem marca de percepcao, entao 'marcaDe' devolve null e o cartao e PULADO em
silencio — nao entra na conta nem como "olhado e descartado".

== CONTROLE DE MUTACAO (o mesmo cartao, com e sem o carimbo) ==
Rodei a funcao pura exportada pelo proprio arquivo, sem banco:

  marcaDe(<texto do carimbo de 24/09>) = null
  marcaDe("Nao enxergo video. Alguem precisa assistir ...") = "nao enxergo"

  travadosDe([cartao com SO o pedido])              -> detectado: 1
  travadosDe([cartao com o pedido + carimbo em cima]) -> detectado: 0

Mesmo cartao, mesmo pedido de percepcao, uma nota de manutencao a mais: 1 -> 0.
Isto nao e inferencia, e o detector rodando.

== O TAMANHO, POR DOIS CAMINHOS INDEPENDENTES ==
(a) Filtro pelo texto do retrofit de 24/09 (string escrita a mao):
    20 cartoes vivos com esse carimbo na ULTIMA nota.
(b) Instrumento independente e orientado a DADO, sem lista escrita a mao —
    _frank/ferramentas/2026-09-24_nota_em_lote.cjs, que define lote como
    "mesmo prefixo de 200 chars em >= 3 cartoes distintos":
    22 cartoes vivos cuja ultima nota e de lote, de 164 = 13%.
    Reimplementei a mesma definicao por fora e deu 22 tambem.

E NAO e evento historico de um dia so. Dos 4 textos de lote que o instrumento
acha, um esta VIVO e sendo escrito ate hoje:
  21 cartoes · 24/09 17:48            "RETROFIT DA TRAVA DO HUMANO (#415) ..."
  10 cartoes · 16/09 21:10 .. 25/09 17:10  "=== O QUE FAZER === O ALUNO MANDOU OUTRO E-MAIL ..."
   5 cartoes · 13/09 18:57            "RONDA 13/09 ~19hZ ... CANAL ENCONTRADO ..."
   3 cartoes · 17/09 22:30            "=== CONSERTO EM PRODUCAO === PR #331 ..."
O segundo recebeu carimbo novo HOJE as 17:10Z. Ou seja o buraco nao se fecha
sozinho com o tempo: ele e realimentado.

== O DANO HOJE E ZERO, E EU MEDI EM VEZ DE SUPOR ==
Apliquei nos 22 cegos a MESMA regra de recuo que o #554 ja pos no irmao (andar
pra tras enquanto a nota for de lote, teto de 5 pulos) e rodei 'marcaDe' na
primeira nota substantiva:

  cartoes cegos ................................. 22
  que revelam pedido de percepcao REAL ..........  0

As 3 unicas que casavam por palavra-chave crua (#216, #245, #406) dizem, com
todas as letras, que a percepcao JA FOI CUMPRIDA — e a regra CUMPRIMENTOS do
proprio detector as anula corretamente. Entao o "0 travado em percepcao" que
esta na ronda das 20hZ e na minha de agora esta CERTO.

O que este cartao afirma e mais estreito, e nao depende disso: esse 0 e
PRODUZIDO POR UM DETECTOR QUE NAO CONSEGUE VER 13% DOS CARTOES VIVOS. Hoje ele
acerta por sorte do conteudo, nao por cobertura. O proximo pedido de percepcao
que nascer debaixo de um carimbo de lote sai da conta em silencio — e "0 nao
pode parecer saude" e exatamente o que a ordem de 17/09 existe pra impedir
(a classe chegou a 13 cartoes, o mais velho com 16 dias, assim).

== AS TRES CHECAGENS DA ORDEM DE 27/08, FEITAS ANTES DE ABRIR ==
1. JA EXISTE? Varri a fila ABERTA E FECHADA por signature/title
   (percep%, %ultima-nota%, %retrofit%). Volta UM: o #554
   'vigia:ultima-nota-enterra-a-marca-de-decisao', status FIXED, fechado em
   24/09 21:49Z. NAO e duplicata, e o IRMAO: a nota de fechamento dele nomeia
   o mecanismo generico ("como ultimaNota() do esperando_johnny.cjs le so
   agent_notes[-1], o carimbo virou a ultima nota de todos eles e enterrou o
   estado real") e conserta UM consumidor so. Conferido no fonte: a regra
   NOTA_NEUTRA e o recuo com teto existem em
   2026-09-22_esperando_johnny.cjs:178/191/302 e NAO existem em
   percepcao_travada.cjs (grep NOTA_NEUTRA no _frank/ferramentas: 0 ocorrencia
   neste arquivo). Como o #554 esta FECHADO, nao reabri nada (14-A) — anotei a
   objecao no proprio #554 nesta mesma ronda.
2. JA FOI CORRIGIDO? 'git log origin/main -- percepcao_travada.cjs': os 5
   commits mais recentes sao de 17..23/09 (falsos positivos, aguardando_aluno,
   relato de percepcao cumprida, negacao) — nenhum toca nota de lote, e todos
   sao ANTERIORES ao carimbo de 24/09 que criou a condicao.
   'gh pr list --state open': o vizinho e o PR #431 ("#554: varredura da fila
   do Johnny pula nota de manutencao"), e ele NAO cobre este arquivo — conferi
   a lista de arquivos dele: 2026-09-22_esperando_johnny.cjs, o teste dele e o
   backfill. Nenhum PR aberto mexe no percepcao_travada.cjs.
   ⚠️ De quebra: o head do PR #431 NAO e ancestral da origin/main, e a regra
   NOTA_NEUTRA entrou na main por outro commit (03e8c85f, ronda 24/09 22hZ).
   Ou seja o #431 e mais um branch concorrente de um conserto que JA esta no
   ar — a mesma familia que o README ja documenta 7 vezes. Nao e assunto deste
   cartao, so esta registrado porque foi medido aqui.
3. ENVOLVE DINHEIRO? NAO. Nenhum credito, debito, estorno ou cobranca e
   afirmado, nenhum ref_id foi casado e nenhum aluno e nomeado como lesado.
   affected_emails vai VAZIO de proposito: dano medido hoje = 0.

== CORRECAO PROPOSTA (nao executei — 14-A) ==
1. percepcao_travada.cjs: a escolha da nota deixa de ser '[-1]' e passa a ser
   "primeira nota SUBSTANTIVA", com o mesmo recuo e o mesmo teto de 5 pulos que
   o esperando_johnny.cjs ja usa. Reaproveitar a regra que existe, nao escrever
   uma segunda.
2. Quem decide "e nota de manutencao" devia ser UM lugar so, compartilhado
   pelos dois leitores. Hoje sao duas nocoes diferentes de boilerplate em dois
   arquivos: a NOTA_NEUTRA (lista conferida a mao) e a BOILERPLATE de 1 string.
   Enquanto forem duas, consertar uma nao conserta a outra — foi o que
   aconteceu aqui.
3. Teste com o controle de mutacao deste cartao: o mesmo cartao com e sem o
   carimbo em cima tem que dar 1 e 1, nao 1 e 0.
4. O relatorio da ronda devia imprimir, junto do numero, QUANTOS cartoes o
   detector nao conseguiu avaliar. Numero sem cobertura e o que produziu o
   "0 abertos existindo quatro" de 19/08.

== COMO REPRODUZIR ==
  node _frank/ferramentas/2026-09-24_nota_em_lote.cjs     (22 cegos, 4 textos de lote)
  node -e "const{marcaDe,travadosDe}=require('./_frank/ferramentas/percepcao_travada.cjs'); ..."
  (o controle de mutacao esta transcrito na integra na secao CONTROLE DE
   MUTACAO acima, com entrada e saida)

== O QUE EU NAO FIZ ==
Nao mexi no percepcao_travada.cjs. Nao mexi em cartao nenhum dos 22. Nao
fechei nem reabri o #554. Nao toquei em status, credito, acesso ou nota de
aluno. Nao li, escrevi, classifiquei nem reprocessei nada vindo da planilha
(ordem de 29/08).`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "vigia:percepcao-travada-cega-em-nota-de-lote",
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
