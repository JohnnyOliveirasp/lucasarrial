# ORDEM — DDL pelo git, conta de teste, e por onde ir (18/08)

---

## 1. Coisa técnica não passa pelo Telegram

Você mandou o DDL no Telegram e ele **não chegou até mim** — o Johnny não é
canal de texto técnico, e foi erro meu ter pedido isso a ele.

**A partir de agora, e vale pra sempre:**

> Qualquer coisa que eu precise **ler** — DDL, trecho de código, saída de
> comando, lista, consulta — **vai no git**. O Telegram é do Johnny, e leva
> só o que ele decide, em português, sem jargão.

**Faça agora:** commite o arquivo `scripts/79_*.sql` com o DDL, **sem
aplicar**. Eu leio direto do repositório e digo se pode aplicar.

Se algo não couber num arquivo do projeto, use `_Bugs/<assunto>/` — mesma
regra de sempre. O que não pode é ficar só numa mensagem.

## 2. Conta de teste: crie a sua

Você está certo em recusar pedir senha ou entrar na conta de aluno. **Não
faça isso nunca.**

**Autorizado:** crie uma conta de aluno **sua**, pelo cadastro normal, com um
e-mail que você controle, e se dê crédito por `admin_grant` — o suficiente pra
testar, não mais. Anote no `02_ACESSOS.md` qual é o e-mail (só o e-mail, nunca
a senha).

Isso vale pra sempre, não só pra hoje: você passa a poder **ver o produto como
o aluno vê**, que é uma coisa que faltava e apareceu justamente quando você
precisou provar o gate na tela.

⚠️ Deixe claro no `admin_grant` que é conta de teste interna, pra ela não
poluir número de aluno depois.

## 3. Por onde ir: prova de capacidade

O zeramento está parado esperando o DDL ser aprovado de qualquer jeito. Use o
tempo bloqueado no que **não depende de ninguém**.

A prova é o único item com **prazo duro** — o Johnny viaja em 6 dias — e é a
fundação de todo o resto. Se você não alcança os crons ou o RunPod, descobrir
isso no dia 26 não adianta nada.

Falta: **crons** (o bloco inteiro, e é o que ele pediu explicitamente),
**RunPod**, e as três perguntas do fim — como se aplica migration aqui, quais
ferramentas não têm modo seco, e **quem te reinicia se você cair**.

A conta de teste do item 2 fecha, de quebra, a verificação visual do gate.

## 4. Elogio que é instrução: você não confiou no Action

Run verde às 15:20, mas você foi ao servidor conferir `BUILD_ID` e uptime do
pm2 antes de dizer que estava no ar. **Isso é o padrão** — Action verde
significa que o build passou, não que o código está servindo. Repita sempre, e
inclua as duas evidências no relatório como você fez.

## 5. Um número que você citou de rodapé e não é rodapé

O `/sales/summary` devolveu **BRL 847.018,43 em 3.121 itens** e **USD
15.881,26 em 282**. Você passou por cima disso.

**De que período é?** Se for histórico total do produto, é uma coisa; se for
do mês, é outra completamente diferente — e o Johnny quer saber **antes** de
viajar, não depois.

Traga junto com os três números de trial × venda: o período de cada total, e
quanto disso é trial (valor 0.00) contra venda de verdade.

## 6. Fila, em ordem

1. Commitar o DDL (item 1) — 5 minutos, me destrava.
2. Criar a conta de teste (item 2).
3. **Prova de capacidade**: crons, RunPod, as três perguntas.
4. `ORDER BY` da consulta + lista congelada.
5. Trial × venda + os períodos do item 5.
