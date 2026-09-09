# Cancelamentos de 08/09 — conferência (rodada 09/09)

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-08`
Somente leitura. **Nenhum saldo foi tocado** (regra 9-A: quem age é a varredura,
sobre lista aprovada — nunca o relatório).

Janela UTC `2026-09-08T00:00:00Z -> 2026-09-09T00:00:00Z`.
6 eventos `SUBSCRIPTION_CANCELLATION` -> 6 pessoas. **3 trial, 3 assinantes.**

JSON cru desta rodada: `/tmp/canc_0908.json` (não versionado; regerável com
`--json --dia 2026-09-08`).

---

## 1. O que vem primeiro: os 3 trials de ontem não vão expirar sozinhos

A varredura `expire_trial_credits` continua **DESATIVADA** — **22º dia**.
Corpo lido por `pg_get_functiondef` (não por chamada à RPC — chamar
executaria a varredura sobre gente real a partir de um relatório
somente-leitura). Motivo gravado no próprio corpo:
*"DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas"*.

Os 3 trials de ontem estão **dentro do prazo** — o dia 10 deles ainda não
chegou. Tecnicamente nenhum está fora da regra hoje. Materialmente, quando o
dia 10 chegar **não existe máquina pra cumprir o prazo**:

| pessoa | dia 10 do trial | crédito parado |
|---|---|---|
| evertonk95@gmail.com | 12/09 | 66.674 |
| denison@perfeitoimoveis.com.br | 13/09 | 21.704 |
| danielbispo@gmail.com | 17/09 | 77.902 |
| | **soma de ontem** | **166.280 cr** |

Esta é exatamente a armadilha que o `24/08` documentou: relatório que olha só o
prazo, e nunca a máquina que cumpre o prazo, imprime "nenhum caso fora da
regra" enquanto o crédito vaza.

### O buraco acumulado (`backlog_trial.cjs`, medido hoje)

| situação | pessoas | crédito |
|---|---|---|
| já passou do dia 10, crédito ainda lá | 83 | 6.348.271 |
| ainda no prazo, sem máquina pra cumprir | 25 | 1.864.390 |
| **total parado pela varredura desligada** | **108** | **8.212.661 cr** |

Nada disso é decisão minha: religar a varredura mexe em saldo de 108 pessoas
de uma vez, muito acima de qualquer teto da 9-B. **Depende do Johnny**, e
depende de dry-run seco com os nomes na tela antes (regra 9-A).

---

## 2. Os 3 assinantes: todos mantiveram o crédito — regra 9 cumprida

Nenhum pagante teve saldo zerado por rotina. `credit_transactions` com débito
de rotina (`trial_expirad|estorno|subscription_expired|refund|chargeback`):
**0 lançamentos** para os três. `trial_credit_expirations` com
`outcome='zeroed'`: **nenhum**.

| pessoa | tempo de casa | cobranças pagas | crédito hoje |
|---|---|---|---|
| afsadvocacia2019@gmail.com | 47 dias | rec#2 R$97 + rec#3 R$97 (COMPLETE) | 200.000 mantidos |
| lgmilagres@gmail.com | 16 dias | rec#2 R$97 (COMPLETE) | 100.460 mantidos |
| antoniocarloscheroto.adv@gmail.com | 11 dias | rec#2 R$97 (APPROVED) | 200.000 mantidos |

`afsadvocacia2019` tem marcador `trial_credit_expirations = paid (0 cr,
18/08)` — classificação correta, sem débito.

⚠️ Todas as 3 assinaturas aparecem na Hotmart com `trial: true` na adesão.
Isso é o rec#1 de R$0 do plano Founder, **não** significa que a pessoa é
trial: o que classifica é a cobrança com valor > 0 **e** status
COMPLETE/APPROVED (armadilha 1). Os três pagaram de verdade.

---

## 3. Armadilha 2 (classificar por assinatura em vez de por pessoa): conferida

Para cada um dos 6 e-mails foram lidas **todas** as assinaturas na Hotmart
(`GET /subscriptions?subscriber_email=`), não só a que cancelou.
`outrasAssinaturasVivas` = **0 para os 6**. Ninguém aqui cancelou uma
assinatura e ficou com outra viva — todas as 6 saídas são saídas de verdade.

## 4. Contraprovas (zero de endpoint não é prova)

- `payment_events` respondeu com 6 linhas na janela — não foi consulta vazia.
- `profiles` por e-mail: **as 6 pessoas têm conta** na plataforma
  (`semConta=false` nas 6). Nenhum órfão como o `rodrigo.limas` de 07/09.
- `purchases` da Hotmart devolveu ARRAY PURO com cobranças em todos os 6 casos
  — nenhuma resposta vazia foi interpretada como "não pagou".
- Nenhum erro de leitura de banco ou de API nos 6 (`erroBanco=nao`,
  `erro=nao`).

## 5. O que eu NÃO fiz

- Não chamei a RPC `expire_trial_credits` (chamar = executar sobre gente real).
- Não zerei, não creditei e não mexi em saldo de ninguém.
- Não religuei a varredura — 108 pessoas de uma vez é decisão do Johnny.
