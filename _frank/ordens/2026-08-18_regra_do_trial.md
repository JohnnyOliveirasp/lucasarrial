
---

## Confirmado pelo Johnny (18/08, depois da primeira versão deste arquivo)

**1. Quem cancelou no trial e voltar, compra de novo.** Confirmado. Não existe
segundo trial para a mesma pessoa. Minha leitura estava certa.

**2. Para que servem os 3 dias de carência.** Aqui eu tinha entendido como
"cortesia estendida", e não é isso. Palavras dele:

> *"essa carência de 3 dias é apenas para ver se no automático a compra entra,
> porque todo mundo que é trial automaticamente paga. É somente para garantir
> isto."*

Ou seja: a carência **não é um benefício para o aluno**, é uma **margem
operacional**. Todo trial vira cobrança automática no dia 7. Os 3 dias existem só
para absorver atraso do processador, retentativa de cartão e demora de webhook —
para o sistema não zerar o crédito de alguém cuja cobrança estava a caminho.

Isso muda a leitura, não o código: continua sendo "zera no dia 10 se não entrou
pagamento". Mas muda o **critério de acerto** da implementação. A pergunta que o
código tem que responder bem não é "faz tempo que expirou?", é **"tem alguma
cobrança em voo?"**. Se um pagamento chegar no dia 11, atrasado, ele tem que
reativar a pessoa — não encontrar a conta zerada.

Caso real que prova o mecanismo: a Viviana. `rec#1` em 11/08 com valor 0 (adesão
ao trial) e `rec#2` em 18/08 com US$ 22 (primeira renovação, automática, 7 dias
depois). O trial vira pagamento sozinho — é a regra, não a exceção.

---

## Terceira situação: ESTORNO (18/08, decidida depois)

O Johnny apontou que a Viviana não era caso de "cancelou e continuou": *"ela
cancela tudo porque ela pediu o estorno da compra"*.

São **três** situações, não duas:

| Situação | O que acontece com o crédito |
|---|---|
| Pagou e cancelou | **mantém** — o dinheiro ficou com a gente pelo ciclo |
| Trial e saiu | **zera** — nunca pagou |
| Pagou e foi **estornado** | **zera** — o dinheiro voltou pra pessoa |

### Executado

3 contas, todas com o mesmo padrão confirmado na Hotmart: `rec#1` de valor 0
(adesão ao trial) + `rec#2` de valor cheio com status `REFUNDED`. Ou seja,
pagaram uma mensalidade e receberam ela de volta.

```
tecnologylegacy@gmail.com   195.800 -> 0
will.tico@gmail.com         100.000 -> 0
contatoabreu25@gmail.com    100.000 -> 0   (+8.112 de extra PRESERVADOS)
```

Os 8.112 do contatoabreu25 vieram de **cinco** `video_clone_refund` — devolução
por geração que falhou. É dívida nossa com ele, não entra na conta do estorno.

Cada zeragem tem lançamento negativo em `credit_transactions`
(`ref_type=estorno`), auditável e reversível.

### Detalhe que apareceu no caminho

O `will.tico` tinha **três** recargas de 100.000 no nosso banco, mas só **duas**
compras na Hotmart — uma delas de valor zero. Ou seja, ele recebeu crédito a mais
do que comprou. Bate com o bug de crédito em dobro descrito no comentário do
webhook (`route.ts`, nota de 10/08: APPROVED e COMPLETE creditavam os dois). Não
mudou a decisão dele — o dinheiro foi devolvido de qualquer jeito — mas vale saber
que existiram contas com recarga duplicada.

### O buraco estrutural

`revokeAccess` troca o status do entitlement e **não encosta em saldo**. Então
estorno devolvia o dinheiro e deixava o crédito. Card criado para o webhook zerar
sozinho daqui pra frente, tratando só os três status de dinheiro-devolvido
(refunded, chargeback, protest) e nunca o cancelamento de quem pagou.
