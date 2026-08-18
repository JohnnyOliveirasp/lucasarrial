# O botão de cancelar funciona. O que não funciona é a volta.

Frank, 18/08/2026. Investigação motivada pela pergunta do Johnny: "dá pra fazer
com que, quando alguém pedir cancelamento pela nossa plataforma, a gente mande o
pedido pra Hotmart?"

## Resposta curta

**Já existe e já funciona.** O que está quebrado é o caminho de volta: a Hotmart
avisa que cancelou e **nós ignoramos o aviso**, sempre, desde sempre.

## 1. A ida existe

| Peça | Onde |
|---|---|
| Botão + modal com motivo | `frontend/src/components/app/cancel-subscription.tsx` |
| Rota | `POST frontend/src/app/api/v1/subscription/cancel/route.ts` |
| Cliente Hotmart | `frontend/src/lib/hotmart/subscription.ts` → `cancelSubscription()` → `POST /subscriptions/{code}/cancel` |

Prova de que chega lá: peguei 12 alunos que clicaram no botão e perguntei o status
**direto na API da Hotmart**. Os 12 voltaram `CANCELLED_BY_SELLER`.

```
pediu 2026-07-08 | viniciusjac@icloud.com       | FIYBKK57 | nosso=active | HOTMART=CANCELLED_BY_SELLER
pediu 2026-07-08 | walidsafadi@gmail.com        | 3T20BWUZ | nosso=active | HOTMART=CANCELLED_BY_SELLER
pediu 2026-07-14 | nutricristina1@gmail.com     | RC5SWXW6 | nosso=active | HOTMART=CANCELLED_BY_SELLER
   (mais 9, todos iguais)
```

Repare na coluna do meio: **na Hotmart está cancelado, no nosso banco está ativo.**

## 2. A volta está quebrada, e falha calada

`payment_events` mostra **185 eventos `SUBSCRIPTION_CANCELLATION` recebidos, todos
marcados como processados, nenhum com erro.** E mesmo assim:

```
distribuição dos entitlements hotmart: {"active":741,"chargeback":3,"refunded":3}
```

**Zero `canceled`.** Nunca aconteceu uma vez.

### A causa, em uma linha de código

`extractExternalId()` (webhook da Hotmart, ~linha 298) procura o código do
assinante em `data.subscription.subscriber.code`. No evento de cancelamento o
payload real é outro:

```
chaves de data     : product, subscriber, subscription, date_next_charge, cancellation_date, ...
data.subscription  : {"id":45425132,"plan":{"id":1325347,"name":"Plano Founder"}}   <- sem subscriber
data.subscriber    : {"code":"KHU9LRZT","name":"Viviana Cotua","email":"..."}       <- está AQUI
```

Não achando, a função devolve a string literal `"SUBSCRIPTION_CANCELLATION:unknown"`.
Esse valor nunca casa com entitlement nenhum, então `revokeAccess` sai no
`if (!existing) return;`, o handler devolve `"revoked:canceled"` e o evento é
gravado como processado e limpo.

**O sistema registra sucesso em cima de um no-op.** Mesma família do `|| 'Done.'`
do bot: o caminho de falha foi escrito para parecer com o de sucesso.

Confirmei que o conserto não quebra nada: em `PURCHASE_APPROVED` e
`PURCHASE_COMPLETE` o campo `data.subscriber` **não existe**, então incluí-lo na
frente da cadeia é inerte para esses eventos. Idem em `PURCHASE_CANCELED`,
`PURCHASE_REFUNDED` e `PURCHASE_PROTEST`, que trazem `subscription.subscriber.code`
e por isso sempre funcionaram (são justamente os 3 chargebacks e 3 refunds).

## 3. O tamanho do estrago

```
alunos que a Hotmart cancelou e o nosso banco ainda trata como assinantes : 158
   com crédito parado em conta                                            : 157
   total de créditos nas mãos de quem já cancelou              : 13.859.685
```

Amostra:

```
walidsafadi@gmail.com             | plano free | 100.000 créditos
luizrenatogomescarvalho@gmail.com | plano free | 100.000 créditos
ericabiolcati@gmail.com           | plano free | 110.000 créditos
eversonfelizardo@gmail.com        | plano pro  | 197.630 créditos | acesso até 2026-09-11
```

**Isto é o vazamento de crédito que estávamos caçando.** A ligação é direta: o
portão de geração de clone e imagem é o crédito (`canGenerate = team || creditsTotal >= MIN`),
não a assinatura. Como o cancelamento nunca zerou nada, quem saiu continuou com o
bolsão do último ciclo e segue gerando. Não é um vazamento de acesso, é de crédito.

## 4. Onde isso deixa a Viviana

O evento de cancelamento dela chegou às 16:26 com `data.subscriber.code = KHU9LRZT`
— que é exatamente o `external_id` do entitlement dela. Casaria. Não casou por causa
deste bug. Só que no caso dela isso é detalhe: o cancelamento foi tarde de qualquer
jeito, porque ela pediu **por e-mail** e ninguém agiu. Ver
`2026-08-18_viviana_cobranca_22.md`.

## 5. O que já está encaminhado e o que depende de decisão

- **Card `1133e731`** (coder): corrigir `extractExternalId`, teste de regressão com
  payload real, e **acabar com o silêncio** — cancelamento que não acha dono passa a
  gravar erro em `payment_events.error` em vez de ser marcado como processado limpo.
- **Depende do Johnny:** o conserto retroativo dos 158. Mexer no status do
  entitlement é reversível; mexer nos 13,8 milhões de créditos é dinheiro e não
  entra sem ordem dele.

## 6. Um erro meu no meio do caminho

Meu primeiro teste usou o status do nosso entitlement como prova de que o
cancelamento tinha ido pra Hotmart. Deu "97 de 97 ainda ativos" e eu quase
reportei que **o botão não cancelava nada** — exatamente o contrário da verdade.
O proxy media o nosso banco, não a Hotmart. Só não virou relatório errado porque
fui perguntar na fonte antes de escrever.
