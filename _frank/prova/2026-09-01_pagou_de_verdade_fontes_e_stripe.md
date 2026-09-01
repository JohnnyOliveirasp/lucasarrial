# 01/09/2026 — As "3 fontes" do pagou_de_verdade.cjs eram 1 só. E não era isso que quebrou os casos.

Card: apurar se existe pagamento fora da Hotmart, consertar o texto que crava
"NUNCA PAGOU", e reavaliar zicasantos37 / Maria Santos / luciane.garcia19.

---

## TAREFA 1 — Existe pagamento fora da Hotmart? **SIM. Stripe.**

O card estava certo no diagnóstico do instrumento: as três consultas eram todas
Hotmart (`/subscriptions`, `payment_events` com `.eq("provider","hotmart")`,
`/sales/history`). Uma fonte com três chapéus.

### Contagem com paginação de verdade (não bateu no teto de 1000)

`count exact` = 5.178 · lidos por paginação (páginas de 1.000, `order by id`) = 5.178.
Os dois números batem, então nada ficou fora da varredura.

```
TOTAL payment_events (count exact): 5178
LIDOS por paginacao: 5178
POR PROVIDER: { "stripe": 54, "hotmart": 5124 }
  count exact provider=hotmart: 5124
  count exact provider=stripe: 54
  count exact provider=mercadopago: 0
```

Por event_type (íntegra):

```
stripe  | checkout.session.completed        54
hotmart | PURCHASE_APPROVED               1560
hotmart | PURCHASE_COMPLETE               1269
hotmart | PURCHASE_DELAYED                 489
hotmart | CLUB_FIRST_ACCESS                478
hotmart | PURCHASE_BILLET_PRINTED          419
hotmart | PURCHASE_OUT_OF_SHOPPING_CART    310
hotmart | SUBSCRIPTION_CANCELLATION        304
hotmart | PURCHASE_CANCELED                157
hotmart | CLUB_MODULE_COMPLETED            102
hotmart | PURCHASE_PROTEST                  11
hotmart | PURCHASE_REFUNDED                  8
hotmart | UPDATE_SUBSCRIPTION_CHARGE_DATE    7
hotmart | PURCHASE_EXPIRED                   4
hotmart | PURCHASE_CHARGEBACK                2
hotmart | ORDER_FULFILLMENT                  2
hotmart | SWITCH_PLAN                        2
```

### No código

- `frontend/src/app/api/v1/webhooks/stripe/route.ts` — webhook do Stripe, grava
  em `payment_events` com `provider='stripe'` e credita via `addExtraCredits`.
- `frontend/src/app/api/v1/credits/checkout/route.ts` + `frontend/src/lib/stripe/client.ts`
  — checkout de **pacotes de crédito avulso** (R$19 / R$42 / R$78).
- `frontend/src/lib/db/types.ts:30` — `PaymentProvider = "hotmart" | "mercadopago" | "stripe"`.
- `scripts/12_payments.sql:23-24` — `check (provider in ('hotmart','mercadopago'))`.
  ⚠️ O check **não inclui 'stripe'** mas há 54 linhas com esse valor gravadas:
  a constraint da produção é mais larga que a do 01_schema versionado. Fica
  registrado; não mexi (não é o escopo do card).
- **mercadopago**: existe no type e no check, tem **0 evento**. Não é via ativa.

**Resposta:** existe pagamento fora da Hotmart — **Stripe**, 54 eventos, e o
`.eq("provider","hotmart")` os descartava.

### Mas o impacto disso é MENOR do que parece — e é honesto dizer

Dos 54 eventos, **24 são `livemode=false`** (o modo de teste que rodou em
produção de 09/06 a 14/08) e **todos os 54 vêm com `payment_status:"paid"`** —
prova de que `paid` sozinho não é dinheiro. Sobram 30 eventos live, 22 e-mails.

Triando esses 22 contra o resto do banco, 11 não tinham pagamento Hotmart
registrado aqui. Rodando o instrumento neles um a um, **10 já apareciam como
PAGOU pela compra avulsa** (o conserto do #173 já os cobria). Só **1** pessoa
seria chamada de "NUNCA PAGOU" hoje por causa da cegueira ao Stripe:

```
rogerhenriquemoreira@gmail.com
  PAGOU — créditos no Stripe | assinaturas: 1 | PURCHASE_APPROVED>0 no nosso banco: 0
  | avulsas pagas: 0 | stripe pago: 1 (R$ 19.00)
```

O caso de dinheiro mais gordo escondido era o `agshortcut@gmail.com`:
**R$ 702,00 em 9 compras live de crédito**, com a assinatura FastCloner OVERDUE.
Ele já era "PAGOU" pela avulsa, mas os R$702 não apareciam em lugar nenhum.

---

## TAREFA 2 — O conserto

Arquivo: `_frank/ferramentas/pagou_de_verdade.cjs`

1. **Texto.** `"NUNCA PAGOU (nenhuma das 3 fontes)"` →
   `"SEM PAGAMENTO ENCONTRADO NESTE E-MAIL (hotmart + stripe)"`, mais um aviso
   impresso junto do veredito negativo mandando procurar a pessoa por nome/CPF/
   prefixo antes de negar qualquer coisa ao aluno.
2. **Stripe virou fonte de verdade**, com a guarda do 14/08: só conta com
   `livemode === true` **e** `payment_status === "paid"` **e** valor > 0.
   Filtro por `payload->data->object->>customer_email` (a coluna `buyer_email`
   vem NULL nesses eventos — testado, não dá para filtrar por ela).
3. Novo fato separado no retorno: `pagouCreditoStripe` (+ `stripePagas`,
   `totalStripe`). Não colapsei no booleano único — mesma disciplina do #173.
4. Cabeçalho reescrito com o terceiro engano medido e os dois casos reais.

---

## TAREFA 3 — Veredito dos três

⚠️ Antes do veredito: **os "3 casos" são 2 pessoas.**
`profiles` de `zicasantos37@gmail.com` tem `display_name = "Maria Santos"`.
zicasantos e "Maria Santos" são **a mesma pessoa**, contada duas vezes no card.

### 1+2. zicasantos37@gmail.com = "Maria Santos" (#214) — **PAGOU. Pela Hotmart.**

```
zicasantos08@hotmail.com
  PAGOU — assinatura + compra avulsa | assinaturas: 1 | PURCHASE_APPROVED>0 no nosso banco: 1
  | avulsas pagas: 2 (R$ 146.37) | stripe pago: 0
    assinatura rec#2 R$   17 APPROVED         2026-08-26
    venda     assin.  R$   20.91 APPROVED     2026-08-26 HP2306675202 FastCloner
```

O `full_price` 20,91 EUR bate exato com o comprovante Millennium BCP dela.
**Caminho: Hotmart, não outro provedor.** O que fez o instrumento dizer "nunca
pagou" foi o **e-mail**: ela compra em `zicasantos08@hotmail.com` e entra no app
em `zicasantos37@gmail.com`. Já apurado e respondido em 31/08 (nota do Frank no
#214); o incidente está `aguardando_aluno`. Nenhum crédito a liberar.

### 3. luciane.garcia19@gmail.com (#218) — **NÃO pagou a assinatura. Pagou um curso, noutro e-mail.**

Achei-a por varredura de `payment_events` por nome: `luciane.garcia@icloud.com`,
"LUCIANE GARCIA". Mesma armadilha do #214.

```
luciane.garcia@icloud.com
  PAGOU — compra avulsa | assinaturas: 2 | avulsas pagas: 1 (R$ 313.32) | stripe pago: 0
    assinatura rec#1 R$    0 CANCELLED
    assinatura rec#1 R$    0 APPROVED         2026-09-01
    venda     AVULSA  R$  313.32 APPROVED     2026-08-30 HP3644560975 Fábrica de Conteúdo Invisível
    venda     assin.  R$       0 APPROVED     2026-09-01 HP2410838174 FastCloner
```

Evidência crua dos dois eventos (`payment_events`, provider hotmart):

- `PURCHASE_CANCELED` 01/09 14:39 · tx HP1504754514 · `price.value: 0` ·
  `payment.type: CREDIT_CARD` ·
  `refusal_reason: "Existe algum tipo de restrição neste cartão. Verifique se ele já está habilitado para compras online, ou entre em contato com o seu banco."`
  · erro do webhook: `externalId não casa com nenhum entitlement: 4QCFMJP9`
- `PURCHASE_APPROVED` 01/09 14:44 · tx HP2410838174 · `price.value: 0` ·
  oferta `ewxrfw9j` "Plano para quem está conosco desde o início" (Plano Founder)
  · `processed_at` preenchido, `error: null`

Entitlement gerado:

```
id 92cc3059 | buyer_email luciane.garcia@icloud.com | provider hotmart
external_id 1P8JMPHZ | status active | access_until 2026-09-08T12:00:00Z
user_id: null      <-- ÓRFÃO
```

Conta do app (`luciane.garcia19@gmail.com`, profile e95e44fe): `plan=free`,
`access_until=null`, `credits_subscription=0`, `credits_extra=0`,
0 linhas em `entitlements`, 0 linhas em `credit_transactions`.

**Veredito:** ela **não pagou a assinatura do FastCloner** — o que a Hotmart
aprovou foi **R$ 0,00** (Plano Founder, garantia até 08/09). O "cartão aprovado"
que ela relata é o cadastro do cartão no trial; a primeira tentativa foi inclusive
**recusada pelo banco**. O que ela pagou de verdade foi **R$ 313,32 pelo curso FCI**
em 30/08, num e-mail diferente. Os 100.000 créditos não caíram porque o
entitlement ficou com `user_id = null`: o e-mail da compra (icloud) não existe
como conta.

**Não é caso de "liberar 100.000 créditos".** O conserto é vincular o entitlement
órfão à conta dela (ou fazê-la entrar pelo e-mail da compra), e o direito são os
créditos do plano R$0, não os de uma mensalidade paga. Como o card mandou, **não
liberei nada e não respondi a aluna** — decisão é do Frank/Johnny.

---

## O que eu diria diferente do card

A hipótese do card era "existe provedor escondido e por isso negamos crédito".
Existe provedor escondido (Stripe), e ele valia consertar. **Mas não foi ele que
quebrou nenhum dos dois casos.** Os dois são a mesma coisa e é outra coisa:
**a ferramenta é indexada por e-mail e a pessoa compra num endereço e entra
noutro.** Consertar só o provedor teria deixado a armadilha real de pé — por isso
o aviso do veredito negativo aponta para o e-mail, não para o provedor.
