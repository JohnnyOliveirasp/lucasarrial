# Cancelamentos de 07/09 — conferência (rodada 08/09)

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-07`
Somente leitura. **Nenhum saldo foi tocado** (regra 9-A: quem age é a varredura,
sobre lista aprovada — nunca o relatório).

Janela UTC `2026-09-07T00:00:00Z -> 2026-09-08T00:00:00Z`.
11 eventos `SUBSCRIPTION_CANCELLATION` -> 11 pessoas. **4 trial, 7 assinantes.**

Rascunhos desta rodada (todos somente leitura):
`_frank/rascunhos/checa_semconta_0907.cjs`, `orfao_rodrigo_0907.cjs`,
`orfao_ukc_0907.cjs`, `orphan_alerts_estado.cjs`, `porque_sem_aviso_ukc.cjs`,
`rodrigo_conta_sumiu.cjs`, `origem_credito_trials_0907.cjs`,
`vinicius_outra_conta_0907.cjs`.

---

## 1. O que vem primeiro: um pagante de R$97 sem conta, e ninguém foi avisado

### rodrigo.limas.1978@gmail.com — JORGE RODRIGO LIMA MIRANDA

Assinatura `UKC2COC2`, oferta `ewxrfw9j`, produto 7851642 (FastCloner).

| quando | evento | valor | status | processado | error |
|---|---|---|---|---|---|
| 30/08 15:47 | PURCHASE_APPROVED rec#1 | R$0 | APPROVED | 15:47:53 | null |
| **06/09 14:13** | **PURCHASE_APPROVED rec#2** | **R$97** | **APPROVED** | 14:13:05 | null |
| 07/09 09:32 | PURCHASE_COMPLETE rec#1 | R$0 | COMPLETED | 09:32:34 | null |
| 07/09 | SUBSCRIPTION_CANCELLATION | — | — | — | — |

**Ele pagou R$97 no dia 06/09 e cancelou no dia 07/09.** Nunca teve conta:

- `profiles` por e-mail exato: 0 (contraprova: a tabela responde, 2.359 contas).
- Busca por NOME e por pedaços do e-mail — `rodrigo.limas`, `limas`, `rodrigo`
  (36 contas), `miranda` (9), `jorge` (5): **nenhuma é ele**. Armadilha do #222
  aplicada, e desta vez de verdade — ver §5.
- `auth.users`: varridos os 2.359 usuários, **não está lá**.
- `credit_transactions` com `ref_id` da transação `HP2955203673`: **0**
  (contraprova: a tabela tem 23.625 linhas). O R$97 não virou crédito nenhum
  pra ninguém, porque não havia conta pra creditar.
- `entitlements`: `UKC2COC2 status=canceled user_id=NULO acesso_ate=2026-09-30`.

⚠️ **E o aviso de compra órfã (#239) NÃO disparou pra ele.**

- `agent_state` não tem a chave `para_frank_orfa_UKC2COC2` (as 11 que existem
  estão listadas no rascunho `orfao_ukc_0907.cjs`).
- O mapa de idempotência `orphan_alerts` tem 13 entradas e **UKC2COC2 não está
  em nenhuma** — ou seja, não foi "já avisado", foi **nunca avisado**.
- Não é máquina desligada: o mesmo webhook avisou `1206SZ6B` às **12:10** e
  `LCL5JZ82` às **15:00** do MESMO dia 06/09. O dele, às 14:13, passou no meio
  e não gerou nada.
- Não é produto de fora: `product.id = 7851642` = `HOTMART_PRODUCT_ID`, igual
  ao do `1206SZ6B` que avisou.
- Não é guard de status: `purchase.status = APPROVED`, que está em
  `PAID_STATUSES`.
- Não é código velho: o fix do #239 é o commit `93d8f87` de **02/09 21:04**.

**Não sei por que não avisou.** As três portas de saída do `deveAvisar`
(evento, produto, e-mail) estão todas abertas pra esse evento, e a quarta
condição do webhook (`if (!userId)`) tinha que ser verdadeira, porque a conta
comprovadamente nunca existiu — nem em `profiles`, nem no `auth`. Não vou
inventar causa: fica como **chamado pro `coder`**, com os dados acima.

O que isso custou: um aluno pagou R$97, ficou sem acesso nenhum, ninguém foi
avisado, e ele cancelou no dia seguinte. **Não mexi em nada** — devolver
dinheiro de Hotmart não é crédito e não está na 9-B; é decisão do Johnny.

---

## 2. A máquina do prazo continua parada (não é novidade de 07/09)

`expire_trial_credits`: **DESATIVADA** desde 18/08 (corpo lido por
`pg_get_functiondef`, não por chamada à RPC — chamar executaria a varredura).
Motivo gravado no corpo: *"a primeira rodada real zerou 14 pessoas"*.

Isso atinge 3 dos 4 trials de ontem:

| pessoa | dia 10 do trial | crédito parado |
|---|---|---|
| hytallon.957327001@gmail.com | 28/08 — **já passou** | 80.050 |
| leandromedsouza@hotmail.com | 27/08 — **já passou** | 90.475 |
| aroldogg@gmail.com | 12/09 — ainda vai chegar | 75.136 |

Conferi a **origem** do crédito dos três (armadilha da Eliane, 06/09: trial na
Hotmart pode ter pago por fora via Stripe). Rodei
`origem_credito_trials_0907.cjs`: nos três, só lançamento de
`subscription_grant`/`payment_event` — **nenhum `extra_purchase`, nenhum
`stripe_session`**. São trials puros mesmo, ninguém pagou nada.

Continua sendo **processo**, não chamado: o desligamento foi deliberado e está
de acordo com a 9-A. O que falta é a lista aprovada + passo de execução
separado, não religar no automático.

---

## 3. Armadilha 2 aplicada: o Vinicius não é gente que saiu

### viniciusjc1903@gmail.com — VINICIUS JULIO CAMARGO

TRIAL. Adesão 06/09 -> cancelou 07/09 = 2 dias. `BFF94E2S`
`CANCELLED_BY_CUSTOMER`, `rec#1 R$0 APPROVED`. Sem conta com ESSE e-mail — e o
aviso de órfã **disparou certinho** pra ele (06/09 00:35, canal telegram).

A busca por nome (§5) achou:

```
plastiassist@gmail.com | Vinicius Camargo | criada 2026-09-06T00:34:03
  plano=pro  acesso_ate=2026-09-14  origem=hotmart  saldo: 90.000 cr
  entitlement J7VDYDD8  status=ACTIVE  user_id preenchido  criado 07/09 18:56
  crédito: 07/09 18:56  +100.000 subscription_grant/payment_event
           08/09 00:13   -10.000 training (clonagem de voz)
```

A conta foi criada **00:34:03 de 06/09** — um minuto e meio ANTES do
`PURCHASE_APPROVED` de `viniciusjc1903@` (00:35:40). É o padrão do e-mail
divergente (caso Juliano 13/07, caso Tiago #239): criou a conta com um e-mail,
comprou com outro, ficou órfão. Em 07/09 ele cancelou a órfã e refez a compra
com `plastiassist@`, que linkou sozinha.

⚠️ **Não vinculei nada e não é prova formal** — a regra do #239 é não adivinhar
por nome. Mas pro efeito DESTE relatório o que importa está provado por fato,
não por nome: existe assinatura `ACTIVE` paga do mesmo dia, com acesso até
14/09 e **treino de voz rodando em 08/09 00:13**. Seja quem for, ninguém ficou
sem nada. Ele não entra na conta de "gente que saiu" e não há crédito em risco.

Nota: `BFF94E2S` está `canceled` e `J7VDYDD8` está `active`, então **não há
cobrança em dobro**. Nada a fazer.

---

## 4. As 11 pessoas

### Trials (4)

| e-mail | adesão -> cancelou | tempo | crédito | situação |
|---|---|---|---|---|
| hytallon.957327001@gmail.com | 18/08 -> 07/09 | 19 d | 80.050 | passou do dia 10 (28/08), varredura parada |
| leandromedsouza@hotmail.com | 17/08 -> 07/09 | 21 d | 90.475 | passou do dia 10 (27/08), varredura parada |
| aroldogg@gmail.com | 02/09 -> 07/09 | 5 d | 75.136 | no prazo (dia 10 = 12/09), mas ninguém vai cumprir |
| viniciusjc1903@gmail.com | 06/09 -> 07/09 | 2 d | sem conta | §3 — está ativo por outro e-mail |

O `leandromedsouza` tem `rec#2 R$97 **OVERDUE**`: a Hotmart emite a mensalidade
de quem nunca pagou. **Armadilha 1** — filtrar só por `price.value > 0` faria
dele um "pagante". Não pagou.

### Assinantes (7) — todos MANTIVERAM o crédito, como manda a regra 9

| e-mail | adesão -> cancelou | tempo | pagou | crédito hoje |
|---|---|---|---|---|
| jkdeliberatus93@gmail.com | 27/07 -> 07/09 | 42 d | 2x R$97 COMPLETE | 192.460 ✅ |
| admatallo@gmail.com | 07/08 -> 07/09 | 31 d | R$97 COMPLETE | 160.874 ✅ |
| montenegro.pqd@gmail.com | 10/08 -> 07/09 | 28 d | R$97 COMPLETE | 166.844 ✅ |
| edla.brigida@gmail.com | 18/08 -> 07/09 | 20 d | R$97 COMPLETE | 185.233 ✅ |
| agnesnakano@gmail.com | 19/08 -> 07/09 | 19 d | R$97 COMPLETE | 180.928 ✅ |
| cleber_carvalho_1@hotmail.com | 22/08 -> 07/09 | 16 d | R$97 COMPLETE | 150.750 + 525 extra ✅ |
| rodrigo.limas.1978@gmail.com | 30/08 -> 07/09 | 8 d | **R$97 APPROVED** | **sem conta** — §1 |

**Nenhum pagante teve crédito zerado por rotina.** A ferramenta procura
lançamento com `ref_type`/`kind` de `trial_expirad|estorno|subscription_expired|
refund|chargeback` em cada um dos 7: **zero ocorrências**. Nenhum deles está
marcado como `zeroed` em `trial_credit_expirations`.

### Estornos

**Nenhum.** Nenhuma cobrança de ontem em `REFUNDED`, `CHARGEBACK`,
`PROTESTED` ou `CHARGEBACK_REVERTED` — logo, nada que o webhook devesse ter
zerado e não zerou.

---

## 5. Erro meu nesta rodada, e o conserto

A primeira versão do `checa_semconta_0907.cjs` buscou nome em
`profiles.full_name`. **Essa coluna não existe** (o nome é `display_name`). O
supabase-js devolveu erro, meu script ignorou o erro e imprimiu
`0 conta(s)` — e eu quase concluí "não tem conta com outro e-mail" a partir de
um zero que era **falha de consulta, não ausência de dado**. É exatamente a
armadilha 3 e a regra do "consulta que erra volta vazia", cometida por mim.

Só peguei porque o `origem_credito_trials_0907.cjs` usou a mesma coluna e
**esse** estourou o erro na tela.

Conserto aplicado na versão commitada: coluna certa, todo erro de consulta é
impresso e marca a rodada como não-confiável, e existe uma **contraprova 2** —
`display_name ILIKE %a%` tem que voltar gente. Voltou 30. Só depois disso os
zeros valem.

Com o instrumento consertado, o resultado mudou de verdade: apareceu o
`plastiassist@gmail.com` do §3, que a versão quebrada não tinha achado.

---

## 6. Achado lateral: 3 avisos de órfã que não chegaram em ninguém

No mapa `orphan_alerts`, três entradas estão com `canais: []` — aviso gerado
que **nenhum canal aceitou**:

| entitlement | quando | e-mail |
|---|---|---|
| GGMWWE5Q | 03/09 09:09 | scandovieri41@hotmail.com |
| 5O6U1GCW | 03/09 15:31 | rodrigoaugusto@hotmail.com |
| IVU666FZ | 06/09 11:58 | gabriel.pereira@p-excellence.com.br |

`5O6U1GCW` e `IVU666FZ` têm o registro durável `para_frank_orfa_*`, então
entram na ronda e não se perderam. **`GGMWWE5Q` não tem** — esse aviso não
existe em lugar nenhum além dessa linha de dedupe, e a idempotência vai impedir
que ele seja emitido de novo.

Fora do escopo do relatório de cancelamento (nenhum dos três cancelou ontem) e
não apurei se essas pessoas seguem sem acesso. Fica anotado aqui junto com o §1,
que é da mesma máquina.

---

## 7. O que NÃO foi feito, de propósito

- Não zerei crédito de ninguém (9-A).
- Não chamei a RPC `expire_trial_credits` (chamar = executar sobre gente real).
- Não vinculei a compra órfã do Vinicius a conta nenhuma (#239: vínculo é
  humano, nunca por semelhança de nome).
- Não devolvi o R$97 do Rodrigo nem toquei na assinatura dele: é dinheiro de
  Hotmart, não crédito, e não está na alçada da 9-B.
