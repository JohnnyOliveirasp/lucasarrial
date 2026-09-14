#!/usr/bin/env node
/**
 * Abre o incidente medido na rotina das falhas de 14/09 ~11hZ:
 * o SGP nunca revoga nada quando a compra e CONTESTADA.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

// Os 12 que JA RECEBERAM o clone montado e cuja compra do SGP esta contestada.
// E a coorte acionavel. Cartao TECNICO: pelo conserto de 14/09 no
// garantia_na_fila.cjs, coorte de card tecnico e rotulada e NAO entra nos
// blocos de "pediu reembolso"/"vence em 48h" (o filtro por titulo media 62
// pessoas e 48 nunca tinham pedido nada).
const AFETADOS = [
  "patriciapio007@gmail.com",
  "evelyn.cheida@gmail.com",
  "luciano.rezende.filho@gmail.com",
  "mateusanalistadenegocios@gmail.com",
  "frfaria.1980@gmail.com",
  "jasf.junior@gmail.com",
  "edust@live.com",
  "jakson_correia@outlook.com",
  "djrobertocarvalho@gmail.com",
  "lwsribeiro@gmail.com",
  "dramaryannepdovale@gmail.com",
  "cazanna1@hotmail.com",
];

const TITULO =
  "O SGP NAO ENXERGA CONTESTACAO: route.ts:206 desvia o SGP ANTES de toda a logica de revogacao, " +
  "entao protest/chargeback/refund dele nunca revogam nem sinalizam nada. Medido: 12 clones JA MONTADOS E " +
  "ENTREGUES (R$ 7.449,00 contestados) para quem contestou o pagamento, mais 7 pedidos ainda em producao; " +
  "49 disputas de SGP (R$ 28.032,73) invisiveis no nosso lado, contra 239 PURCHASE_APPROVED recebidos";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA ROTINA DAS FALHAS DE 14/09 ~11hZ, EM PRODUCAO.
Saiu de dentro do #385 (Evelyn, cancelamento do FastCloner) e o defeito NAO e do
caso dela: e de a casa nao conseguir enxergar que uma compra do SGP foi contestada.

O QUE E "PROTESTED", COM A RESSALVA QUE IMPORTA
PROTESTED na Hotmart = contestacao ABERTA pelo comprador. NAO afirmo que o
dinheiro ja voltou pra pessoa, nem que a casa perdeu a disputa: pode ser
resolvida a favor do produtor. O que este cartao afirma e mais estreito e nao
depende do desfecho: a casa ENTREGA o servico sem nunca saber que a compra foi
contestada.

AS DUAS PORTAS, CADA UMA SUFICIENTE SOZINHA

(a) NENHUM evento de revogacao do SGP jamais foi registrado.
    payment_events, produto "Sistema de Geracao Pronto", por tipo:
      PURCHASE_APPROVED ......... 239   (2026-06-09 -> 2026-09-14)
      CLUB_FIRST_ACCESS ..........  3
      CLUB_MODULE_COMPLETED ......  3
      PURCHASE_BILLET_PRINTED ....  3
      PURCHASE_PROTEST ........... 0
      PURCHASE_CHARGEBACK ........ 0
      PURCHASE_REFUNDED .......... 0
      PURCHASE_CANCELED .......... 0
      SUBSCRIPTION_CANCELLATION .. 0
    Ou seja: do SGP chega SO o evento que ABRE, nunca nenhum dos que FECHAM.
    239 a zero. Pra comparar, no mesmo banco o FastCloner tem 12 PURCHASE_PROTEST
    e 1 PURCHASE_CHARGEBACK, e o curso tem 3 — logo o tipo de evento existe e
    chega nos outros produtos.

(b) Mesmo que chegasse, seria engolido — e esta e a parte que e codigo nosso.
    frontend/src/app/api/v1/webhooks/hotmart/route.ts:206

      if (rota === "sgp") {
        return await processarCompraSgp(eventType, data, buyerEmail, productCode, externalId);
      }

    O comentario logo acima diz, com todas as letras, "Desvia ANTES de tudo —
    nada abaixo desta linha pode rodar pra ele". E o mapRevokeStatus (mesma
    rota, linha 468), que traduz PURCHASE_PROTEST/CHARGEBACK/REFUNDED em
    revogacao, esta ABAIXO dessa linha.
    O desvio esta CERTO no que foi desenhado pra fazer: comprar o SGP nao pode
    dar FastCloner de graca (regra do Lucas, 31/08). O defeito e que ele foi
    escrito pensando so em COMPRA e acabou engolindo tambem a REVOGACAO.
    processarCompraSgp trata compra; nao existe ramo de contestacao nele.

POR QUE A AUSENCIA EM payment_events NAO BASTAVA COMO PROVA (e quase me pegou)
O proprio route.ts:97-107 documenta que o descarte por produto acontece ANTES do
insert em payment_events, e que por isso procurar o produto na tabela "so
reencontra o efeito deste return" — a prova seria circular. Conferi a rota: o
roteamentoDoProduto (sgp-boas-vindas.ts:509) decide por PRODUTO, nao por tipo de
evento, e desde a abertura de 03/09 o SGP rota como "sgp", nao como "de_fora".
Logo um PURCHASE_PROTEST do SGP SERIA inserido. A distribuicao por mes confirma
a historia documentada: 13 eventos em 2026-06 (antes do descarte de 09/06),
ZERO ate agosto, 235 em 2026-09 (depois da abertura). A janela pos-03/09 esta
coberta e e nela que as contestacoes acontecem.
NAO CONSIGO dizer POR QUE a Hotmart nao manda revogacao do SGP: isso se
verifica no painel da Hotmart, e a casa nao tem acesso a ele (esta escrito no
cabecalho do cancelar_assinatura.cjs). Por isso a correcao proposta nao depende
de webhook.

(c) DE QUEBRA: o oraculo de "essa pessoa pagou?" tambem e cego a disputa.
    _frank/ferramentas/pagou_de_verdade.cjs:197 pergunta
      /sales/history?buyer_email=...&max_results=50
    SEM transaction_status. Medido: a Hotmart NAO devolve venda contestada nessa
    consulta. Rodei nos dois modos pra Evelyn — por buyer_email devolve 1 item
    (o trial de R$0); com transaction_status=PROTESTED devolve as 2 contestadas.
    Testei a hipotese alternativa (janela de data) com start_date=01/08/2026: o
    resultado nao muda, entao quem esconde e o STATUS, nao a data.
    Efeito pratico: o pagou_de_verdade.cjs, que o README chama de fonte de
    verdade, leu "avulsas pagas: 0" para a Evelyn, que tem R$ 924,45 contestados.

O DINHEIRO, COM O RECORTE HONESTO
Escopo: SO os produtos que ESTE sistema provisiona (SGP + FastCloner). A casa
tem 168 transacoes em disputa somando R$ 381.426,51, mas a maioria e do CURSO
(Fabrica de Conteudo Invisivel) e da Comunidade, que NAO sao provisionados aqui
e nao sao divida deste sistema. Publicar os R$ 381 mil seria repetir o erro do
"R$ 7.042 travados" que o README do contato_hotmart.cjs registra.
  disputas em produto nosso ....... 52 trx / 51 pessoas — R$ 28.894,10
  que nunca registramos ........... 49 trx ............. R$ 28.032,73
  (as 3 que conhecemos sao FastCloner, que manda protest; as 49 sao SGP)

O NUMERO QUE IMPORTA — servico ENTREGUE contra compra contestada:
Cruzei os 49 e-mails com disputa no SGP contra sgp_pedidos. 19 pedidos batem:
  12 estao status='pronto' (material enviado, foto_pronta_em E voz_pronta_em
     preenchidos) = o clone foi MONTADO E ENTREGUE. Soma contestada: R$ 7.449,00
  7 estao em producao (status dados/foto/audio) e serao entregues do mesmo jeito,
     porque nada no sistema sinaliza a contestacao pra quem monta.
Isso e trabalho de equipe + GPU gasto, ja consumado nos 12 e em andamento nos 7.

O QUE EU NAO FIZ, E E LIMITE DURO
NAO toquei em credito, acesso, entitlement nem sgp_pedidos de ninguem. NAO
revoguei nada, NAO estornei nada e NAO escrevi pra nenhuma destas 12 pessoas.
O que fazer com quem contestou e ENTROU no servico e decisao de dinheiro do
Johnny (06_RELATORIO_E_LIMITES: falar em nome da empresa sobre reembolso e
alcada dele), e foi pro grupo nesta ronda. Este cartao e so o defeito de a casa
nao enxergar.
Tambem NAO afirmo que as 12 entregas foram indevidas: contestacao pode ser
legitima (inclusive por falha nossa de entrega, que e o padrao do #387 e do caso
Emanuel). Afirmo que foram feitas as cegas.

CORRECAO PROPOSTA
1. RECONCILIACAO, nao webhook. Job diario perguntando
   /sales/history?transaction_status=PROTESTED (e CHARGEBACK, REFUNDED) e
   marcando o pedido correspondente. Nao depender de evento que pode nunca vir,
   ja que o painel da Hotmart nao esta ao nosso alcance.
2. Tornar o desvio do route.ts:206 SELETIVO: evento da classe de revogacao nao
   pode ser engolido pelo ramo de compra. Manter o desvio pro que concede
   (a regra do Lucas de 31/08 continua valendo), separar o que revoga.
3. Sinalizar no pedido do SGP: quem monta o clone precisa ver "compra
   contestada" na tela, senao a entrega segue as cegas mesmo com o dado no banco.
4. pagou_de_verdade.cjs:197 — ou pergunta tambem pelos status de disputa, ou
   imprime em alto e bom som que NAO enxerga contestacao. Hoje ele responde
   "avulsas pagas: 0" com a mesma cara de quem nunca comprou.
   NAO mexi nele nesta ronda: e a fonte de verdade de decisao de dinheiro e
   mexer nele merece PR proprio e revisao.

AS TRES CHECAGENS DA ORDEM DE 27/08, FEITAS ANTES DE ABRIR
1. JA EXISTE? Varri a fila aberta E fechada por titulo
   (protest/chargeback/contesta/disputa): volta so o #127, que esta fixed e e
   outro assunto (orphan-outreach convidando quem cancelou). Nenhum cartao,
   aberto ou fechado, trata o SGP nao enxergar contestacao.
2. JA FOI CORRIGIDO? gh pr list --state open --limit 200 (limite DECLARADO: o
   default de 30 corta em silencio, licao de 14/09) = 40 PRs. Os vizinhos sao
   #4, #81 e #189, e os TRES tratam do que fazer QUANDO o evento de
   estorno/chargeback CHEGA (zerar credito, status terminal, nao ressuscitar).
   Nenhum deles ajuda aqui: o evento do SGP nao chega, e se chegasse morreria no
   route.ts:206 antes de qualquer um desses caminhos. Este cartao e a
   PRE-CONDICAO dos tres, nao duplicata. git log 30d no route.ts: 11 commits,
   todos de SGP/boas-vindas/orfa, nenhum toca o ramo de revogacao.
3. ENVOLVE DINHEIRO? Sim, e por isso vem com ref e arquivo:linha, como manda a
   ordem: transacoes nomeadas (ex. HP2585148563 SGP R$672 e HP3361171770 R$252,45,
   da Evelyn), arquivo:linha em route.ts:206, route.ts:468,
   sgp-boas-vindas.ts:509 e pagou_de_verdade.cjs:197. Nenhum ref_id de credito
   foi casado e nenhuma cobranca foi afirmada.

COMO REPRODUZIR
  node _Bugs/protesto_invisivel.cjs
Ele tem CONTROLE POSITIVO (as 2 transacoes da Evelyn TEM que reaparecer) e
ABORTA com exit 1 se zerarem, em vez de reportar "nenhuma contestacao" — zero de
instrumento cego ja enganou a casa em 07/09 e em 13/09.
⚠️ Na primeira versao ele mentiu comigo: eu tinha escrito select("id,credits") e
NAO existe coluna credits em profiles (e credits_subscription + credits_extra),
entao o PostgREST devolveu erro, data veio null e TODA pessoa apareceu como "sem
conta/sem credito". E exatamente a armadilha de 13/09. Peguei batendo contra um
valor que eu ja tinha medido na mao (a Evelyn tem 31.690 creditos e o instrumento
dizia "-"). A versao commitada levanta excecao no erro do select em vez de
seguir com null.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "frank:sgp-nao-enxerga-contestacao",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 1,
    affected_emails: AFETADOS,
    reported_by: "frank",
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
