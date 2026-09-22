# Cancelamentos de 21/09/2026 — auditoria da regra 9

Rodado em 22/09/2026 por Frank. **Somente leitura: nenhum saldo foi alterado.**
Comando: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-21`
Saída crua completa: `_frank/prova/2026-09-22_cancelamentos_21-09.json`
Complemento (backlog): `node _frank/ferramentas/backlog_trial.cjs`

Janela UTC `2026-09-21T00:00:00Z → 2026-09-22T00:00:00Z`.
**12 eventos `SUBSCRIPTION_CANCELLATION` → 12 pessoas distintas.**

Classificação pela Hotmart (`GET /subscriptions/{code}/purchases`, array puro):
**6 trial, 5 assinantes, 1 estorno.** Maior dia desde 14/09 (15 pessoas).

---

## 1. Fora da regra — o que precisa de ação

### 1.1 🔴 Contestação com 149.006 cr intactos, e o crédito foi QUEIMADO antes

| e-mail | adesão | cancelou | cobranças | saldo hoje | acesso até |
|---|---|---|---|---|---|
| `mkt.drrigatti@gmail.com` (CLINICA MEDICA DR RIGATTI LTDA) | 14/09 | 21/09 | rec#1 R$0 `COMPLETE`, rec#2 **R$97 `PROTESTED`** | `credits_subscription` = **149.006** | **14/10/2026** |

Pela regra 9, contestação/estorno **zera**. Não zerou. Mas o que pesa aqui não é
o saldo parado — é a ordem dos acontecimentos, medida no livro-razão:

```
21/09 13:59:21Z   Hotmart aprova a rec#2 de R$97   (transacao HP2319839714)
21/09 14:01:05Z   +100.000 cr   subscription_grant / payment_event  "recarga do ciclo"
21/09 14:58:58Z    -10.000 cr   training  — clonagem/treino de voz
21/09 17:04–17:38  -3.918 cr    2 geracoes de audio
21/09 17:42–17:54  -37.951 cr   22 cenas de b-roll + preparo de audio (Video Estudio)
21/09 17:18:10Z   assinatura encerrada  (CANCELLED_BY_ADMIN)
21/09 17:18:11Z   SUBSCRIPTION_CANCELLATION
21/09 17:18:18Z   PURCHASE_PROTEST  —  status DISPUTE, R$97
```

Pagou R$97, recebeu 100.000 cr, **consumiu ~51.869 cr de GPU em menos de 4
horas** (treino de voz + 22 cenas de vídeo), e contestou a cobrança no mesmo dia.
O consumo continuou até **17:54, depois** do cancelamento das 17:18. A casa
entregou o processamento, não vai receber os R$97, e a pessoa segue com
**149.006 cr gastáveis e acesso até 14/10**.

**Não é bug novo — é o #446, e ele não falhou nenhuma vez em 8 dias.** O evento
morreu com a assinatura exata do incidente:

```
processed_at: NULL
error: "zero_subscription_credits_on_refund: Could not find the function
        public.zero_subscription_credits_on_refund(...) in the schema cache"
```

`refund.ts:33` chama a função; `scripts/111_estorno_zera_credito.sql` nunca foi
aplicado. **Não zerei — a ordem é reportar. Aplicar a migration e retirar
crédito de aluno é decisão do Johnny (regra 9-A/21).**

### 1.2 O #446 está subcontado: o cartão diz 2 vítimas, são 6

Medido em `payment_events` desde o merge de 14/09 que subiu o chamador:

| recebido | evento | processed_at |
|---|---|---|
| 16/09 08:38 | `PURCHASE_PROTEST` | NULL |
| 16/09 09:03 | `PURCHASE_REFUNDED` | NULL |
| 17/09 14:18 | `PURCHASE_REFUNDED` | NULL |
| 17/09 15:00 | `PURCHASE_CHARGEBACK` | NULL |
| 18/09 19:23 | `PURCHASE_REFUNDED` | NULL |
| **21/09 17:18** | **`PURCHASE_PROTEST`** | **NULL** ← drrigatti, novo |

**6 de 6 (100%), todos com o mesmo erro, 8 dias seguidos.** O incidente #446
(`66c5c55a`, `investigating`) ainda registra `occurrences: 2` e
`affected_emails: ["paula@handelhomes.com"]` — está 4 vítimas atrás do real.

Não reabri nem reinvestiguei o incidente (regra 14-A): ele tem dono e está em
andamento. **Também não escrevi no cartão** — só estou reportando que a
contagem dele envelheceu, para quem é dono decidir.

### 1.3 Os 6 trials de ontem não vão expirar sozinhos

Todos os 6 estão **dentro do prazo** — pela data, nada está errado hoje. O
problema é o de sempre: a máquina que cumpre o prazo está parada.

| e-mail | adesão | dia 10 | saldo |
|---|---|---|---|
| `erickanereidepc@gmail.com` | 12/09 | **22/09 (é hoje)** | 73.872 |
| `jamilsonadriano@gmail.com` | 13/09 | 23/09 | 87.771 |
| `marketinglsousa@gmail.com` | 16/09 | 26/09 | 72.972 |
| `impulsonomktdigital@gmail.com` | 18/09 | 28/09 | 27.345 |
| `lilikumon.liliane@gmail.com` | 21/09 | 01/10 | 50.440 |
| `manasses.queiroz@gmail.com` | 21/09 | 01/10 | 85.510 |
| **total** | | | **397.910** |

`erickanereidepc` vence **hoje** e não vai acontecer nada. `lilikumon` e
`marketinglsousa` têm ainda 10.000 cr cada em `credits_extra` — **não é tocado
por nenhuma das três regras**, está certo assim.

### 1.4 Causa raiz — `expire_trial_credits` continua DESATIVADA

Estado lido do corpo vivo da função (`pg_get_functiondef`; a RPC **não** foi
chamada de propósito — chamar executaria a varredura):

```
estado: desativada
motivo: "DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas"
```

**Estado deliberado, não avaria** — foi desligada porque zerou 14 pagantes
(1.356.554 cr, inclusive a conta do Lucas). Continua correto que esteja
desligada enquanto não houver detector-propõe/humano-executa. O que se acumula
enquanto isso, medido hoje:

| | pessoas | créditos |
|---|---|---|
| já passaram do dia 10, crédito ainda lá | 140 | 10.631.442 |
| ainda no prazo, sem máquina pra cumprir | 24 | 1.596.878 |
| **total parado** | **164** | **12.228.320** |

Ontem era 158 pessoas / 11.818.181 cr. **+6 pessoas e +410.139 cr em um dia.**

---

## 2. Dentro da regra — os 5 assinantes

Todos pagaram de verdade e **todos mantiveram o crédito**. Nenhum lançamento de
zeramento por rotina (`zeramentos: []` nos cinco) e nenhum marcador em
`trial_credit_expirations` (`marca: null` nos cinco).

| e-mail | ficou | cobranças que entraram | crédito mantido | acesso até |
|---|---|---|---|---|
| `dcnrepresentacoes@gmail.com` | 32 dias | rec#2 R$97 `COMPLETE`, rec#3 R$97 `APPROVED` | 268.291 | 20/10 |
| `luciocaversan@gmail.com` | 42 dias | rec#2 R$97 `COMPLETE`, rec#3 R$97 `COMPLETE` | 246.856 | 10/10 |
| `carolina.topic@hotmail.com` | 8 dias | rec#2 R$97 `APPROVED` | 190.000 | 14/10 |
| `rearielo@hotmail.com` | 11 dias | rec#2 R$97 `APPROVED` | 173.014 | 10/10 |
| `atendimento@dropweb.com.br` | 19 dias | rec#1 R$97 `COMPLETE` | 100.000 | 02/10 |

**Nenhum pagante foi zerado** — 978.161 cr mantidos corretamente.

---

## 3. As três armadilhas, conferidas (não presumidas)

**Armadilha 1 — OVERDUE/PRINTED_BILLET não é pagamento.** Pegou de verdade hoje
em dois casos que, filtrando só por `price.value > 0`, teriam virado "assinante":

- `jamilsonadriano`: rec#2 R$97 **`OVERDUE`** → é **TRIAL**.
- `erickanereidepc`: rec#2 R$97 `OVERDUE` **e** R$97 `PRINTED_BILLET` → é **TRIAL**.

E o contrário também foi respeitado: `luciocaversan` tem uma rec#2 `OVERDUE`,
mas tem rec#2 e rec#3 `COMPLETE` — é **ASSINANTE**, e manteve o crédito.

**Armadilha 2 — classificar por PESSOA, não por assinatura.** As 12 foram lidas
por e-mail na Hotmart, com todas as assinaturas de cada uma.
`outrasAssinaturasVivas: []` nas 12 — ninguém aqui tem outro contrato de pé.
O caso que exigia o cuidado: `lilikumon.liliane` tem **duas** assinaturas
(`ZO7XLA22` `INACTIVE` + `MUNYDA11` `CANCELLED_BY_SELLER`) — as duas mortas,
então é saída de verdade.

**Armadilha 3 — zero não é prova.** A consulta voltou com 12 linhas, não vazia.
`data.subscriber.email` veio preenchido nos 12 eventos (nenhum caiu no ramo que
imprime payload cru). As chamadas à Hotmart responderam nas 12 pessoas; falha de
parse viraria `erro` no JSON, e não há nenhum.

---

## 4. Erro meu que quase virou relatório errado (duas vezes)

**(a) Quase reportei "o webhook não zerou" sem checar se a disputa ainda existia.**
Ao varrer os eventos da pessoa achei um `PURCHASE_COMPLETE` de **hoje, 22/09
12:36Z** — depois do protesto. Se fosse a mesma transação, a disputa teria sido
revertida, drrigatti seria assinante comum e "crédito não zerado" estaria
**certo**, não errado. Fui conferir transação por transação:

```
PURCHASE_PROTEST   21/09 17:18Z  -> HP2319839714  R$97   (rec#2)
PURCHASE_COMPLETE  22/09 12:36Z  -> HP3665486695  R$0    (rec#1, a perna do trial)
```

São transações **diferentes**. O `COMPLETE` de hoje é a perna gratuita do trial
fechando, não a contestação sendo revertida. A disputa de R$97 continua de pé —
confirmado também na consulta viva à Hotmart às 13:02Z, depois do evento das
12:36Z. O achado sobreviveu à tentativa de derrubá-lo.

**(b) Quase usei um "0 eventos" que era teto de consulta.** Minha primeira
varredura dos eventos da pessoa leu `payment_events` sem filtro e bateu no teto
de **1.000 linhas** do Supabase, devolvendo `0 eventos do drrigatti`. Não era
verdade: com filtro no servidor são **5 eventos**. É a mesma armadilha que
truncou a contagem da ronda de 21/09. Zero de consulta truncada não é zero.

**(c) Checkout desatualizado, de novo.** Rodei a ronda de um worktree limpo em
`origin/main`, não do meu checkout — que estava **798 commits atrás** e não tinha
`saida_por_pessoa.cjs`, `estorno_orfao.cjs` nem `protesto_invisivel.cjs`. É a
lição de 19/09 aplicada antes de errar, não depois.

---

## Método / provas

- Evento lido de `payment_events`, `event_type = 'SUBSCRIPTION_CANCELLATION'`,
  `received_at` na janela do dia 21/09 UTC. Código do assinante de
  `data.subscriber.code` (**não** `data.subscription.subscriber.code`, que não
  existe neste evento).
- Classificação feita **na Hotmart**, não no nosso banco.
  Pagou = `price.value > 0` **E** status `COMPLETE`/`APPROVED`.
- Agrupamento por **pessoa (e-mail)**; todas as assinaturas de cada e-mail lidas.
- Contraprova do estorno: `PURCHASE_PROTEST` na janela = 1 (o do drrigatti),
  contra 18 no histórico; `PURCHASE_REFUNDED` 0 na janela contra 14 no
  histórico; `PURCHASE_CHARGEBACK` 0 contra 3. O instrumento enxerga.
- Conferências avulsas commitadas em `_frank/rascunhos/2026-09-22_verif_*.cjs`
  (todas somente leitura).
- **Nenhum saldo foi alterado por esta rodada.** Os scripts são somente leitura
  por construção e a função de expiração foi lida, não executada.
