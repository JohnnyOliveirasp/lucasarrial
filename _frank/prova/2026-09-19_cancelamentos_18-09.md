# Cancelamentos de 18/09/2026 — ronda de 19/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-18`
Janela UTC `2026-09-18T00:00:00Z → 2026-09-19T00:00:00Z`.
2 eventos `SUBSCRIPTION_CANCELLATION` → 2 pessoas. Ronda somente-leitura,
nenhum saldo tocado (regra 9-A).
JSON cru: `_frank/prova/2026-09-19_cancelamentos_18-09.json`.

## 🔴 PRIMEIRO — o bug do estorno fez vítima NOVA, dentro da janela de ontem

`vazilg@gmail.com` teve **R$97 devolvidos** em 18/09 19:23Z e **continua com
100.000 créditos de mensalidade**. Pela regra 9 (estorno zera) devia estar em 0.

Não é dedução a partir do saldo — o webhook chegou e **morreu**, igual aos
anteriores:

| evento | chegou | `processed_at` | `error` |
|---|---|---|---|
| PURCHASE_REFUNDED | 18/09 19:23:38,5Z | **NULL** | `zero_subscription_credits_on_refund: Could not find the function…` |

**Este é o `#446` (`66c5c55a`), aberto pelo Vigia em 17/09, status
`investigating`.** Não abri chamado novo (regra 14-A: um dono só) — anotei a
medição de hoje como nota no próprio incidente.

**O que mudou desde ontem: o alcance cresceu de 2 pessoas para 3.**

| evento | quem | chegou | saldo hoje |
|---|---|---|---|
| PURCHASE_PROTEST | paula@handelhomes.com | 16/09 08:38Z | 171.029 cr |
| PURCHASE_REFUNDED | paula@handelhomes.com | 16/09 09:03Z | (mesma pessoa) |
| PURCHASE_REFUNDED | core@frentestudio.com.br | 17/09 14:18Z | 169.067 cr |
| PURCHASE_CHARGEBACK | core@frentestudio.com.br | 17/09 15:00Z | (mesma pessoa) |
| **PURCHASE_REFUNDED** | **vazilg@gmail.com** | **18/09 19:23Z** | **100.000 cr ← novo** |

**Total preso: 5 eventos, 3 pessoas, 440.096 cr** que deviam ter zerado.
Os saldos de paula e core estão **idênticos aos de ontem** — nada se moveu.

**Causa, inalterada:** a migration `scripts/111_estorno_zera_credito.sql`
continua **não aplicada**, 5 dias depois do merge do código que a chama
(`frontend/src/lib/credits/refund.ts:33`). O cabeçalho do próprio arquivo em
`origin/main` segue dizendo *"🚨 ESTADO EM 15/09: **NAO APLICADA**"*.

⚠️ **Armadilha do checkout desatualizado, de novo.** Meu working tree estava
**644 commits atrás** da `origin/main` e não tinha o `scripts/111_*` — se eu
tivesse concluído dali, teria reportado "a migration nem existe". Conferi em
`git ls-tree origin/main`, não no meu checkout. É a mesma pegadinha registrada
na ronda de 18/09.

## Resumo de 18/09

**2 pessoas cancelaram: 1 trial, 1 assinante.** Nenhum pagante teve crédito
zerado indevidamente (`banco.zeramentos` vazio nas 2).

| pessoa | tipo | ficou | crédito hoje | situação |
|---|---|---|---|---|
| ljm.larajmotta@gmail.com | ASSINANTE | 31 d (18/08→18/09) | 293.950 | **correto** — manteve, acesso até 18/10 |
| tonimekautocenter@gmail.com | TRIAL | 1 d (17/09→18/09) | 72.790 (+1.320 extra) | dia 10 = 27/09, **não vai expirar sozinho** |

**Lara Jansiski Motta** pagou R$97 em 25/08 e **de novo em 18/09**, no mesmo dia
em que cancelou. Cancelar a renovação não apaga o ciclo já pago: ela mantém os
293.950 cr e o acesso até 18/10. É exatamente o que a regra 9 manda.

**Tonimek Auto Center** é o caso do vazamento, com número: entrou em 17/09 com
trial de R$0, **queimou 27.210 cr de GPU no mesmo dia** (voz 10.000, cenas
9.000, vídeo 3.960, imagens 2.100, resto 2.150), cancelou em 18/09 **sem nunca
ter pago um centavo** — e segue com 72.790 cr e acesso até **24/09**. A
assinatura saiu como `CANCELLED_BY_SELLER`, não pelo cliente.

## A varredura de trial continua DESLIGADA — e o passivo cresceu

Lida no corpo vivo da função (`pg_get_functiondef`), não no repo:

```
varredura expire_trial_credits: DESATIVADA — "DESATIVADA POR FRANK EM 18/08 18:5x:
a primeira rodada real zerou 14 pessoas"
```

Backlog medido hoje (`_frank/ferramentas/backlog_trial.cjs`):
**152 pessoas, 11.381.928 cr** parados esperando uma varredura que não roda.
O trial de ontem (Tonimek) é o #152 dessa fila.

Desligar foi decisão consciente de 18/08 e **continua melhor que zerar
pagante** — a rodada que a desligou zerou 14 clientes de verdade. O que muda a
cada ronda é só o tamanho do passivo.

## Contraprovas (zero de instrumento cego não vale)

1. **A consulta de estorno enxerga:** 34 eventos `REFUNDED/CHARGEBACK/PROTEST`
   no histórico, e só **5** estão com `processed_at NULL`. O zero dos outros 29
   é zero de verdade.
2. **`banco.zeramentos`**: presente-e-vazio nas 2 pessoas, lido dentro de
   `banco`. Os débitos das duas são consumo real de produto
   (`studio_scene`, `video_clone`, `voice`…), nenhum lançamento de rotina.
3. **A leitura de cobranças enxerga status distintos** na rodada
   (`APPROVED`, `COMPLETE`) e classificou Lara como ASSINANTE pelo critério
   FORTE (valor > 0 **E** status COMPLETE/APPROVED), não pelo atalho do valor.
4. **Armadilha 2 conferida:** as 2 pessoas foram lidas por e-mail, com todas as
   assinaturas de cada uma. `outrasAssinaturasVivas` está **presente e vazio**
   nas 2 — ninguém foi tratado como saída tendo outra assinatura viva.
5. **O checkout mentia** e foi corrigido antes de concluir (ver acima).

## O que NÃO foi feito, de propósito

Nenhum saldo tocado, nenhuma DDL aplicada. Aplicar a migration 111 e zerar o
crédito dos 3 estornos são as duas coisas que resolvem o achado de cima, e
**as duas são decisão do Johnny** (regra 9-A: retirar crédito é sempre dele;
regra 21: migration precisa do aval).
