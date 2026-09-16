/**
 * Abre o incidente: a TELA DE CREDITOS esconde o saldo e diz "Assine para
 * liberar seus creditos" para quem PAGOU, parou de pagar e AINDA TEM saldo —
 * saldo esse que continua funcionando normalmente no motor.
 *
 * Medido na ronda das falhas de 16/09 ~01h40Z, a partir do caso do Luciano (#99).
 *
 *   node 2026-09-16_abrir_creditos_invisiveis_pos_vencimento.cjs [--confirmar]
 */
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const { supa } = require(path.join(RAIZ, "_frank/ferramentas/_comum.cjs"));
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "A TELA DE CREDITOS DIZ 'ASSINE PARA LIBERAR SEUS CREDITOS' PARA QUEM JA PAGOU E AINDA TEM SALDO: 102 alunos pagantes com 23.598.446 creditos VALIDOS nao enxergam o proprio saldo depois que a data da assinatura passa. Os creditos FUNCIONAM (o motor cobra por saldo, nao por assinatura) — quem mente e a tela. A regra da casa, fechada pelo Johnny em 20/08, diz 'MANTEM O ACESSO, nao ha trava, nao ha saldo parado, nao ha confisco'; o motor cumpre e a interface contradiz.";

const DESCRICAO = `O MOTOR ESTA CERTO — E ISSO E A PARTE IMPORTANTE DO CARTAO

Conferido rota por rota (arquivo:linha). Em TODAS, a checagem de saldo vem
PRIMEIRO e o hasActiveAccess so e lido DENTRO do ramo de falha, para preencher
o campo 'subscribed' do 402. Ou seja: com saldo, a acao passa e a data da
assinatura nunca e consultada.

  api/v1/voices/[id]/generate/route.ts:177    if (bal.total < creditCost) {...}
  api/v1/voices/[id]/start-training/route.ts:104  if (bal.total < TRAINING_CREDIT_COST) {...}
  api/v1/videos/[id]/videos/route.ts:155      if (total < need) {...}
  lib/studio/billing.ts:30                    if (bal.total >= args.cost) return {ok:true}
  lib/video/sales.ts:52                       if (bal.total >= SALES_AI_COST) return {deny:null}

E o gate de tela ja foi desligado de proposito, com a ordem citada no codigo:
  app/[locale]/app/layout.tsx:95   "Entrada LIVRE: (...) O paywall nao bloqueia
                                    mais o acesso"
  app/[locale]/app/roteiro/page.tsx:52  "subscribed continua existindo SO pra
                                    escolher o texto do aviso e o destino do
                                    CTA — nao tranca mais nada (ordem do Johnny 18/08)"
  app/[locale]/app/voice-cloning/page.tsx:65  canTrain = team || creditsTotal >= CUSTO

CONCLUSAO DESSA PARTE: NINGUEM esta trancado. Eu cheguei a medir 223 pagantes
"trancados" e o numero e ARTEFATO — derrubei antes de virar achado. Registro
aqui para a proxima ronda nao reabrir essa hipotese.

────────────────────────────────────────────────────────────────────────────
O DEFEITO DE VERDADE: app/[locale]/app/credits/page.tsx

  :41  const subscribed = hasActiveAccess(email, access_until, access_source)
  :57  {(unlimited || subscribed) && ( ...painel com o SALDO... )}
  :76  {!unlimited && !subscribed && ( <h2>Assine para liberar seus creditos</h2> )}
  :97  {!unlimited && subscribed && ( ...comprar pacote avulso... )}

Com access_until no passado, subscribed=false e a tela:
  1. ESCONDE o painel de saldo (:57) — inclusive o bloco rotulado
     "Avulsos (nao expiram)", que e literalmente o que nao expira;
  2. exibe "Assine para liberar seus creditos" (:76) — afirmando que o credito
     esta PRESO atras de uma assinatura, que e exatamente o confisco que a
     ordem de 20/08 proibiu com todas as letras.

A CAUSA e uma premissa escrita no proprio comentario da :55:
     "Saldo: so faz sentido pra assinante/equipe. Nao-assinante (0/0) so ve o
      convite pra assinar abaixo."
O autor assumiu que nao-assinante tem saldo 0/0. Para a classe deste cartao —
quem pagou, parou, e guardou saldo — a premissa e FALSA. A regra da casa cria
exatamente essa populacao: "nao tera mais creditos novos e usa os que tem ate
acabar".

TAMANHO, MEDIDO NO BANCO VIVO (16/09 ~01h40Z)
  102 pessoas · 23.598.446 creditos · menor saldo 7.702 · maior 497.105
Recorte: pagou (payment_events com price.value > 0 e status APPROVED/COMPLETED
/COMPLETE) + access_until < now() + saldo > 0, fora da allowlist da equipe.
Mais 121 pagantes (24.340.125 cr) entram nessa faixa nos proximos 7 dias.

⚠️ LIMITE DECLARADO: o casamento e por E-MAIL (payment_events.buyer_email x
profiles.email). Quem pagou com um endereco e usa a conta em outro nao aparece —
mesmo limite do saida_x_assinatura.cjs. O numero e piso, nao teto.

COMO REPRODUZIR / CONFERIR (controle positivo embutido)
  with saldo as (select user_id, sum(amount)::bigint bal from credit_transactions group by 1),
       pagou as (select distinct lower(buyer_email) email from payment_events
         where (payload#>>'{data,purchase,price,value}')::numeric > 0
           and payload#>>'{data,purchase,status}' in ('APPROVED','COMPLETED','COMPLETE'))
  select count(*), sum(s.bal) from profiles p
    join saldo s on s.user_id=p.id join pagou pg on pg.email=lower(p.email)
   where p.access_until < now() and s.bal > 0;
CONTROLE POSITIVO: lucianodepinho@gmail.com tem que aparecer nesse recorte a
partir de 19/09 12:00Z (hoje ele esta na faixa dos 7 dias, saldo 166.035). Se
ele NAO aparecer depois dessa data, o instrumento cegou — nao acredite no zero.

O CASO QUE ORIGINOU (por que isto nao e teoria)
Luciano de Pinho (#99, 23 dias de fila) pediu cancelamento em 15/09 08:51 BRT e
confirmou 08:58. A assinatura LGKZLCLN foi cancelada (CANCELLED_BY_SELLER) e a
cobranca de 19/09 nao acontece. Mas ele recebeu DOIS e-mails nossos com 7
minutos de diferenca dizendo coisas opostas:
  11:55Z (uid 2413) "seus 166.035 creditos (...) voce pode usar ate acabar, sem pressa"
  12:02Z (uid 2416) "seu acesso e os creditos (...) continuam disponiveis ate 19/09/2026"
O segundo — o ULTIMO que ele leu — esta errado, e em 19/09 a tela vai CONFIRMAR
a mentira para ele. Foi assim que este cartao nasceu.
Ele foi avisado por e-mail em 16/09 com a correcao e com este defeito declarado
ANTES de ele esbarrar nele.

ESTA CLASSE JA BATEU NA PORTA ANTES (contexto, NAO estou reabrindo nada)
  #48 (ignored, 19/08) Josilene achava que perderia 185.969 cr no vencimento.
      A analise de la esta CERTA e continua certa: o saldo dela nao zerava. Foi
      fechada como premissa errada da aluna — e eu concordo com o fechamento.
      Cito porque a PERGUNTA dela e a mesma do Luciano, com 27 dias de
      distancia: os alunos acreditam que o credito morre na data. Este cartao
      nao contesta o #48; ele identifica UM mecanismo concreto que ensina essa
      crenca (a propria tela), o que o #48 nao tinha como ver — no caso dela o
      acesso ainda estava vigente, entao a tela ainda mostrava o saldo.
  #136 (fixed, 25/08) a Fast prometia "creditos nao expiram nunca" a trial R$0.
      Corrigido no manual (f334c8d). E o espelho deste: la a casa prometia de
      MAIS para quem nao tinha direito; aqui ela nega o que o aluno TEM.

O QUE NAO FOI FEITO, DE PROPOSITO
Nao escrevi codigo e nao abri PR: a tela de credito e superficie de produto e a
escolha entre "mostrar saldo com aviso de que nao recarrega" e outra redacao e
do Johnny/Lucas, nao minha. O diagnostico esta pronto e o conserto e pequeno
(trocar a condicao das :57/:76 de 'subscribed' para 'subscribed || saldo > 0').
Nao mexi em credito, acesso, assinatura nem GPU de ninguem.`;

const AFETADOS = ["lucianodepinho@gmail.com"];

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "frank:creditos-invisiveis-pos-vencimento",
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
