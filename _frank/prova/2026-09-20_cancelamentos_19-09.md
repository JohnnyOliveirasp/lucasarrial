# Cancelamentos de 19/09/2026 — ronda de 20/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs` (janela UTC
`2026-09-19T00:00:00Z → 2026-09-20T00:00:00Z`).
4 eventos `SUBSCRIPTION_CANCELLATION` → **4 pessoas distintas**.
Ronda somente-leitura: **nenhum saldo foi tocado** (regra 9-A).
JSON cru: `_frank/prova/2026-09-20_cancelamentos_19-09.json`.

## 🔴 O que vem PRIMEIRO — os 2 trials não vão expirar sozinhos

```
varredura expire_trial_credits: DESATIVADA — "DESATIVADA POR FRANK EM 18/08 18:5x:
a primeira rodada real zerou 14 pessoas"
```

Lido do corpo vivo da função (`pg_get_functiondef`), não do log. A RPC **não é
chamada** de propósito: chamar executaria a varredura, e esta ronda é
somente-leitura.

Pela regra 9, o crédito de mensalidade de quem cancelou **dentro do trial sem
nunca pagar** expira no dia 10 da adesão. Os dois trials de ontem ainda estão
**dentro do prazo** — mas a máquina que cumpre o prazo está parada desde 18/08,
então quando o dia 10 chegar não vai acontecer nada:

| pessoa | dia 10 cai em | crédito parado |
|---|---|---|
| `felipe.liima.eng@gmail.com` | 22/09 | 47.724 cr |
| `hrmarinscatequese@gmail.com` | 26/09 | 70.575 cr |

**118.299 cr** somados só desta ronda. Isso **não é achado novo**: é a mesma
decisão consciente de 18/08 (desligado continua melhor que zerar pagante), já
reportada na ronda de 18/09. O que muda a cada dia é só o tamanho do passivo.
Religar a varredura é decisão do Johnny, não minha.

## As 4 saídas

| e-mail | tipo | ficou | o que aconteceu com o crédito |
|---|---|---|---|
| `felipe.liima.eng@gmail.com` | TRIAL | 7 dias (12/09→19/09) | 47.724 cr **deviam** expirar em 22/09; varredura off, não expiram |
| `hrmarinscatequese@gmail.com` | TRIAL | 3 dias (16/09→19/09) | 70.575 cr **deviam** expirar em 26/09; varredura off, não expiram |
| `mariliarossini@gmail.com` | ASSINANTE | 11 dias (08/09→19/09) | **manteve** 178.598 cr, acesso até 08/10 — correto |
| `allysoncruz.nutri@gmail.com` | ASSINANTE | 31 dias (19/08→19/09) | **manteve** 120.630 cr + 125.797 extra, acesso até 19/10 — correto |

**Nenhum pagante foi zerado.** `credit_transactions` não tem um único
lançamento de zeramento por rotina (`trial_expirad`/`estorno`/`refund`/
`chargeback`) para os quatro. `trial_credit_expirations` não tem marcador de
nenhum deles.

## Classificação: por PESSOA, e pelo dinheiro que entrou

- **Nenhuma das 4 tem outra assinatura viva.** Cada uma tem exatamente **uma**
  assinatura na Hotmart, e ela está cancelada. A armadilha "cancelou um trial
  mas tem outro contrato de pé" não se aplica aqui — foi conferida, não
  presumida (`outrasAssinaturasVivas: []` nas quatro).
- **Pagou = valor > 0 E status COMPLETE/APPROVED.** As duas assinantes têm
  cobrança real de R$97 (`mariliarossini` rec#2 em 15/09; `allysoncruz` rec#2 em
  26/08 e rec#3 em 19/09). Os dois trials têm **só** rec#1 de R$0. Nenhum caso
  ambíguo nesta ronda — nenhum `OVERDUE`/`PRINTED_BILLET` para confundir, ao
  contrário da ronda de 17/09.
- Todas as 4 assinaturas aparecem com `trial: true` na Hotmart: isso marca que
  o contrato **começou** com trial, não que a pessoa nunca pagou. Quem decide é
  a cobrança.

## Estorno / chargeback — nenhum em 19/09, e isso foi medido

Nenhuma das 4 pessoas tem cobrança em `REFUNDED`/`CHARGEBACK`/`PROTESTED`. Além
disso varri `payment_events` na janela por `PURCHASE_REFUNDED`,
`PURCHASE_CHARGEBACK` e `PURCHASE_PROTEST`: **0 eventos**.

Zero não é prova, então a contraprova: a mesma consulta enxerga **14**
`PURCHASE_REFUNDED` e **3** `PURCHASE_CHARGEBACK` no histórico. O instrumento
funciona — o vazio é vazio de verdade.

Isso importa porque o bug do estorno (`#446`, `zero_subscription_credits_on_refund`
não existe no banco / migration 111 não aplicada) fez vítima nova em **18/09**
(`vazilg@gmail.com`, R$97 devolvidos e 100.000 cr intactos, reportado na ronda
de ontem). **Em 19/09 ele não fez vítima nova — não porque foi corrigido, mas
porque ninguém pediu estorno.** O defeito segue armado. Incidente aberto, dono
definido, não reabri nem reinvestiguei (regra 14-A).

## Erro meu que quase virou achado falso: "a ronda de 18/09 não rodou"

Ia reportar um **buraco no histórico**: não havia
`_frank/prova/*_cancelamentos_18-09.*` no meu checkout, então a ronda de 19/09
não teria rodado. **Era mentira.** O relatório existe e está na `origin/main`
(`_frank/prova/2026-09-19_cancelamentos_18-09.md` + `.json`) — com 2 saídas,
`tonimekautocenter@gmail.com` (trial) e `ljm.larajmotta@gmail.com` (assinante
que manteve 293.950 cr).

A causa é a mesma armadilha do item 4 da ronda de 17/09: **checkout
desatualizado**. Eu estava na branch `feat/resumo-diario-grupo-suporte`, **680
commits atrás da `main`**. Ausência no disco não é ausência no projeto. Dei
`git fetch` e conferi contra `origin/main` antes de escrever — foi o fetch que
matou o achado falso.

Fica a regra prática: **antes de afirmar que um relatório/arquivo não existe,
confira contra `origin/main`, não contra a branch em que você está parado.**

## Como sei que a consulta não mentiu

A consulta a `payment_events` voltou com 4 linhas, não vazia — não precisei de
contraprova de "zero". O `data.subscriber.email` veio preenchido nos 4 eventos
(nenhum caiu no ramo que imprime payload cru). As chamadas à Hotmart
(`/subscriptions` + `/subscriptions/{code}/purchases`, que devolve **array
puro**) responderam nas 4 pessoas; qualquer falha de parse viraria `erro` no
JSON, e não há nenhum.

## O que NÃO foi feito, de propósito

Nenhum crédito zerado, nenhuma RPC de varredura chamada, nenhuma DDL aplicada.
Religar a `expire_trial_credits` e zerar o crédito do chargeback de 17/09 são as
duas coisas que fecham o vazamento, e as duas são decisão do Johnny (regra 9-A).
