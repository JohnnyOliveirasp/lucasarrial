#!/usr/bin/env node
/**
 * Abre o incidente do defeito medido na ronda de 10/09 01hZ:
 * o aviso de compra órfã chama trial de R$ 0 de "compra paga" e manda tratar
 * como pagante urgente.
 *
 * Sem --confirmar, só imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = [
  // os 10 alertas "Compra paga SEM conta" cujo valor MAXIMO de compra é R$ 0
  "rodrigoaugusto@hotmail.com",
  "viniciusjc1903@gmail.com",
  "gabriel.pereira@p-excellence.com.br",
  "brunno.lopes@live.com",
  "andreviana07@gmail.com",
  "lfrostw@gmail.com",
  "mariliarossini@gmail.com",
  "mateusnodesence@gmail.com",
  "gestao10.jessica@gmail.com",
  "alfredo@inbtec.com.br",
];

const TITULO =
  "O AVISO DE COMPRA ORFA CHAMA TRIAL DE R$ 0 DE 'COMPRA PAGA' E MANDA TRATAR COMO PAGANTE URGENTE: " +
  "deveAvisar (aviso-orfao.ts:114-130) filtra so por eventType/buyerEmail/productCode e NAO olha se entrou dinheiro. " +
  "10 dos 16 alertas na fila de recados sao de quem nunca pagou um centavo";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 10/09 ~01hZ, EM PRODUCAO.
Nao e a planilha (ordem de 29/08): e o webhook da Hotmart do produto FastCloner
(7851642) e a fila de recados do agent_state.

O DEFEITO
frontend/src/lib/payments/aviso-orfao.ts, funcao deveAvisar() (linhas 114-130):
as unicas travas sao (1) eventType em PURCHASE_APPROVED/PURCHASE_COMPLETE,
(2) buyerEmail preenchido e (3) productCode igual ao nosso. Nao existe NENHUMA
condicao sobre valor ou status da compra. Entao trial de R$ 0, que chega como
PURCHASE_APPROVED do produto certo, dispara o alerta.

O TEXTO QUE ELE GERA (montarAviso, linha 154 e 157) diz, literalmente:
  assunto: "Compra paga SEM conta na plataforma: <email>"
  item 3:  "Ate vincular, ele esta PAGANDO e SEM ACESSO. Tratar como urgente."
As duas frases sao FALSAS para quem pagou R$ 0.

A MEDICAO (10/09 01hZ)
Fila de recados para_frank_orfa_*: 16 alertas.
Cruzando cada e-mail com o MAIOR valor de compra em payment_events:
  - 6 com dinheiro de verdade: caplastica@hotmail.com (97), gabrielalouly@hotmail.com (97),
    neto_rocha@hotmail.com (97), herysilva.27@gmail.com (22), ezwaymotors@gmail.com (20),
    cachico3@hotmail.com (19).
  - 10 com valor MAXIMO = 0. Nunca pagaram nada.
62,5% da fila de "compra paga urgente" e falso alarme.
Cruzando com profiles: 4 dos 16 JA tinham conta quando eu medi (o alerta
envelheceu sozinho) — rodrigoaugusto criou a conta 42 SEGUNDOS depois do alerta
disparar.

O DANO, QUE E DUPLO
1. RUIDO: 10 urgencias falsas empilhadas na fila que eu leio. O relatorio de
   09/09 contou "31 recados tocam dinheiro" — numero inflado exatamente por isto.
   Alerta que mente faz o time parar de ler alerta, e os 6 pagantes de verdade
   ficam escondidos no meio dos 10 que nao pagaram.
2. RISCO DE ACAO ERRADA: obedecer o recado ao pe da letra e escrever para quem
   nao pagou dizendo que ele esta pagando e que os creditos dele estao
   reservados. Isso ja aconteceu nesta casa duas vezes: #127 (convite para quem
   estornou) e #138 (trial de R$ 0 lido como acesso vivo). A guarda existe.

A REGRA CERTA JA EXISTE, TESTADA, NO MODULO IRMAO
frontend/src/lib/payments/acesso-regra.ts, eventoEhPagamento(): valor > 0 E
status em COMPLETE/COMPLETED/APPROVED. O orphan-outreach.ts (o sweeper diario)
USA essa regra e por isso NAO convidou nenhum dos 10 — o proprio comentario de
acesso-regra.ts:56-66 registra a medicao de 08/09 em que 7 de 13 orfaos eram
trial de R$ 0 ou boleto nunca pago. Os dois modulos que decidem sobre a MESMA
compra orfa discordam sobre o que e "pago": o sweeper acerta, o aviso erra.

CORRECAO PROPOSTA
Aplicar eventoEhPagamento() dentro de deveAvisar(), com motivo novo
"sem_pagamento", e passar valor/status do payload no webhook (route.ts ~285;
purchaseStatus ja esta no escopo, linha 196). Sem migration, sem mexer em
credito de ninguem.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "investigating",
    signature: "frank:aviso-orfao-sem-trava-de-pagamento",
    title: TITULO,
    description: DESCRICAO,
    occurrences: AFETADOS.length,
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

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
