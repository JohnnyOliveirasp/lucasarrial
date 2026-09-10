#!/usr/bin/env node
/** Abre o incidente do buraco medido na ronda das falhas de 10/09 ~23hZ:
 *  pedido de reembolso nao e cruzado com a data de garantia da compra. */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "A CASA SO OLHA A GARANTIA QUANDO VAI RESPONDER, NUNCA ENQUANTO O PEDIDO ESPERA NA FILA: " +
  "janelaGarantia (garantia.ts) tem UM unico chamador, account.ts:174, que so roda ao MONTAR UMA RESPOSTA " +
  "para o aluno — nao existe varredura que cruze chamado de reembolso ABERTO com o warranty_date da compra. " +
  "O relogio corre dentro da fila e ninguem ve. 3 alunos pediram reembolso DENTRO do prazo e o prazo virou " +
  "(ou esta virando) enquanto esperavam: Alana venceu 08/09, Lucila venceu 10/09, Victor vence 11/09 00:00Z";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 10/09 ~23hZ, EM PRODUCAO.
Nasceu do #309 (Victor Moraes Mendes). Aquele cartao e o caso DO ALUNO. Este e
a PORTA: ninguem olha o relogio da garantia enquanto o pedido espera.

RETRATACAO ANTES DE COMECAR — A MINHA PRIMEIRA HIPOTESE ESTAVA ERRADA
Eu ia abrir este cartao dizendo "o warranty_date entra no banco e ninguem le".
Conferi antes de gravar e e FALSO: o campo E lido. O #265 foi corrigido em 05/09
(PR #191, merge b4a7a39), a constante de 7 dias saiu e a janela passou a vir de
payload.data.product.warranty_date. Registro o erro porque cartao que nasce de
premissa nao conferida e exatamente o que faz a fila mentir.

O BURACO REAL, MEDIDO
grep por janelaGarantia em todo o repo (fora node_modules e testes):
  garantia.ts:66      a definicao
  account.ts:20       o import
  account.ts:174      A UNICA CHAMADA
account.ts monta o contexto da conta para o agente RESPONDER o aluno. Ou seja: a
casa sabe calcular a janela com precisao, mas so calcula no instante em que
alguem ja esta escrevendo para aquela pessoa. E conhecimento REATIVO.
Nao existe varredor, cron, alerta ou tela que percorra os chamados ABERTOS e
pergunte "de quem e que o prazo vence amanha?". Enquanto o chamado espera na
fila — que e justamente quando o prazo corre — o numero nao e consultado por
ninguem. O dado esta pronto no banco e a funcao que o interpreta ja existe e ja
esta testada; falta so alguem chamar ela olhando para a fila em vez de para uma
conversa.

A MEDICAO (chamados de atendimento abertos com pedido de reembolso/cancelamento,
cruzados com o maior warranty_date do proprio aluno)
  #223 Alana    pediu 01/09  garantia venceu 08/09   JA VENCEU esperando
  #299 Lucila   pediu 07/09  garantia venceu 10/09   JA VENCEU esperando
  #309 Victor   pediu 08/09  garantia vence 11/09 00:00Z  (faltavam ~65 min)
Nos tres o aluno pediu DENTRO do prazo. Em nenhum dos tres a demora foi dele.
  #263 rossiclinicas aparece na consulta com garantia vencida em 15/08, mas ele
  pediu em 05/09, ou seja DEPOIS do vencimento — nao entra na conta, e o caso
  dele e cobranca recorrente apos cancelamento, outro assunto. Registro para a
  proxima ronda nao contar 4 onde sao 3.

O AGRAVANTE QUE ESCONDE O CASO DA BUSCA POR PALAVRA
O #309 nasceu como "Victor solicita reembolso de duas compras". Na 3a ocorrencia
o titulo foi reescrito para "aguardando retorno sobre Sistema de Geracao Pronto"
e a palavra "reembolso" SAIU do titulo. A minha propria consulta por palavra-
chave (reembols|cancel|garantia|duplicad) NAO acha mais o #309 — foi por isso que
ele apareceu na medicao pelo caminho do #312 e nao pelo filtro obvio. Qualquer
detector desta classe tem que ler o historico do chamado, nao so o titulo de
agora, senao ele nasce cego exatamente no caso mais grave (o que ja cobrou 3x).

RESSALVA HONESTA, PARA NAO INFLAR O DANO
Garantia vencida na Hotmart NAO significa que o dinheiro ficou irrecuperavel: o
vendedor ainda pode estornar por decisao propria. O que se perdeu foi o DIREITO
AUTOMATICO do aluno e a posicao confortavel da casa — e, nos tres casos, a
paciencia de quem pediu certo e no prazo. Nao afirmo prejuizo consumado; afirmo
protecao perdida por causa da nossa fila.

CORRECAO PROPOSTA
1. Varredor: para todo chamado de atendimento aberto cujo aluno tenha compra com
   warranty_date no futuro proximo, gritar em D-2 e D-1. NAO precisa de conta
   nova nem de integracao: janelaGarantia() ja existe, ja e pura (sem import, sem
   banco) e ja e testada — basta chama-la a partir da FILA. Hoje ela so e chamada
   a partir de uma conversa (account.ts:174).
2. O criterio nao pode ser o titulo de hoje. Tem que varrer description +
   agent_notes (o historico), pelo motivo medido acima.
3. Carimbar a data de garantia no proprio chamado quando ele nasce, para quem
   abre o cartao ja ver o relogio sem ter que ir no payload.

ALCANCE HONESTO: 3 alunos hoje, dos quais 2 ja com o prazo virado. Mas o gatilho
e "aluno pede reembolso e a fila demora 3 dias", que e o caso NORMAL desta fila —
a propria fila tem 71 abertos e casos de 51h e 222h medidos nesta mesma ronda.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system", cause: "bug", categoria: "tecnico", status: "investigating",
    signature: "frank:reembolso-nao-cruza-warranty-date",
    title: TITULO, description: DESCRICAO,
    occurrences: 3,
    affected_emails: [
      "victor.inscriptio@gmail.com",
      "contatoecocannabis@gmail.com",
      "alana_pinho@hotmail.com",
    ],
    reported_by: "frank", first_seen_at: agora, last_seen_at: agora, agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify({ id: data[0].id, numero: data[0].numero, status: data[0].status }, null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
