# Cancelamentos de 30/08/2026 — apuração

Rodado em 31/08. Ferramenta: `_frank/ferramentas/cancelamentos_ontem.cjs`
(somente leitura — **nenhum saldo foi tocado por esta apuração**).

## Resumo
4 eventos SUBSCRIPTION_CANCELLATION -> 4 pessoas distintas.
**3 assinantes que pagaram, 1 trial que nunca pagou.**

Armadilha 2 conferida: nenhuma das 4 tem outra assinatura viva na Hotmart.
O endpoint `/subscriptions?subscriber_email=` respondeu **com dados** para as
4 (1 assinatura cada, todas CANCELLED) — não foi zero por consulta vazia.

## O que está fora da regra

### julia_azambuja@outlook.com — trial que nunca pagou, 73.500 cr parados
Aderiu 05/08, cancelou 30/08 (25 dias). O dia 10 do trial dela venceu em
**2026-08-15 — há 16 dias** — e o crédito de mensalidade continua lá.

Não é caso isolado nem culpa dela: a varredura `expire_trial_credits` continua
**DESATIVADA** desde 18/08 (motivo gravado no corpo da própria função: *"a
primeira rodada real zerou 14 pessoas"*). Conferido lendo `pg_get_functiondef`
— leitura inerte, a RPC **não** foi chamada.

Origem do saldo conferida em `credit_transactions` (9 lançamentos): a única
entrada é **um** `subscription_grant | payment_event` de 100.000 em 05/08.
Não há Stripe, bônus, cortesia nem estorno. Ela consumiu 26.500 cr (1 treino de
voz, 6 imagens, 2 vídeos clone) e restam 73.500. Acesso até 05/09.

⚠️ Isto **não** foi zerado por mim e não deve ser: regra 9-A — detector propõe,
nunca executa. Quem age é a varredura, e é a varredura que precisa voltar.

### O problema é maior que o dia: 64 pessoas, 4.933.361 cr
Medido hoje com `backlog_trial.cjs` (somente leitura):

| situação | pessoas | crédito parado |
|---|---|---|
| já passou do dia 10 | 43 | 3.322.699 cr |
| ainda no prazo (mas não há máquina para cumprir o prazo) | 21 | 1.610.662 cr |
| **total** | **64** | **4.933.361 cr** |

Julia é 1 dessas 43. O backlog cresce todo dia enquanto a varredura estiver
desligada. Já reportado nas rondas de 28/08, 29/08 e 30/08 — **continua aberto**.

## O que está certo
- **natanaelvarela@hotmail.com** — pagou rec#1 R$17 APPROVED (18/08).
  Mantém 4.426 cr de mensalidade + 525 extra. Regra 9 cumprida.
- **victorbsb@gmail.com** — pagou rec#2 R$97 COMPLETE e rec#3 R$97 APPROVED.
  Mantém 200.000 cr. Marcador `trial_credit_expirations` = `paid` (0 cr).
- **rossiclinicas@gmail.com** — pagou rec#2 e rec#3 (R$97 COMPLETE cada).
  Mantém 100.000 cr + 10.000 extra. Marcador = `paid` (0 cr).

Nos 3, **zero** lançamentos de zeramento em `credit_transactions` e nenhum
marcado como `zeroed`. Ninguém que pagou perdeu crédito.
- Nenhum estorno/chargeback na janela.

## Armadilha 1 (a que custou 1.356.554 cr em 18/08)
`julia_azambuja` tem uma rec#2 de **R$97 OVERDUE** — cobrança emitida, nunca
paga. O critério da ordem escrita ("`price.value > 0` = pagou") a classificaria
como **ASSINANTE** e este relatório teria dito "mantém o crédito, tudo certo".
O critério usado foi valor > 0 **E** status COMPLETE/APPROVED — mesmo filtro do
`pagou_de_verdade.cjs`. Ela é trial.

⚠️ Vale corrigir a ordem escrita da rotina: `value > 0` sozinho está errado e é
exatamente a armadilha que já custou 1,35 milhão de créditos.

## Saídas cruas
- `2026-08-31_cancelamentos_3008.txt`  — saída legível
- `2026-08-31_cancelamentos_3008.json` — saída estruturada (Hotmart + banco)
- `2026-08-31_backlog_varredura_desligada.txt` — as 64 pessoas do backlog
