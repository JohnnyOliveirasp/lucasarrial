# Cancelamentos de 09/09 — apuração de 10/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-09`
Janela UTC `2026-09-09T00:00:00Z -> 2026-09-10T00:00:00Z`.
**12 eventos `SUBSCRIPTION_CANCELLATION` -> 12 pessoas** (nenhum e-mail repetido).
Classificação feita na **Hotmart viva** (`GET /subscriptions/{code}/purchases`,
array puro), não no nosso banco. Somente leitura: **nada de saldo foi tocado.**

## Placar

| tipo | pessoas | credits_subscription em jogo |
|---|---|---|
| TRIAL que saiu sem nunca pagar | 6 | 409.302 cr |
| ASSINANTE que pagou e cancelou | 6 | 1.088.546 cr mantidos em 5 contas (+17.947 extra) — a 6ª não tem conta |
| ESTORNO / chargeback | 0 | — |

Nenhum pagante teve crédito zerado por rotina (`zeramentos: []` nos 6).
Nenhum estorno com saldo residual. **A regra 9 foi cumprida em todos os 12.**

Armadilha 2 (classificar por assinatura em vez de por pessoa) conferida: nenhum
dos 12 tem outra assinatura viva na Hotmart. Ninguém aqui é falso cancelamento.

---

## FORA DA REGRA — o que precisa de decisão

### 1. larissa@amplianegocios.com.br — pagou R$97 e nunca teve conta

Este **não** é o falso alarme de 05/09 (o caso Solon, em que o e-mail da Hotmart
era diferente do e-mail da conta). Segui o aviso deixado naquela ronda e procurei
por `display_name` e por `entitlements` órfãos antes de tratar como pagante
trancado:

- Hotmart `W41NDYD9` "Amplia Negocios", **Plano Founder**, `CANCELLED_BY_SELLER`.
  rec#1 R$0 COMPLETE 24/08 → **rec#2 R$97 COMPLETE 31/08** (confirmado
  `PURCHASE_COMPLETE` valor 97 status COMPLETED em 08/09). **Pagou de verdade.**
- `profiles` com esse e-mail: **não existe.**
- `profiles` por `display_name ilike '%amplia%'` e `'%larissa%'`: só duas Larissas
  não relacionadas (`larissa.kaori@mercadoparts.com.br`, `larissatsl@gmail.com`),
  ambas `plan=free`, 0 cr, `access_until` null. **Não é ela com outro e-mail.**
- `entitlements` `external_id=W41NDYD9`: existe, **`user_id: null`** — órfão.
  `status: canceled`, `access_until 2026-09-24`. O direito foi criado e nunca
  encontrou um usuário para pendurar.

**Ela pagou R$97, nunca criou conta, nunca acessou, e cancelou em 09/09.**
Não zerei nem mexi em nada. Dinheiro de volta é ação no gateway e fala em nome
da empresa — está fora do meu teto (§06). É decisão do Johnny.

> Contexto do tamanho: `entitlements` com `user_id: null` hoje: **88**.
> Cruzando todos os 3.586 eventos de compra (filtro FORTE: valor > 0 **e** status
> pago) contra `profiles`: **673 pagantes distintos, 50 sem conta com aquele
> e-mail.**
> **[INFERÊNCIA]** parte desses 50 provavelmente criou conta com OUTRO e-mail
> (foi exatamente o caso Solon). O número **não** é "50 pagantes trancados" —
> é o tamanho do balde onde casos como o da Larissa se escondem. Só o dela foi
> conferido pessoa a pessoa nesta ronda.

### 2. duoclinicsalto@gmail.com — trial vencido há 26 dias com 61.054 cr

- Adesão 04/08, cancelou 09/09 (**35 dias**). rec#1 R$0 COMPLETE;
  **rec#2 e rec#3 R$97 `OVERDUE`** — a Hotmart emitiu e nunca entrou dinheiro
  (armadilha 1: valor > 0 sozinho o faria virar "pagante"; não é).
- Dia 10 do trial venceu em **14/08**. Ainda tem **61.054 cr** e
  **acesso até 04/10**.

Não é falha nova da varredura: ele já está na pilha conhecida
(`backlog_trial.cjs`, linha 20 do bloco "JÁ VENCEU"). É o item 3 abaixo
aparecendo com nome e sobrenome.

### 3. A varredura `expire_trial_credits` segue desligada — 23º dia

Os outros 5 trials de ontem estão **dentro** do prazo (o mais próximo vence
13/09), então nenhum está fora da regra *hoje*. O problema é o de sempre: quando
o dia 10 chegar não vai acontecer nada.

**Isto não é bug novo e não é surpresa: é decisão do Johnny.** O incidente está
`ignored`, fechado por ele em 25/08, porque religar a função como está repetiria
o zeramento de 14 pagantes de 18/08. **Não religuei nada e não zerei ninguém** —
regra 9-A. Já está escalado no relatório noturno de hoje (item 3).

Pilha medida agora, `node _frank/ferramentas/backlog_trial.cjs`:

| medição | pessoas | créditos parados |
|---|---|---|
| 25/08 (incidente original) | 54 | 4.830.605 |
| 06/09 | 98 | 7.484.835 |
| 10/09 (noturno de hoje) | 108 | 8.212.661 |
| **10/09 (esta ronda)** | **112** | **8.502.112** |

Destes 112: **82 já passaram do dia 10** (6.248.271 cr, o mais antigo venceu
31/07). Os 6 trials de ontem estão todos aqui dentro.

---

## Os 6 assinantes (mantêm o crédito — correto)

| e-mail | dias | cobranças pagas | sub | situação |
|---|---|---|---|---|
| larissa@amplianegocios.com.br | 16 | rec#2 R$97 COMPLETE 31/08 | — | **sem conta, ver item 1** |
| admatallo@gmail.com | 33 | rec#2 14/08, **rec#3 09/09** | 260.874 | mantido, acesso até 07/10 |
| kuka.psicologa@gmail.com | 40 | rec#2 07/08, rec#3 31/08 | 98.425 (+17.947 extra) | mantido, acesso até 30/09 |
| acontabilmg@gmail.com | 31 | rec#2 16/08, **rec#3 09/09** | 252.641 | mantido, acesso até 09/10 |
| atspaineis@gmail.com | 36 | rec#2 11/08, rec#3 04/09 | 276.606 | mantido, acesso até 04/10 |
| rrneri@gmail.com | 37 | rec#2 10/08, rec#3 03/09 | 200.000 | mantido, acesso até 03/10 |

⚠️ **`admatallo` e `acontabilmg` foram cobrados R$97 em 09/09 e cancelaram no
mesmo dia.** Pela regra estão certos — mantêm crédito e acesso por mais um mês.
Mas é o padrão de arrependimento de cobrança já descrito no `2026-08-18_churn`
(27% dos que saem cancelam no mesmo dia em que são cobrados), e são dois
candidatos naturais a pedir reembolso nos próximos dias.

## Os 6 trials (nenhum pagou de verdade)

Todos com rec#1 R$0 e **nenhuma** cobrança > 0 aprovada. `OVERDUE` não é
pagamento (armadilha 1).

| e-mail | adesão | dias | sub | dia 10 |
|---|---|---|---|---|
| duoclinicsalto@gmail.com | 04/08 | 35 | 61.054 | **14/08 — JÁ passou** |
| sabrinarstefani@gmail.com | 03/09 | 6 | 100.000 | 13/09 |
| bilaherrmann@gmail.com | 05/09 | 4 | 34.251 (+16.375 extra) | 15/09 |
| elaneyani@gmail.com | 06/09 | 3 | 49.202 | 16/09 |
| thiago7631@gmail.com | 08/09 | 1 | 70.465 | 18/09 |
| mmbabona@gmail.com | 09/09 | 0 | 94.330 | 19/09 |

`credits_extra` não é tocado pela regra — os 16.375 do bilaherrmann ficam.

---

## Saída crua da ferramenta

<details>
<summary><code>cancelamentos_ontem.cjs --dia 2026-09-09</code> (12 pessoas)</summary>

```
janela UTC 2026-09-09T00:00:00.000Z -> 2026-09-10T00:00:00.000Z (dia 2026-09-09)
12 evento(s) de cancelamento -> 12 pessoa(s)
varredura expire_trial_credits: DESATIVADA — DESATIVADA POR FRANK EM 18/08 18:5x:
a primeira rodada real zerou 14 pessoas

7 caso(s) FORA DA REGRA: sabrinarstefani@gmail.com, duoclinicsalto@gmail.com,
elaneyani@gmail.com, larissa@amplianegocios.com.br, thiago7631@gmail.com,
mmbabona@gmail.com, bilaherrmann@gmail.com
```

Dos 7 que a ferramenta marcou, **5 são o item 3** (trial no prazo + varredura
parada — a ferramenta alerta de propósito, para não dar "tudo certo" enquanto o
prazo não tem quem cumpra). Os casos que precisam de decisão humana são **2**:
a Larissa (item 1) e o duoclinicsalto (item 2).

</details>

---
Apurado em 10/09 por Frank. Somente leitura: nenhum saldo alterado, nada religado.
