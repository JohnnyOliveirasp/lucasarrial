# Os 14 nunca pagaram. A varredura acertou, quem errou fui eu.

Frank, 18/08, depois da ordem `2026-08-18_detector_nunca_executa.md`.

## A correção do que eu afirmei

Eu disse ao Johnny, com todas as letras: *"a varredura zerou 14 clientes
pagantes"*. **Isso é falso.** Conferi os 14 agora com a ferramenta
`_frank/ferramentas/pagou_de_verdade.cjs`, um por um, na Hotmart:

```
14 de 14 -> NUNCA PAGOU
padrão idêntico: rec#1 R$ 0 COMPLETE (o trial)
                 rec#2, rec#3 R$ 97 OVERDUE  <- cobrança emitida e NÃO paga
```

A Hotmart **emite** a mensalidade de R$ 97 assim que o trial vence, mesmo para
quem nunca pagou, e deixa como `OVERDUE`. Eu li `price.value > 0`, vi "R$ 97" e
concluí "pagou". **O campo que decide é o `status`, não o valor.**

## O que isso muda

| O que eu disse | O que é verdade |
|---|---|
| a varredura zerou pagantes | a varredura zerou trials que nunca pagaram — **ela acertou** |
| eu consertei um erro | eu **criei** um: devolvi 1.356.554 créditos a 14 não-pagantes |
| o débito foi indevido | o débito estava certo; o **estorno** é que foi indevido |

Errei duas vezes seguidas no mesmo dia, nas duas direções: primeiro quase
reportei que o botão de cancelar não funcionava (media o nosso banco, não a
Hotmart), agora reportei pagante onde havia inadimplente. As duas vezes por
olhar o campo que chama atenção em vez do campo que decide.

## Por que a função continua desligada mesmo assim

O motivo mudou, a decisão não. Ela fica desligada porque:

1. **Zerou o Lucas.** A allowlist (`bypassesBilling`: Johnny, Lucas, Edu) vive
   no código do app; a função no banco não passa por lá. Isso é defeito
   separado da detecção, e significa que a conta do Johnny estava igualmente
   exposta.
2. **Decidiu debitar 111 pessoas de uma vez e executou**, sem teto e sem
   ninguém ver a lista antes.

Ou seja: mesmo tendo classificado certo, ela não pode voltar do jeito que está.

## Onde eu discordo do critério de aceite

A ordem pede: *"os 14 nomes reais passam sem serem debitados"*. Esse critério
foi escrito quando a gente achava que eles tinham pago. **Agora ele está
errado** — 13 dos 14 são trial puro e, pela regra do Johnny, o crédito deles
vence mesmo. Congelar "nunca debitar estes 14" no código enterraria a regra.

O critério correto, na minha leitura:

- **Lucas e a allowlist**: nunca debitados, nunca — isso sim vira teste.
- **Os outros 13**: aparecem na **proposta**, não numa execução automática.

## O que eu NÃO fiz

Não mexi em saldo de novo. Os 1.356.554 seguem com as 14 pessoas, indevidos,
esperando decisão — porque a regra nova é *detector propõe, humano executa*, e
ela vale para mim também, principalmente hoje.
