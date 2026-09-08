/**
 * Rodada 08/09 — abre o chamado do §1 do relatorio de cancelamentos:
 * o aviso de compra orfa (#239) NAO disparou para UKC2COC2
 * (rodrigo.limas.1978@gmail.com), que pagou R$97 em 06/09 sem ter conta.
 *
 * ⚠️ Sem `--confirmar` ele SO ENSAIA (mesma regra do anotar_incidente.cjs).
 * ⚠️ Antes de inserir, procura duplicata — e se a BUSCA falhar, ele PARA:
 *    consulta que erra volta vazia, e "0 duplicatas" por erro nao autoriza
 *    abrir chamado repetido.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const SIGNATURE = "frank:aviso-orfa-nao-disparou-UKC2COC2";

const TITULO =
  "AVISO DE COMPRA ORFA NAO DISPAROU PARA UM PAGANTE: rodrigo.limas.1978@gmail.com pagou R$97 em 06/09 "
  + "(PURCHASE_APPROVED rec#2, produto 7851642, processado sem erro), nunca teve conta, e nao existe nem a chave "
  + "para_frank_orfa_UKC2COC2 nem entrada em orphan_alerts. Ele cancelou no dia seguinte. Causa NAO determinada.";

const DESCRICAO = `FATO MEDIDO (rodada de cancelamentos de 08/09; prova completa em
_frank/prova/2026-09-08_cancelamentos_07-09.md, secao 1)

  assinatura UKC2COC2 | oferta ewxrfw9j | produto 7851642 (FastCloner)
  30/08 15:47  PURCHASE_APPROVED rec#1  R$0   APPROVED   processado 15:47:53  error=null
  06/09 14:13  PURCHASE_APPROVED rec#2  R$97  APPROVED   processado 14:13:05  error=null
  07/09 09:32  PURCHASE_COMPLETE rec#1  R$0   COMPLETED  processado 09:32:34  error=null
  07/09        SUBSCRIPTION_CANCELLATION

A PESSOA NUNCA TEVE CONTA (nao e conta apagada depois):
  - profiles por e-mail exato: 0    (contraprova: profiles responde, 2.359 contas)
  - profiles por NOME e por pedacos do e-mail: rodrigo.limas / limas / rodrigo (36
    contas) / miranda (9) / jorge (5) -> nenhuma e ele
    (contraprova positiva: display_name ILIKE %a% devolve 30 contas)
  - auth.users: 2.359 usuarios varridos, o e-mail NAO esta la
  - credit_transactions com ref_id = HP2955203673 (a transacao do R$97): 0
    (contraprova: a tabela tem 23.625 linhas)
  - entitlements: UKC2COC2 status=canceled user_id=NULO access_until=2026-09-30

LOGO, no webhook, resolveUserIdByEmail() TINHA que devolver null as 14:13 —
ela le exatamente profiles.email ILIKE. E com null o route.ts:243 chama
avisarCompraOrfa(). Nao chamou, ou chamou e nao gravou nada.

O AVISO NAO EXISTE EM LUGAR NENHUM:
  - agent_state NAO tem a chave para_frank_orfa_UKC2COC2
    (as 11 que existem estao no rascunho _frank/rascunhos/orfao_ukc_0907.cjs)
  - o mapa de idempotencia orphan_alerts tem 13 entradas e UKC2COC2 NAO esta em
    nenhuma -> nao foi "ja_avisado", foi nunca avisado
  - payment_events.error do evento de 06/09 e null, entao nao foi o caminho
    "avisou e nenhum canal aceitou" (esse grava erro, route.ts:270)

O QUE JA FOI DESCARTADO (nao repetir):
  - maquina parada: o MESMO webhook avisou 1206SZ6B as 12:10 e LCL5JZ82 as 15:00
    do MESMO dia 06/09; o dele, as 14:13, passou no meio
  - produto de fora: product.id = 7851642 = HOTMART_PRODUCT_ID, igual ao do
    1206SZ6B que avisou; extractProductCode faz String(id), entao nao e
    numero-vs-string
  - guard de status: purchase.status = APPROVED, que esta em PAID_STATUSES
    (route.ts:136), entao nao caiu no early return "pending:"
  - codigo velho: o fix do #239 e o commit 93d8f87 de 02/09 21:04, quatro dias
    antes
  - idempotencia: ver acima, a chave nao esta no mapa
  - corrida de escrita no mapa orphan_alerts: mesmo que o mapa perdesse a
    entrada, registrarDuravel grava uma chave SEPARADA (para_frank_orfa_*) que
    nao participa do read-modify-write — e ela tambem nao existe

POR ONDE COMECAR: o unico trecho ainda nao verificado e o que roda ANTES de
processEvent (dedupe por event_id / caminho de reprocessamento) e o proprio
grantAccess, que roda antes do resolveUserIdByEmail. Vale conferir se algum
deles pode retornar/desviar sem deixar rastro em payment_events.error.

ACHADO LATERAL, mesma maquina (secao 6 da prova): em orphan_alerts ha 3
entradas com canais:[] — aviso gerado que NENHUM canal aceitou:
  GGMWWE5Q 03/09 09:09 scandovieri41@hotmail.com
  5O6U1GCW 03/09 15:31 rodrigoaugusto@hotmail.com
  IVU666FZ 06/09 11:58 gabriel.pereira@p-excellence.com.br
5O6U1GCW e IVU666FZ tem o registro duravel para_frank_orfa_* e entram na ronda.
GGMWWE5Q NAO tem: esse aviso so existe como linha de dedupe, e a idempotencia
impede que ele saia de novo. Nao apurei se essas 3 pessoas seguem sem acesso.

NADA FOI TOCADO: nenhum saldo mexido, nenhuma compra vinculada a conta nenhuma
(vinculo e humano, regra do #239), e o R$97 nao foi devolvido — dinheiro de
Hotmart nao e credito e nao esta na alcada da 9-B.`;

(async () => {
  const db = supa();

  // 1) duplicata? se a BUSCA falhar, PARA.
  const { data: todos, error } = await db.from("incidents")
    .select("id,numero,title,status,signature,created_at")
    .order("created_at", { ascending: false }).limit(500);
  if (error) { console.error(`PARANDO — a busca de duplicata falhou: ${error.message}`); process.exit(1); }
  console.log(`contraprova: ${todos.length} incidentes lidos`);

  const porSig = todos.filter((i) => i.signature === SIGNATURE);
  const parecidos = todos.filter((i) => /orfa|órfã|orphan|UKC2COC2|rodrigo\.limas/i.test(`${i.title} ${i.signature}`));
  console.log(`\nmesma signature: ${porSig.length}`);
  for (const i of porSig) console.log(`  #${i.numero} ${i.status} ${String(i.title).slice(0, 90)}`);
  console.log(`\nparecidos (orfa/orphan/UKC2COC2): ${parecidos.length}`);
  for (const i of parecidos) console.log(`  #${i.numero} ${i.status} ${String(i.title).slice(0, 110)}`);

  if (porSig.length) { console.log("\nJA EXISTE chamado com esta signature — nao abro outro."); return; }

  const numero = Math.max(0, ...todos.map((i) => Number(i.numero) || 0)) + 1;
  const agora = new Date().toISOString();
  const linha = {
    kind: "frank:aviso_orfa_nao_disparou",
    cause: "bug",
    status: "open",
    signature: SIGNATURE,
    title: TITULO,
    occurrences: 1,
    affected_emails: ["rodrigo.limas.1978@gmail.com"],
    sample_error: "payment_events 06/09 14:13 PURCHASE_APPROVED rec#2 R$97 APPROVED, processed_at 14:13:05, error=null; agent_state sem para_frank_orfa_UKC2COC2; orphan_alerts (13 entradas) sem UKC2COC2",
    reported_by: "frank",
    description: DESCRICAO,
    first_seen_at: "2026-09-06T14:13:04Z",
    last_seen_at: agora,
  };

  if (!CONFIRMAR) {
    console.log(`\n--- ENSAIO (sem --confirmar nada e gravado) ---`);
    console.log(`numero que seria usado: #${numero}`);
    console.log(JSON.stringify({ ...linha, description: linha.description.slice(0, 300) + " […]" }, null, 2));
    return;
  }

  const { data: novo, error: e2 } = await db.from("incidents").insert({ ...linha, numero }).select("id,numero,title,status");
  if (e2) { console.error("ERRO ao inserir:", e2.message); process.exit(1); }
  if (!novo || novo.length !== 1) { console.error(`ESCRITA SUSPEITA: ${novo?.length} linha(s) devolvida(s)`); process.exit(1); }
  console.log(`\nABERTO: #${novo[0].numero} (${novo[0].id}) status=${novo[0].status}`);
})();
