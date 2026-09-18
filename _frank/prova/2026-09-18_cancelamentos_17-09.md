# Cancelamentos de 17/09/2026 — ronda de 18/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-17`
Janela UTC `2026-09-17T00:00:00Z → 2026-09-18T00:00:00Z`.
10 eventos `SUBSCRIPTION_CANCELLATION` → 10 pessoas. Ronda somente-leitura,
nenhum saldo tocado (regra 9-A).
JSON cru: `_frank/prova/2026-09-18_cancelamentos_17-09.json`.

## 🔴 O que vem PRIMEIRO — um chargeback ficou com o crédito

`core@frentestudio.com.br` (Bruno Lourenço) pagou R$97, pediu **reembolso** às
14:18Z e **42 minutos depois abriu chargeback** (15:00Z). O dinheiro voltou pra
ele. Pela regra 9 o `credits_subscription` devia zerar. **Não zerou: ele segue
com 169.067 créditos.**

Não é dedução a partir de saldo — os dois webhooks chegaram e **morreram**:

| evento | chegou | `processed_at` | `error` |
|---|---|---|---|
| PURCHASE_REFUNDED | 17/09 14:18:31,2Z | **NULL** | `zero_subscription_credits_on_refund: Could not find the function…` |
| PURCHASE_CHARGEBACK | 17/09 15:00:40,5Z | **NULL** | idem |

**Causa, medida no catálogo e não no log:**

```sql
select p.proname, pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname ilike '%zero_subscription%' or p.proname ilike '%refund%';
-- 0 linhas (medido 18/09)
```

A função **não existe no banco**. O código que a chama
(`frontend/src/lib/credits/refund.ts:33`) **está na `main` desde 14/09**, mas a
migration `scripts/111_estorno_zera_credito.sql` **nunca foi aplicada** — o
próprio cabeçalho dela diz, desde 15/09: *"⚠️ ESPELHO — NÃO APLICADO. DDL
aguardando aprovação do Johnny (regra 21)"*.

**Isto já é o incidente `66c5c55a` (`#446`), aberto pelo Vigia em 17/09 10:17Z,
status `investigating`.** Não estou abrindo chamado novo nem reinvestigando
(regra 14-A: um dono só). O que esta ronda acrescenta é que o defeito **agora
tem vítima do lado do dinheiro que sai**, e ela caiu dentro da janela de ontem.

**Alcance completo do defeito** — 4 eventos presos, 2 pessoas, nenhum outro:

| evento | quem | chegou | saldo hoje |
|---|---|---|---|
| PURCHASE_PROTEST | paula@handelhomes.com | 16/09 08:38Z | 171.029 cr |
| PURCHASE_REFUNDED | paula@handelhomes.com | 16/09 09:03Z | (mesma pessoa) |
| PURCHASE_REFUNDED | core@frentestudio.com.br | 17/09 14:18Z | 169.067 cr |
| PURCHASE_CHARGEBACK | core@frentestudio.com.br | 17/09 15:00Z | (mesma pessoa) |

**A decisão continua sendo do Johnny** (regra 9-A: retirar crédito é sempre
dele, em qualquer valor; regra 21: migration precisa do aval). Não apliquei DDL
e não zerei nada. O que mudou desde a última escalada é só o preço de esperar.

## Resumo de 17/09

**10 pessoas: 4 trial, 6 que pagaram** — dessas 6, cinco cancelaram normalmente
(mantêm o crédito, regra 9) e uma virou o chargeback acima.
**Nenhum pagante teve crédito zerado indevidamente** (`banco.zeramentos` está
`[]` nas 10).

| pessoa | tipo | ficou | crédito hoje | situação |
|---|---|---|---|---|
| core@frentestudio.com.br | **ESTORNO** | 31 d (17/08→17/09) | **169.067** | 🔴 **devia ter zerado e não zerou** |
| kettycruz@hotmail.com | ASSINANTE | 55 d (23/07→17/09) | 26.103 (+15.909 extra) | correto — manteve, acesso até 23/09 |
| artesolda19@gmail.com | ASSINANTE | 43 d (04/08→17/09) | 132.464 | correto — acesso até 04/10 |
| judelamuta@icloud.com | ASSINANTE | 46 d (02/08→17/09) | 200.000 | correto — acesso até 02/10 |
| executivosdesign@gmail.com | ASSINANTE | 10 d (07/09→17/09) | 172.610 | correto — acesso até 07/10 |
| godutra@gmail.com | ASSINANTE | 9 d (08/09→17/09) | 193.705 | correto — acesso até 08/10 |
| sergiolucas16@gmail.com | TRIAL | 9 d (08/09→17/09) | 87.185 | dia 10 é **hoje, 18/09** — não vai expirar sozinho |
| olhaum@gmail.com | TRIAL | 2 d (14/09→17/09) | 76.616 | dia 10 = 24/09, não vai expirar sozinho |
| patriciapiocoachoficial@gmail.com | TRIAL | 2 d (15/09→17/09) | 87.400 | dia 10 = 25/09, não vai expirar sozinho |
| linyamd@gmail.com | TRIAL | 0 d (17/09→17/09) | 83.830 | dia 10 = 27/09, não vai expirar sozinho |

Crédito de trial em jogo nesta rodada: **335.031 cr**
(76.616 + 83.830 + 87.185 + 87.400).

## A varredura de trial continua DESLIGADA

Lida no corpo vivo da função (`pg_get_functiondef`), não no repo:

```
varredura expire_trial_credits: DESATIVADA — "DESATIVADA POR FRANK EM 18/08 18:5x:
a primeira rodada real zerou 14 pessoas"
```

Nenhum dos 4 trials expira sozinho. O `sergiolucas16@gmail.com` chega ao dia 10
**hoje** e não vai acontecer nada. Decisão consciente de 18/08 — desligado
continua melhor que zerar pagante. O que muda a cada ronda é só o passivo.

## Classificação: o atalho do valor erraria 1 das 10

A ordem diária diz, em atalho, "cobrança com `price.value > 0` = pagou". Pelo
atalho, `sergiolucas16@gmail.com` viraria ASSINANTE e manteria 87.185 cr sem
nunca ter pago:

```
sergiolucas16@gmail.com   R$0/COMPLETE | R$97/OVERDUE | R$97/PRINTED_BILLET   <- TRIAL
```

Boleto **impresso** e mensalidade **vencida** não são dinheiro que entrou. Vale
o critério FORTE de 18/08 (`pagou_de_verdade.cjs`): **valor > 0 E status
COMPLETE/APPROVED**. A ferramenta usa o critério forte.

## Armadilha 2 conferida

As 10 pessoas foram lidas por e-mail, com todas as assinaturas de cada uma.
`outrasAssinaturasVivas` está **presente e vazio** nas 10 — ninguém foi tratado
como saída tendo outra assinatura viva hoje.

## Contraprovas (zero de instrumento cego não vale)

1. **`banco.zeramentos`**: presente-e-vazio nas 10, lido dentro de `banco` (não
   na raiz — esse foi o erro cometido e corrigido na ronda de 17/09).
2. **A leitura de cobranças enxerga**: 5 status distintos na rodada
   (`COMPLETE, APPROVED, OVERDUE, PRINTED_BILLET, CHARGEBACK`). Instrumento que
   enxerga CHARGEBACK é o que dá valor ao resto.
3. **O livro-razão enxerga zeramento**: `credit_transactions` com `amount < 0`
   nos últimos 60 dias devolve `trial_cancelado` (119), `trial_expirado` (14) e
   `estorno` (3) — **todos de 18/08**, nenhum depois. Ou seja, o "zero
   zeramentos" das 10 pessoas é zero de verdade, e de quebra confirma que a
   regra do estorno **nunca agiu sozinha em produção**: os 3 lançamentos de
   `estorno` que existem são os manuais de 18/08.
4. **O `grep` que voltou vazio foi testado**: procurar
   `zero_subscription_credits_on_refund` no meu checkout local não achou nada,
   mas `expire_trial_credits` (que eu sei que existe) achou 5 linhas — o
   instrumento funciona. O vazio era **checkout desatualizado**: o código está
   na `origin/main`, não na minha branch. Puxei antes de concluir.

## O que NÃO foi feito, de propósito

Nenhum saldo foi tocado, nenhuma DDL aplicada. A ronda é somente-leitura
(regra 9-A). Zerar o crédito do chargeback e aplicar a migration 111 são as
duas coisas que resolvem o achado de cima, e **as duas são decisão do Johnny**.

## Aviso ao grupo — ENVIADO (18/09)

`notify-grupo.sh` devolveu `enviado ao grupo`. Conteúdo: as 10 saídas, o
chargeback que ficou com 169.067 cr e a causa (migration 111 não aplicada,
`#446` já aberto), os 4 trials com 335.031 cr parados pela varredura desligada,
e a confirmação de que nenhum pagante foi zerado.
