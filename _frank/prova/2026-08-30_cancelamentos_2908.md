# Cancelamentos de 29/08/2026 — apuração

Rodado em 30/08. Ferramenta: `_frank/ferramentas/cancelamentos_ontem.cjs`
(somente leitura — nenhum saldo foi tocado por esta apuração).

## Resumo
3 eventos SUBSCRIPTION_CANCELLATION -> 3 pessoas distintas.
1 assinante que pagou, 2 trials que nunca pagaram.
Nenhuma das 3 tem outra assinatura viva na Hotmart (armadilha 2 conferida: o
endpoint `/subscriptions?subscriber_email=` respondeu com dados para as 3 —
francielly com 4 assinaturas, as outras com 1 cada. Não foi zero por consulta
vazia).

## O que está fora da regra

### 1. A varredura `expire_trial_credits` continua DESATIVADA (12º dia)
Desligada desde 18/08. Motivo gravado no corpo da própria função:
"DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas".
Conferido lendo `pg_get_functiondef` — leitura inerte, a RPC não foi chamada.

Backlog acumulado (`backlog_trial.cjs`, saída em
`2026-08-30_backlog_trial.txt`):

**64 pessoas, 4.933.361 créditos de mensalidade parados** que já deveriam ter
expirado ou vão vencer sem ninguém para executar.

Da apuração de ontem, entra nessa fila:

| e-mail | dia 10 do trial | credits_subscription parado |
|---|---|---|
| francielly.mazete@gmail.com | 2026-09-05 (ainda vai chegar) | 84.035 |

### 2. Assinante que pagou e está com 0 crédito — mas ninguém zerou
`jmo.usa.007@gmail.com` (Johnny Oliveira) pagou rec#1, #2 e #3 de R$20
(todas COMPLETE, 09/06, 09/07 e 09/08). Está com `credits_subscription = 0`.

**Não é o erro da regra 9.** Nenhuma rotina zerou o saldo dele: não existe
lançamento de `trial_expirado`/`estorno`/`subscription_expired` em
`credit_transactions`, e não há marcador em `trial_credit_expirations`.

O que aconteceu, na ordem:
- o perfil na plataforma só foi criado em **29/08 23:17** — depois dos três
  pagamentos. Os três ciclos pagos nunca geraram `subscription_grant` porque
  não havia conta para creditar;
- no mesmo minuto ele fez o onboarding: -525 (avatar) e -10.000 (voz), com a
  nota "[onboarding: pode ficar negativo]" — saldo foi a -10.525;
- hoje, 30/08 12:53, um `adjustment` de +10.525
  (`ref_type = perdao_negativo_onboarding`, "decisão do Johnny, 30/08/2026")
  trouxe de volta para 0.

Ou seja: o 0 é falta de crédito nunca concedido, não crédito retirado. O saldo
negativo já foi tratado pelo próprio Johnny hoje. Fica o registro de que um
assinante com 3 mensalidades pagas nunca recebeu recarga de ciclo — vale
decidir se ele deve receber o ciclo pago ou se a conta é de teste (plano de
R$20, cancelamento `CANCELLED_BY_SELLER`).

## O que está certo
- `gabriel.pereira@p-excellence.com.br` aderiu e cancelou no **mesmo dia
  (29/08)**, rec#1 R$0 APPROVED, e **não tem conta na plataforma** — a consulta
  em `profiles` respondeu com 2 das 3 pessoas, então o vazio dele é real e não
  consulta quebrada. Nunca houve crédito, nada a expirar, nada a corrigir.
- Nenhum estorno/chargeback na janela.

## Armadilha 1 (a que custou 1.356.554 cr em 18/08)
Nenhuma cobrança OVERDUE nesta janela. As duas trials só têm rec#1 de R$0
(CANCELLED/APPROVED) e o assinante só tem R$20 COMPLETE. O critério continua
sendo valor > 0 **E** status COMPLETE/APPROVED.

## Observação (não é violação de regra)
`francielly.mazete@gmail.com` tem **4 assinaturas de trial** na Hotmart
(1AXO9XAV, QVFGILKO, PXWH0XMK INACTIVE + YRPB1HZU CANCELLED_BY_SELLER), todas
mortas. Só uma gerou `subscription_grant` (+100.000 em 26/08), então não houve
recarga múltipla. Padrão de reentrada em trial que vale vigiar.

## Saídas cruas
- `2026-08-30_cancelamentos_2908.txt`  — saída legível
- `2026-08-30_cancelamentos_2908.json` — saída estruturada (Hotmart + banco)
- `2026-08-30_backlog_trial.txt`       — as 64 pessoas represadas
