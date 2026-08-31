# #214 — a aluna pagou, e o pagamento ENTROU. Ela está na conta errada.

Data: 2026-08-31 · autor: coder · incidente `ffbfdfc4` (#214)

## Veredito

**Não é compra órfã, não é buraco de receita europeia, e não faltava liberar
crédito nenhum.** A aluna tem duas contas. A assinatura está paga, ativa e
provisionada numa delas; ela reclama a partir da outra.

A recomendação da nota anterior do EXECUTOR ("liberar os créditos mesmo assim
com base no comprovante") teria dado **100.000 créditos de graça** numa conta
cuja assinatura já estava paga e entregue noutra conta.

## As duas contas

| | reclama aqui | pagou aqui |
|---|---|---|
| e-mail | `zicasantos37@gmail.com` | `zicasantos08@hotmail.com` |
| profile | `1002aa46` | `405606d7` |
| criada | 19/08 20:30 | 27/08 17:41 |
| plano | free | **pro** |
| saldo | **0** | **88.425** |
| acesso | nenhum | **ativo até 19/09** |
| voz | nenhuma | `Minha Voz` ready, 40min |
| login | provider `google` | provider `email`, **`last_sign_in_at` NULL** |

`last_sign_in_at` NULL é a chave: ela **nunca entrou** na conta paga.

## A prova do pagamento

`payment_events` `event_id = 049a531b-060b-4d5a-a91b-254c137c5e2a`,
`PURCHASE_APPROVED`, recebido 26/08 14:13:10Z, `processed_at` 14:13:16Z, `error` NULL:

```
price.value           17     EUR
full_price.value      20.91  EUR   <-- bate EXATO com o comprovante dela
status                APPROVED
payment.type          CREDIT_CARD
checkout_country      PT (Portugal)
transaction           HP2306675202
recurrence_number     2
original_offer_price  102.16 BRL    <-- o "R$ 97" que ela citou em 27/08
```

O `full_price` de **20,91 EUR** é exatamente o valor do extrato Millennium BCP
que ela anexou. A diferença de data (ela diz 27/08, o evento é 26/08) é o
lançamento do banco no dia seguinte.

Esse evento gerou grant de verdade: entitlement `cb73bfcf` `active` até
19/09, `+100.000` créditos em 27/08 17:41 na conta do hotmail.

## Que é a mesma pessoa

1. Mesmo prefixo de e-mail: `zicasantos`37 / `zicasantos`08.
2. Comprador na Hotmart: *Maria Florinda Barbosa Melo dos Santos*; display do gmail: *Maria Santos*.
3. Em 19/08, na mesma noite: profile do gmail criado 20:30 → `PURCHASE_APPROVED`
   (trial 0 EUR) no hotmail 20:36 → `PURCHASE_OUT_OF_SHOPPING_CART` no gmail 21:14.
   Carrinho abandonado num e-mail, compra concluída no outro.
4. Só quem fez a compra teria o comprovante da transação HP2306675202.

## O que o 27/08 mostrou e ninguém ligou

Às 20:45 de 27/08 ela escreveu no chat: *"já fiz a assinatura dos R$ 97"* e
depois *"vi agora, o pagamento na hotmart ainda está pendente"*. A ronda do
Vigia de 27/08 registou isso como **"resolveu sozinha e o sistema agiu certo"**.

Não agiu: o grant já tinha caído às **17:41 do mesmo dia**, 3 horas ANTES da
mensagem dela. O pagamento não estava pendente — estava aplicado na outra conta.
Custou 4 dias de bloqueio a uma assinante pagante.

## Ação tomada

- E-mail enviado a `zicasantos37@gmail.com` em **31/08 22:34:59Z** (SMTP aceito,
  cópia em Enviados uid 402, bcc suporte@). Corpo: `_Bugs/inc214/corpo.html`.
- Explica as duas contas, manda entrar em `zicasantos08@hotmail.com` usando
  *Esqueci a minha senha* (ela nunca definiu senha lá), e avisa que naquela
  conta o login é e-mail+senha, não o botão do Google.
- Pedida a confirmação de que o hotmail é dela.
- Incidente movido para `aguardando_aluno`.
- **Nenhum crédito liberado.** Nenhum era necessário.

## Medição do padrão (era isto um padrão?)

- **(a)** Alunos com saldo 0, sem grant, alegando pagamento nos últimos 30 dias: **4**
  — `zicasantos37` (Maria Santos), `comercial@roteironamao.com` (Cristina Hossu),
  `lilianesheyla@gmail.com`, `anapaularenatomoura@gmail.com`.
- **(b)** Desses, que mencionam Millennium BCP ou pagamento em EUR: **1** (só a Maria).
- **(c)** Pagamentos em EUR que entraram com sucesso nos últimos 30 dias:
  **30 `PURCHASE_APPROVED` em EUR, 15 deles com valor > 0**, todos com
  `error` NULL e `processed_at` preenchido. **A integração europeia funciona.**
  Não há buraco de receita. (O da Maria é um dos 15.)
- **(d)** Compras órfãs (pagamento aprovado, valor > 0, sem profile) em 30 dias: **22**,
  mas nenhuma bate por nome com as outras 3 alunas. Só a Maria tem o par
  cross-email — e o dela nem é órfão, tem profile e grant.

Verificação das outras 3:
- `lilianesheyla` — zero payment_events sob o nome ou e-mail dela. Não pagou.
- `Cristina Hossu` / `Ana Paula Renato Moura` — nada bate por nome. Não pagaram.
- (fora da lista) `danielltozello` (#93) tem o mesmo *cross-email*
  (`clonedigitaldaniel@gmail.com`), mas só com trial **R$ 0** — nunca pagou.
  Mesma estrutura, sem dinheiro envolvido.

**Conclusão: caso isolado, não padrão.** 1 de 4. O que é estrutural não é o
banco europeu nem o webhook — é o **aluno ter duas contas com e-mails
diferentes**, que aparece em 2 casos (Maria e Daniel) e que hoje o produto não
detecta nem avisa.

## O que vale corrigir (não feito neste card)

Quando o webhook cria conta para um `buyer_email` que ainda não tem profile,
ninguém verifica se já existe outra conta da mesma pessoa. A aluna ficou com
duas contas e nenhuma tela lhe disse isso. Duas ideias baratas:

1. No grant, se o `buyer.name` casar com um profile existente de outro e-mail,
   registar o par e avisar (ou juntar).
2. Na tela de créditos/assinatura, quando o saldo é 0 e existe uma compra
   Hotmart com nome igual noutro e-mail, mostrar *"a sua assinatura está na
   conta X"* em vez de só oferecer assinar de novo.

A Fast também merece um reparo: em 27/08 ela aceitou o *"está pendente"* da
aluna sem consultar o nosso próprio banco, e em 31/08 leu o comprovante e
concluiu *"pagamento confirmado, créditos não liberaram"* — as duas vezes sem
procurar a compra pelo nome/valor. Era uma consulta.
