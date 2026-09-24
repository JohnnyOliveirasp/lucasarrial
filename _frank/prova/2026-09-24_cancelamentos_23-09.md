# Cancelamentos de 23/09/2026 — auditoria da regra 9

Rodado em 24/09/2026 por Frank. **Somente leitura: nenhum saldo foi alterado.**
Comando: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-23`
Saída crua: `_frank/prova/2026-09-24_cancelamentos_23-09.{txt,json}`
Complemento: `node _frank/ferramentas/backlog_trial.cjs` → `_frank/prova/2026-09-24_backlog_trial.txt`

Janela UTC `2026-09-23T00:00:00Z → 2026-09-24T00:00:00Z`.
**9 eventos `SUBSCRIPTION_CANCELLATION` → 9 pessoas distintas.**

Classificação pela Hotmart (`GET /subscriptions/{code}/purchases`, array puro):
**2 trial, 7 assinantes, 0 estorno.**

---

## 1. Fora da regra — o que precisa de ação

Nenhum pagante foi zerado e nenhum estorno ficou sem zerar. Os 2 casos fora da
regra são os **dois trials de ontem**, e os dois pelo mesmo motivo de sempre: a
`expire_trial_credits` está desligada, então o prazo existe e não há máquina
para cumpri-lo.

| e-mail | adesão | dia 10 | situação | saldo parado |
|---|---|---|---|---|
| `contato@andreamaral.com.br` | 10/08 | **20/08 (venceu há 34 dias)** | passou do prazo, crédito intacto | **100.000** |
| `brunoclozel@gmail.com` | 18/09 | 28/09 (ainda vai chegar) | no prazo, mas não vai expirar sozinho | **82.405** |

`contato@andreamaral.com.br` é o caso que pesa: **nunca pagou** (rec#1 R$0
`COMPLETE`, rec#2 e rec#3 R$97 **`OVERDUE`**), ficou **44 dias** na casa, o dia 10
dele venceu em **20/08** e ele segue com os **100.000 cr da recarga inicial
intactos** e acesso até **10/10/2026**. Detalhe que atenua o prejuízo de GPU:
o saldo é exatamente 100.000, ou seja **não consumiu um crédito** — é dinheiro
parado, não GPU queimada. `brunoclozel` consumiu 17.595 cr dos 100.000.

**Não zerei nenhum dos dois — a ordem é reportar (regra 9-A/21).** Quem age é a
varredura, e ela está desligada por decisão consciente.

### 1.1 Causa raiz — `expire_trial_credits` continua DESATIVADA

Estado lido do corpo vivo da função (`pg_get_functiondef`; a RPC **não** foi
chamada de propósito — chamar executaria a varredura):

```
estado: desativada
motivo: "DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas"
```

**Estado deliberado, não avaria** — desligada porque a primeira rodada real zerou
14 pagantes (1.356.554 cr, inclusive a conta do Lucas). Continua correto que
esteja desligada enquanto não houver detector-propõe/humano-executa. O que se
acumula enquanto isso:

| | pessoas | créditos |
|---|---|---|
| já passaram do dia 10, crédito ainda lá | 149 | 11.236.006 |
| ainda no prazo, sem máquina pra cumprir | 19 | 1.340.234 |
| **total parado** | **168** | **12.576.240** |

Em 22/09 era 164 pessoas / 12.228.320 cr. **+4 pessoas e +347.920 cr em dois dias.**

---

## 2. Resolvido desde a última ronda — o #446 fechou

O relatório de 22/09 abriu isto como 🔴 urgente: 6 eventos de estorno mortos com
`zero_subscription_credits_on_refund: Could not find the function ... in the
schema cache`, `processed_at: NULL`, e o `mkt.drrigatti@gmail.com` com **149.006
cr intactos** depois de contestar uma cobrança de R$97.

**Foi corrigido.** Os 6 eventos foram reprocessados em **22/09 15:13:58Z** (todos
com o mesmo `processed_at`, marca de reprocessamento em lote) e o saldo das 5
pessoas envolvidas está zerado hoje:

| e-mail | saldo hoje | antes |
|---|---|---|
| `paula@handelhomes.com` | 0 | tinha crédito |
| `core@frentestudio.com.br` | 0 | tinha crédito |
| `vazilg@gmail.com` | 0 | tinha crédito |
| `mkt.drrigatti@gmail.com` | **0** | **149.006** |
| `contato@fotoatleta.com` (protesto novo de 22/09, já sem erro) | 0 | — |

Hoje **não existe nenhum evento de estorno com `processed_at NULL`** (0 de 8.571
eventos no total) e o `PURCHASE_PROTEST` de 22/09 (`contato@fotoatleta.com`)
entrou **sem mensagem de erro** — sinal de que a função existe no schema agora,
não só de que a fila foi limpa.

⚠️ **Resíduo, para quem é dono decidir:** o `mkt.drrigatti@gmail.com` teve o
crédito zerado, mas segue com `access_until = 14/10/2026`. A regra 9 fala de
crédito, e o crédito está certo; o acesso não foi revogado. Não mexi.

---

## 3. Dentro da regra — os 7 assinantes

Todos pagaram de verdade e **todos mantiveram o crédito**. `zeramentos: []` e
`marca: null` nos sete — nenhum lançamento de zeramento por rotina e nenhum
marcador em `trial_credit_expirations`.

| e-mail | ficou | cobranças que entraram | crédito mantido | acesso até |
|---|---|---|---|---|
| `valdemirsilveira@gmail.com` | 12 dias | rec#2 R$97 `APPROVED` | 171.273 (+2.640 extra) | 11/10 |
| `cbaldo.fetal@gmail.com` | 44 dias | rec#2 R$97 `COMPLETE` | 155.713 | 10/10 |
| `ribasadv1975@gmail.com` | 9 dias | rec#2 R$97 `APPROVED` | 193.531 | 14/10 |
| `laila.r.blanco@gmail.com` | 31 dias | rec#3 R$97 `APPROVED` | 180.915 | 23/10 |
| `contato.boostermkt@gmail.com` | 31 dias | rec#2 R$97 `COMPLETE`, rec#3 R$97 `APPROVED` | 279.895 | 23/10 |
| `gustavo@cdd.org.br` | 31 dias | rec#2 R$97 `COMPLETE`, rec#3 R$97 `APPROVED` | 276.961 | 23/10 |
| `brunno.lopes@live.com` | 17 dias | rec#2 R$97 `COMPLETE` | 178.704 | 06/10 |

**Nenhum pagante foi zerado** — 1.436.992 cr mantidos corretamente.

---

## 4. As três armadilhas, conferidas (não presumidas)

**Armadilha 1 — OVERDUE/PRINTED_BILLET não é pagamento.** Pegou de verdade em
dois casos que, filtrando só por `price.value > 0`, teriam virado "assinante":

- `contato@andreamaral.com.br`: rec#2 R$97 `OVERDUE` + rec#3 R$97 `OVERDUE`,
  nada `COMPLETE`/`APPROVED` → é **TRIAL**.
- E o contrário também foi respeitado: `laila.r.blanco` tem **quatro** rec#2
  R$97 `OVERDUE`, mas tem rec#3 R$97 `APPROVED` → é **ASSINANTE**, e manteve o
  crédito. Mesma coisa com `cbaldo.fetal` (rec#2 `OVERDUE` *e* rec#2 `COMPLETE`).

**Armadilha 2 — classificar por PESSOA, não por assinatura.** As 9 foram lidas
por e-mail na Hotmart, com todas as assinaturas de cada uma.
`outrasAssinaturasVivas: []` nas 9 — ninguém aqui tem outro contrato de pé, então
todas as 9 são saída de verdade. O caso que exigia o cuidado: `cbaldo.fetal` tem
**três** assinaturas (`KLT22UV8` `INACTIVE`, `GH6LXTWF` `INACTIVE`, `4EBP74ZH`
`CANCELLED_BY_CUSTOMER`) — as três mortas.

**Armadilha 3 — zero não é prova.** Dois zeros apareceram nesta ronda e os dois
foram contraprovados em vez de aceitos:

1. **"0 estornos ontem".** O filtro de janela foi rodado dia a dia nos últimos 10
   dias e **enxerga**: 1 em 22/09, 1 em 21/09, 1 em 18/09, 2 em 17/09, 2 em
   16/09 — e 0 em 23/09. Instrumento que acha o que existe pode concluir
   ausência. Contraprova também no histórico: 19 `PURCHASE_PROTEST`, 14
   `PURCHASE_REFUNDED`, 3 `PURCHASE_CHARGEBACK` no total.
2. **"0 eventos de estorno travados".** Este zero quase virou relatório errado
   no sentido *contrário* — ver a seção 5.

`data.subscriber.email` veio preenchido nos 9 eventos (nenhum caiu no ramo que
imprime payload cru) e `erro: null` nos 9 no JSON.

---

## 5. Erro meu que quase virou relatório errado

**Quase reportei "o #446 foi enterrado" em vez de "o #446 foi corrigido".**
Ao ver que os 6 eventos travados tinham `processed_at` preenchido **todos no
mesmo instante** (22/09 15:13:58Z) e que a coluna `error` **ainda continha a
mensagem de falha**, a leitura natural era a pior: alguém marcou a fila como
processada sem zerar nada, e o vazamento tinha ficado *invisível* — pior que
antes, porque deixaria de aparecer em qualquer varredura de pendência.

Não concluí pela aparência, fui ver o saldo das 5 pessoas. **Estão zeradas** —
o drrigatti saiu de 149.006 para 0. O `error` antigo é histórico do lançamento
que falhou, não estado atual. Confirmação independente: o protesto novo de 22/09
(`contato@fotoatleta.com`) entrou **sem erro nenhum**, o que só acontece se a
função existir de verdade no schema. O achado sobreviveu à tentativa de
derrubá-lo, mas na direção oposta à que eu suspeitava.

Lição: `error` preenchido não significa "falhando agora"; e `processed_at` em
lote não significa "varreram pra debaixo do tapete". Quem decide é o saldo.

---

## Método / provas

- Evento lido de `payment_events`, `event_type = 'SUBSCRIPTION_CANCELLATION'`,
  `received_at` na janela do dia 23/09 UTC. Código do assinante de
  `data.subscriber.code` (**não** `data.subscription.subscriber.code`, que não
  existe neste evento).
- Classificação feita **na Hotmart**, não no nosso banco.
  Pagou = `price.value > 0` **E** status `COMPLETE`/`APPROVED`.
- Agrupamento por **pessoa (e-mail)**; todas as assinaturas de cada e-mail lidas.
- Rodado de um **worktree limpo em `origin/main`** (`a357e75b`), não do checkout
  de trabalho — lição de 19/09 e 22/09 aplicada antes de errar, não depois.
- Esquema real conferido: a tabela é `payment_events(payload, buyer_email, ...)`
  e o perfil é `profiles(credits_subscription, credits_extra, access_until)` —
  não `data` nem `subscription_access_until`. Conferências avulsas em
  `_frank/rascunhos/2026-09-24_verif_*.cjs` (todas somente leitura).
- **Nenhum saldo foi alterado por esta rodada.** Os scripts são somente leitura
  por construção e a função de expiração foi lida, não executada.
