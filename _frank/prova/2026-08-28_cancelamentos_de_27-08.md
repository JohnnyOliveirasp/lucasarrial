# Cancelamentos de 27/08/2026 — apurado em 28/08

Comando: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-08-27`
Janela UTC 2026-08-27T00:00 -> 2026-08-28T00:00.
**6 eventos `SUBSCRIPTION_CANCELLATION` -> 6 pessoas** (nenhum e-mail repetido).

Classificação feita na **Hotmart viva** (`GET /subscriptions/{code}/purchases`,
array puro), por PESSOA: para cada e-mail foram lidas TODAS as assinaturas e
TODAS as cobranças. Pagou = `price.value > 0` **E** status COMPLETE/APPROVED
(OVERDUE não é pagamento — armadilha que custou 1.356.554 cr em 18/08).

**2 trials · 3 assinantes · 1 contestação (chargeback em aberto).**
Armadilha 2 checada: **ninguém do dia tem outra assinatura viva.** O único com
duas assinaturas é `instrutormarciopaz` (04DG4IOU INACTIVE + T27Z7SLG
CANCELLED_BY_CUSTOMER) — nenhuma das duas está de pé.

## O que está fora da regra

### 1. marlon@bianchitour.com — pagou, contestou 40 min depois, ficou com 200.000 cr

Linha do tempo dos `payment_events` (varrendo as 4.587 linhas da tabela, não a
página default de 1.000 — a primeira consulta devolveu 0 por causa do cap e
isso **não** foi tratado como "não tem evento"):

| quando (UTC) | evento | o que diz |
|---|---|---|
| 2026-08-20 12:04 | PURCHASE_APPROVED | rec#1 R$0 (trial) -> creditou 100.000 |
| 2026-08-27 14:12 | PURCHASE_APPROVED | rec#2 **R$97 pago** -> creditou +100.000 |
| 2026-08-27 14:50 | SUBSCRIPTION_CANCELLATION | cancelou |
| 2026-08-27 14:52 | PURCHASE_PROTEST | **status DISPUTE** no R$97 |
| 2026-08-28 07:13 | PURCHASE_COMPLETE | rec#1 R$0, transação antiga HP1334962589 |

Estado hoje: `credits_subscription` **200.000**, `credits_extra` 0,
`access_until` **2026-09-20**. As duas únicas transações são os dois
`subscription_grant` de 100.000 ("recarga do ciclo"). **Nenhum débito.**

Dois problemas distintos, e o segundo é o que some com a prova:

**(a) Não existe máquina que zere crédito por estorno.** `revokeAccess`
(`frontend/src/lib/payments/entitlements.ts:70`) só atualiza `status` do
entitlement e recalcula acesso — não toca em `credits_subscription`, por
construção. Os 3 estornos que de fato foram zerados no histórico foram zerados
**na mão**: `kind=adjustment`, `ref_type=estorno`, nota literal *"Estorno da
compra pedido pela aluna e processado (dinheiro devolvido). O credito acompanha
o dinheiro. Decisao do Johnny 18/08/2026."* Ou seja: não é automação quebrada,
é uma decisão humana que ainda não foi tomada neste caso.

**(b) O entitlement perdeu a marca de chargeback.** Hoje ele está
`status="canceled"`, não `"chargeback"`, com `updated_at` 2026-08-28T07:13:42 —
carimbo exato do `PURCHASE_COMPLETE`. O caminho de grant do webhook
(`webhooks/hotmart/route.ts:204-214`) vê `subscription.status=CANCELED` e chama
`revokeAccess({status:"canceled"})`, sobrescrevendo o `"chargeback"` que o
PROTEST tinha gravado 17h antes. Crédito não muda (só APPROVED credita), mas
**a contestação some do registro** — quem olhar o entitlement amanhã vê um
cancelamento comum. Nenhum `payment_events.error` foi gravado nos 4 eventos:
do ponto de vista do webhook, tudo "deu certo".

Detalhe que importa pra decisão: é **DISPUTE**, não `REFUNDED`. O dinheiro está
contestado, não devolvido. Se a disputa cair pro lado do Marlon, ele fica com
um mês de crédito por R$97 que voltou pra ele.

### 2. clonedigitaldaniel@gmail.com — trial cujo crédito não vai expirar sozinho

33.037 cr de mensalidade, adesão 2026-08-22, dia 10 vence **2026-09-01** (ainda
dentro do prazo). Mas a varredura `expire_trial_credits` continua
**DESATIVADA** — motivo no corpo vivo da função: *"DESATIVADA POR FRANK EM
18/08 18:5x: a primeira rodada real zerou 14 pessoas"*. Quando o dia 1º chegar,
não vai acontecer nada. Mesmo custo conhecido de manter a varredura desligada
desde 18/08; não é bug novo.

Lido por `pg_get_functiondef` (inerte). A RPC **não** foi chamada de propósito:
chamar executaria a varredura a partir de um relatório somente-leitura.

O `credits_extra` = -10.000 dele é esperado: treino de voz no onboarding,
marcado `[onboarding: pode ficar negativo]`. Não é zeramento de rotina.

## O que NÃO é problema (checado e descartado)

- **Nenhum assinante teve crédito zerado.** Os 3 pagantes mantêm o saldo —
  regra 9 cumprida no lado que tira:
  - `morgensterncarlos78` 192.380 cr · `danielvsferreira` 139.825 cr ·
    `instrutormarciopaz` 154.169 cr. Zero lançamentos de zeramento nos três.
- **`instrutormarciopaz` com marcador `paid (0 cr, 2026-08-18)`** é o desfecho
  certo: `outcome=paid`, `debited=0`. Ele pagou 3 ciclos (R$0 + R$97 + R$97).
- **`draellenca` com mensalidade 0 cr** não é zeramento: ela gastou o trial
  (sobraram 444 cr de extra) e o acesso venceu em 28/08 naturalmente.

## Achado de fora da janela (não é de ontem, mas é dinheiro parado)

`alexsander20196@gmail.com` — entitlement `refunded` desde **2026-08-19**, ainda
com **130.619 cr** e nenhum lançamento de zeramento. Pelo mesmo motivo do
item 1(a): o zeramento por estorno é manual e este passou batido. Fica
registrado aqui porque apareceu na varredura dos 8 estornos históricos.

## Nada foi alterado

Somente leitura, do começo ao fim. Nenhum saldo tocado — regra 9-A: detector
propõe, quem executa é a varredura (parada) ou o Johnny na mão.

## A decisão que sobra pro Johnny

1. **Marlon**: zerar os 200.000 agora ou esperar a disputa fechar? É a mesma
   decisão do 18/08, e só ele toma.
2. **Alexsander**: 130.619 cr de um estorno de 9 dias atrás, mesma pergunta.
3. O item 1(b) (chargeback virando "canceled") é bug de código e vale card
   próprio — a ordem dos webhooks apaga a marca da contestação.
