> # ⛔ ORDEM PARCIALMENTE SUPERADA — leia este aviso antes
>
> **O critério da trava do débito mudou.** O item **4.3** desta ordem manda
> usar `hasActiveAccess` em `debitCredits`. **Isso está MORTO** — aplicar
> aquilo bloquearia quem **já pagou** e cancelou, exatamente o oposto do que
> o Johnny decidiu.
>
> **Vale em vez disso:** `2026-08-18_regra_final_pagou_fica.md` — o critério
> é **pagamento**, não status de assinatura. Quem nunca pagou e saiu do trial
> não gasta; quem pagou fica com o crédito.
>
> **Continua valendo desta ordem:** o item 1 (congelar a lista, com as três
> exigências), a correção da consulta (`ORDER BY` + desempate), e os três
> números de trial × venda do item 3.

# ORDEM — OK pra executar (18/08, fechamento)

Resposta às suas duas perguntas. **Você tem sinal verde pra abrir o card.**

---

## 1. Congelar a lista: SIM

Você está certo e o argumento é bom: a tabela é viva (12 perfis venceram só
nas últimas 6h), então rodar a consulta na hora de executar zeraria uma lista
diferente da aprovada.

**Faça como você propôs:** grave a lista com carimbo de data, `user_id`,
e-mail, saldo e status da Hotmart no momento. O Johnny aprova **aquela**
lista. O zeramento age só sobre ela e ignora quem entrou depois.

Três coisas obrigatórias nisso:

- **A lista congelada é um artefato, não uma variável.** Grave em tabela ou
  arquivo versionado — não em memória de processo. Se o zeramento rodar em
  duas etapas, a segunda tem que ler exatamente o mesmo conteúdo da primeira.
- **Corrija antes o defeito que você mesmo achou**: os 2 usuários com linha
  dupla e o "último que ler vence" sem `ORDER BY`. Uma lista que alterna
  sozinha não pode virar ordem de zerar dinheiro. `ORDER BY` explícito e
  regra escrita pra qual linha vence quando o usuário tem duas.
- **Guarde o saldo no momento do congelamento.** Se alguém reclamar depois,
  você precisa dizer quanto tinha, não estimar.

Quem entra na lista depois é trabalho do **detector do vigia**, contínuo. O
retroativo é uma foto; a rotina é o filme. Não misture os dois.

## 2. Trial vencido: barra, igual aos cancelados

Decisão do Johnny: **mesmo tratamento dos 99.** Trial que venceu não gera mais
nada, mesma trava, mesma mensagem. Sem caminho especial no código.

Isso simplifica o card: a regra é **uma só** — acesso vencido não gasta —, e
`hasActiveAccess` já a expressa inteira. Nada de ramo separado pra trial.

## 3. Correção de fato que entra no seu relatório

Você estava certo e eu propaguei o erro: **o Founder é de 30 dias**
(`recurrency_period: 30`), o **trial é que é de 7**. Já corrigi a regra 9 do
`01_REGRAS_DURAS.md`. Bom trabalho ter conferido na API em vez de aceitar a
nota — foi você que pegou.

**E isso abre uma pergunta de negócio que o Johnny quer respondida.** Existia
uma anotação dizendo *"39 de 40 compras = 7 dias"*. Se 7 dias é trial e não
plano, aquelas 39 provavelmente eram **trials, não vendas** — e isso muda a
leitura do faturamento dele.

Você já tem as **756 assinaturas** lidas. Separe e me diga:

- Quantas são `trial: true` e quantas são pagas de verdade?
- Das pagas, quantas estão `ACTIVE` **hoje**?
- Quantos trials **converteram** em assinatura paga depois dos 7 dias?

É consulta, não muda nada, e é possivelmente o número mais importante do dia.

## 4. Ordem de execução final

1. **Corrigir a consulta** (`ORDER BY` + regra de desempate).
2. **Congelar a lista** e me mandar: total de pessoas, total de crédito
   `credits_subscription`, e as 5 maiores. O Johnny aprova.
3. **Card do coder: a trava do débito** — `hasActiveAccess` em
   `debitCredits`, sem lista de exceção. Passo 2 da ordem anterior (corrigir
   `access_until` de pagante) **caiu**: não existe pagante sem acesso.
   - Mensagem verdadeira pro aluno: o período acabou, é só renovar. **Nunca**
     "créditos insuficientes" — ele vê saldo na tela e acha que é bug.
   - `bypassesBilling` (Johnny, Lucas, Edu) e admins continuam passando.
   - `add_extra_credits` (estorno, bônus, campanha) **não** entra na trava.
4. **Zeramento** do `credits_subscription` da lista congelada, com registro em
   `credit_transactions` (`kind` próprio, ex.: `subscription_expired`, com o
   valor). `credits_extra` **intocado**.
5. **Detector no vigia** pra quem vencer daqui pra frente.
6. Os três números do item 3, quando der.

## 5. O que continua valendo

- Os **4.158.888** já gastos: ninguém é cobrado retroativo. É justificativa do
  trabalho, não conta a receber.
- **Viviana** segue `investigating` esperando a tela e o print dela.
- **A prova de capacidade dos 12 blocos continua devida** — você respondeu
  solto (servidor ok, banco lê/escreve, git limpo, espinha em `268ae4e`).
  Depois que a trava subir, feche ela. Faltam sobretudo os crons, o RunPod e
  as três perguntas do fim: como se aplica migration aqui, quais ferramentas
  não têm modo seco, e quem te reinicia se você cair.
