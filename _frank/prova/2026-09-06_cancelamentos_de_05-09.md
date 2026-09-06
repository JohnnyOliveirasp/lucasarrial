# Cancelamentos de 05/09 — apuração de 06/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-05`
Janela UTC `2026-09-05T00:00:00Z -> 2026-09-06T00:00:00Z`.
**10 eventos `SUBSCRIPTION_CANCELLATION` -> 10 pessoas** (nenhum e-mail repetido).
Classificação feita na **Hotmart viva** (`GET /subscriptions/{code}/purchases`),
não no nosso banco. Somente leitura: **nada de saldo foi tocado por esta apuração.**

## Placar

| tipo | pessoas | credits_subscription em jogo |
|---|---|---|
| TRIAL que saiu sem nunca pagar | 6 | 414.539 cr |
| ASSINANTE que pagou e cancelou | 4 | 460.941 cr mantidos nas 3 contas + 88.025 cr do Solon, que ficam na conta ativa dele (ver abaixo) |
| ESTORNO / chargeback | 0 | — |

Nenhum pagante teve crédito zerado por rotina (`zeramentos: []` nos 4).
Nenhum estorno com saldo residual. **A regra 9 foi cumprida em todos os 10.**

## Os 4 assinantes (mantêm o crédito — correto)

| e-mail | dias | cobranças pagas | sub | situação |
|---|---|---|---|---|
| katiasalvador32@gmail.com | 21 | rec#2 R$97 COMPLETE | 176.910 (+1.755 extra) | mantido, ok |
| contato@fotoatleta.com | 7 | rec#2 R$97 APPROVED **05/09** | 186.842 | pagou e cancelou no mesmo dia; mantido, ok |
| adrianacdiniz@yahoo.com.br | 44 | rec#2 e rec#3 R$97 COMPLETE | 97.189 | marcador `paid` (0 cr debitados), ok |
| solonandrade03@gmail.com | 30 | rec#2 R$97 COMPLETE | — | ver abaixo |

### solonandrade03 — alarme falso da ferramenta, caso já resolvido

A ferramenta alertou *"cancelou na Hotmart mas NÃO existe conta na plataforma"*.
**Tecnicamente verdade, materialmente falso alarme.** Resolvi por PESSOA, não por
e-mail (armadilha 2), e o e-mail do Hotmart não é o e-mail da conta:

- Hotmart `POTX6UYJ` (solonandrade03@gmail.com) — trial 06/08 + R$97 COMPLETE 13/08.
  `CANCELLED_BY_SELLER` em 05/09. Entitlement com `user_id: null`.
- Hotmart `IJA1SHDQ` (lscontabilidade813@gmail.com) — **ACTIVE**, R$97 COMPLETE 13/08.
- Perfil `96005e7f-b314-4e70-a52d-393553abbaa3` "SOLON ANDRADE",
  e-mail **lscontabilidade813@gmail.com**, plan `pro`, **88.025 cr**,
  acesso até **13/09**, usando o produto (1 voz, 2 gerações, treino em 13/08).

Ele pagou R$97 **duas vezes no mesmo dia (13/08)**, uma por assinatura. O
cancelamento de ontem é a **perna duplicada sendo encerrada a pedido dele**:
incidente `bff5cb47` (*"Solon confirmou por e-mail que quer cancelar a assinatura
duplicada"*) está `fixed`, e o incidente-pai `f1ada07e` (COBRANÇA EM DOBRO) já
registra *"Perna SOLON resolvida 05/09"*. **Não está trancado, não perdeu crédito,
nada a fazer.**

> ⚠️ Para a próxima ronda: o alerta "sem conta na plataforma" da ferramenta
> compara só o e-mail do Hotmart contra `profiles.email`. Quando o aluno assina
> com um e-mail e cria a conta com outro, ele dispara sozinho. Antes de tratar
> como pagante trancado, procure por **`display_name`** e por `entitlements`
> com `user_id: null` — foi o que achou este caso.

## Os 6 trials (nenhum pagou de verdade)

Todos com rec#1 R$0 e **nenhuma** cobrança > 0 aprovada — `WAITING_PAYMENT` e
`CANCELLED` não são pagamento (armadilha 1).

| e-mail | adesão | dias | sub | dia 10 |
|---|---|---|---|---|
| brunex120@gmail.com | 05/09 | 0 | 100.000 | 15/09 |
| limadasilvasandra313@gmail.com | 02/09 | 3 | 98.950 | 12/09 |
| vivimartinellifoto@gmail.com | 01/09 | 4 | 89.600 | 11/09 |
| as.lucas47@gmail.com | 28/08 | 8 | 79.481 | 07/09 |
| luborrigueiro77@gmail.com | 03/09 | 2 | 42.879 | 13/09 |
| fmbmonteiro77@gmail.com | 03/09 | 2 | 3.629 (+1.800 extra) | 13/09 |

`credits_extra` de ninguém é tocado pela regra — os 1.800 do fmbmonteiro ficam.

### as.lucas47 — conferido contra a cobrança em dobro, sem dinheiro envolvido

Ele está na lista do incidente aberto `f1ada07e`. É a **mesma pessoa** de
`neto_rocha@hotmail.com` (Boanerges Marinho Rocha Neto), com duas assinaturas
abertas em 28/08:

- `A8GVLMGE` (as.lucas47) — `CANCELLED_BY_CUSTOMER`, rec#1 R$0, rec#2 R$97 **WAITING_PAYMENT**
- `AI2H1K8Y` (neto_rocha) — `CANCELLED_BY_SELLER`, rec#1 R$0, rec#2 R$97 **WAITING_PAYMENT**

**Nenhuma das duas chegou a cobrar.** Não houve cobrança em dobro de dinheiro
neste caso — só duas adesões de trial. Ele é trial dos dois lados e não tem
assinatura viva. Classificação TRIAL confirmada.

## O que não segue a regra: a máquina que cumpre o prazo está parada

Os 6 trials estão **dentro** do prazo (o mais próximo vence 07/09), então nenhum
deles está fora da regra *hoje*. O problema é que **quando o dia 10 chegar não vai
acontecer nada**: a RPC `expire_trial_credits` responde
`{ok:false, error:"DESATIVADA MANUALMENTE 18/08..."}` desde 18/08 18:25Z.

**Isto não é bug novo e não é surpresa: é decisão do Johnny.** O incidente
`A VARREDURA DO TRIAL NAO ESCREVE NADA DESDE 18/08` está `ignored`, fechado por
`johnny.oliveirasp@gmail.com` em 25/08, porque religar a função como está
repetiria o zeramento de 14 pagantes de 18/08 (a detecção de pagante não enxerga
Stripe/Pix/`extra_purchase`). **Não religuei nada e não zerei ninguém** — regra 9-A:
retirar crédito é sempre decisão do Johnny.

O que mudou é o **tamanho da pilha**. Medido hoje com
`node _frank/ferramentas/backlog_trial.cjs`:

| medição | pessoas | créditos parados |
|---|---|---|
| 25/08 (incidente original) | 54 | 4.830.605 |
| **06/09 (hoje)** | **98** | **7.484.835** |

Destes 98: **74 já passaram do dia 10** (5.645.799 cr, o mais antigo venceu em
10/07) e **24 ainda estão no prazo** (1.839.036 cr) — os 6 de ontem estão nestes 24.
Ritmo: **+44 pessoas e +2,65M cr em 12 dias**, ~220k cr/dia.

Não estou pedindo pra religar — a função continua com o defeito que a desligou.
O que este número diz é o **custo de deixar como está**, para quando o Johnny
decidir o caminho (reescrever a detecção de pagante e só então tratar o retroativo,
que é o plano já registrado no próprio incidente).

---
Apurado em 06/09 por Frank. Somente leitura: nenhum saldo alterado.
