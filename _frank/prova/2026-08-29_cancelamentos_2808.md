# Cancelamentos de 28/08/2026 — apuração

Rodado em 29/08. Ferramenta: `_frank/ferramentas/cancelamentos_ontem.cjs`
(somente leitura — nenhum saldo foi tocado por esta apuração).

## Resumo
5 eventos SUBSCRIPTION_CANCELLATION -> 5 pessoas distintas.
2 assinantes que pagaram, 3 trials que nunca pagaram.
Nenhuma das 5 tem outra assinatura viva na Hotmart (armadilha 2 conferida:
o endpoint `/subscriptions?subscriber_email=` respondeu com dados para as 5,
uma assinatura cada, todas CANCELLED — não foi zero por consulta vazia).

## O que está fora da regra
A varredura `expire_trial_credits` continua **DESATIVADA** desde 18/08
(motivo gravado no corpo da função: "a primeira rodada real zerou 14 pessoas").
Conferido lendo `pg_get_functiondef` — leitura inerte, a RPC não foi chamada.

Consequência: crédito de mensalidade de trial que saiu não expira sozinho.

| e-mail | dia 10 do trial | credits_subscription parado |
|---|---|---|
| cleutonvalentim82@gmail.com | 2026-08-13 (já passou) | 90.000 |
| clonefiuza@gmail.com | 2026-09-04 (ainda vai chegar) | 76.259 |
| definidameta@gmail.com | 2026-09-04 (ainda vai chegar) | 53.321 |

Total parado nestes 3: 219.580 créditos de mensalidade.

## O que está certo
- csitya100@gmail.com e contato@rdrdigital.com.br pagaram a rec#2 (R$97
  COMPLETE) e **mantiveram** o crédito. Nenhum lançamento de zeramento em
  `credit_transactions`, nenhum marcador em `trial_credit_expirations`.
  Regra 9 cumprida.
- Nenhum estorno/chargeback na janela.

## Falso alarme conferido
`definidameta@gmail.com` aparece com `credits_extra = -1575`. Não é erro:
são 3 avatares de onboarding a -525 cada, com a nota
"[onboarding: pode ficar negativo]" no próprio lançamento. Comportamento
esperado.

## Armadilha 1 (a que custou 1.356.554 cr em 18/08)
cleutonvalentim82 tem uma rec#2 de R$97 **OVERDUE** — cobrança emitida, nunca
paga. Classificar por `price.value > 0` puro o transformaria em "assinante" e
ele apareceria como quem mantém crédito. O critério usado foi valor > 0 **E**
status COMPLETE/APPROVED. Ele é trial.

## Saídas cruas
- `2026-08-29_cancelamentos_2808.txt`  — saída legível
- `2026-08-29_cancelamentos_2808.json` — saída estruturada (Hotmart + banco)
