#!/usr/bin/env node
/**
 * Abre o incidente medido na ronda do Vigia de 17/09 10hZ:
 * o codigo que zera credito em estorno subiu para a main em 14/09, mas a
 * funcao que ele chama NUNCA FOI CRIADA no banco. Todo evento de dinheiro
 * devolvido desde entao morre com 500 e fica sem processar.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = ["paula@handelhomes.com"];

const TITULO =
  "O CODIGO QUE ZERA CREDITO EM ESTORNO SUBIU SEM A MIGRATION E QUEBRA O WEBHOOK: " +
  "refund.ts:33 chama zero_subscription_credits_on_refund, que NAO EXISTE no banco (medido: 0 linhas em pg_proc). " +
  "Desde o merge de 14/09 sao 2 eventos de dinheiro devolvido e 2 de 2 morreram com 500 e ficaram com processed_at NULL. " +
  "Paula Handel teve o dinheiro de volta e continua com 171.029 creditos de mensalidade e ZERO lancamento de estorno no livro-razao";

const DESCRICAO = `MEDIDO POR MIM (VIGIA) NA RONDA DE 17/09 10hZ, EM PRODUCAO.
Nasceu do bucket "ERRO QUE ESTA VARREDURA NAO SABE CLASSIFICAR" do
varrer_erros_webhook.cjs — ou seja, a casa vinha registrando o erro e ninguem
tinha classe pra ele. Nenhum cartao existia (conferido no §1 abaixo).

=====================================================================
O DEFEITO, EM UMA LINHA
=====================================================================
O CHAMADOR foi mergeado na main; a DDL que cria a funcao chamada NAO foi
aplicada. Chamador em producao + funcao ausente = excecao garantida em todo
evento de estorno/chargeback/protesto.

  frontend/src/lib/credits/refund.ts:33
      getAdmin().rpc("zero_subscription_credits_on_refund", {...})
  frontend/src/lib/credits/refund.ts:38
      if (error) throw new Error(...)            <- LANCA
  frontend/src/app/api/v1/webhooks/hotmart/route.ts:393
      const zeroed = await zeroSubscriptionCreditsOnRefund({...})
      (dentro de isMoneyReturnedStatus, linha 379)
  scripts/111_estorno_zera_credito.sql:46
      create or replace function public.zero_subscription_credits_on_refund(...)
      <- ESTE ARQUIVO NUNCA FOI APLICADO NO BANCO

Quando o chamador subiu: commit 0776768, 14/09 ("Estorno/chargeback/protesto
zera o credito de mensalidade (mig 82) (#4)"). Nenhum commit posterior na
origin/main aplica a DDL.

=====================================================================
A PROVA DE QUE A FUNCAO NAO EXISTE (nao e leitura de log, e o catalogo)
=====================================================================
  select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname ilike '%zero_subscription%';
  -> 0 linhas, medido 17/09 10:11Z.
O proprio repo ja sabia: scripts/111_estorno_zera_credito.sql:5 carrega o aviso
"ESTADO EM 15/09: **NAO APLICADA**". O que o arquivo NAO sabia, e este cartao
acrescenta, e que o chamador ja esta vivo e agora QUEBRA o webhook — o arquivo
diz apenas que "a regra 9 segue SEM efeito", que e menos grave do que o medido.

=====================================================================
O ESTRAGO MEDIDO — e o que ele NAO e
=====================================================================
Eventos de dinheiro devolvido desde 14/09 (PURCHASE_REFUNDED/CHARGEBACK/PROTEST):

  PURCHASE_PROTEST    16/09 08:38:05Z  paula@handelhomes.com  processed_at NULL
  PURCHASE_REFUNDED   16/09 09:03:41Z  paula@handelhomes.com  processed_at NULL

  total 2 · com erro do RPC 2 · nao processados 2  -> 2 de 2 = 100%

AFIRMA: a taxa de falha no recorte e 100%, e nao ha caminho de recuperacao —
o webhook responde 500, a Hotmart reenvia ate 5x, todas as 5 batem na mesma
funcao ausente, e o evento fica sem processed_at PARA SEMPRE. Nao existe
varredor que volte nesses eventos.
NAO AFIRMA que o estrago e grande: n=2, uma pessoa so. O recorte e pequeno
porque estorno e raro, nao porque o defeito seja intermitente.

CONFERENCIA DE DINHEIRO, pela regra do §3.3 da ordem de 27/08
(por ref_type, NUNCA por kind — a armadilha que quase pagou 13 alunos em dobro):
  credit_transactions where user_id=17b2774c-... and ref_type='estorno'  -> 0 linhas
  profiles: credits_subscription = 171.029 · credits_extra = 0
  acesso: SEM ACESSO
Ou seja: revokeAccess FUNCIONOU (a porta fechou), o defeito e confinado ao
credito. Ela recebeu o dinheiro de volta e ficou com 171.029 creditos de
mensalidade que a regra 9 mandava zerar.

NAO AFIRMA que ela abusou disso: a ultima geracao dela e de 14/08 05:01Z,
ANTERIOR ao estorno (16/09). Nao houve consumo depois do dinheiro voltar.
O risco e futuro, nao um prejuizo ja consumado.

=====================================================================
POR QUE ISSO E ERRO DE SISTEMA (teste de bolso da ordem de 27/08)
=====================================================================
"Se o codigo/infra estivesse certo, isso nao teria acontecido?" SIM.
Mergear um chamador na frente da sua migration e defeito de codigo/deploy,
nao decisao de negocio. A DECISAO (aplicar ou nao a DDL que mexe em dinheiro
de aluno) e do Johnny pela regra 21 e esta no relatorio da ronda — mas o
webhook quebrado nao depende de decisao nenhuma pra ser defeito.

Agravante: a falha e SILENCIOSA pra casa. Ela so aparece em
payment_events.error, num bucket que a propria varredura rotula como
"erro que esta varredura nao sabe classificar". Ninguem e avisado quando um
estorno deixa de ser processado.

=====================================================================
AS TRES CHECAGENS OBRIGATORIAS (§3 da ordem de 27/08)
=====================================================================
1) "JA EXISTE?" NAO. Procurei na fila ABERTA E FECHADA por
   signature/title ilike '%zero_subscription%', '%schema cache%' e
   '%handelhomes%' / affected_emails. Zero linhas. Nao e reincidencia de
   classe aberta, nao e duplicata (o erro do #112).
2) "JA FOI CORRIGIDO?" NAO.
   - git log origin/main: o unico commit que toca refund.ts e o 0776768 que
     CRIOU o problema. Nada aplica a DDL depois.
   - gh pr list --state open: o PR #189 (fix/estorno-zera-e-nao-ressuscita)
     entrega scripts/108_estorno_zera_credito.sql, que e a MESMA DDL com o
     numero velho (ela foi renumerada pra 111 em 15/09 porque havia cinco
     arquivos 108_*.sql distintos). Mergear o #189 NAO resolve: merge nao
     aplica DDL. A funcao so passa a existir quando alguem RODAR o script.
   - Conferido no catalogo do banco hoje: continua ausente.
3) DINHEIRO: arquivo:linha de onde o debito nasceria e de onde a chamada sai
   estao no topo; a conferencia do ledger foi por ref_type e esta acima.
   Nao e nada do que e "gratis por design" (amostra, bypassesBilling de admin,
   refeito por conta da casa, onboarding negativo): e credito de mensalidade
   que a regra manda zerar e que nao foi zerado.

=====================================================================
O QUE EU NAO FIZ (14-A)
=====================================================================
Nao apliquei a DDL, nao toquei em credito da Paula, nao reprocessei evento,
nao escrevi pra ela e nao abri PR. Diagnostico pronto, decisao e conserto sao
do Frank/Johnny.

=====================================================================
COMO REPRODUZIR / CONFERIR
=====================================================================
  select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname ilike '%zero_subscription%';
  -- hoje: 0 linhas. CONTROLE: se devolver 1 linha, a DDL foi aplicada depois
  -- desta ronda e este cartao ja nasceu resolvido — confira antes de agir.

  select event_type, buyer_email, received_at, processed_at, left(error,120)
    from payment_events
   where error ilike '%zero_subscription_credits_on_refund%'
   order by received_at desc;
  -- hoje: 2 linhas, ambas processed_at NULL.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "vigia:estorno-rpc-ausente-webhook-500",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 2,
    affected_emails: AFETADOS,
    reported_by: "vigia",
    first_seen_at: "2026-09-16T08:38:05.295Z",
    last_seen_at: "2026-09-16T09:03:41.658Z",
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
