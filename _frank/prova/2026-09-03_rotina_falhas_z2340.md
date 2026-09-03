# Ronda das falhas — 03/09/2026, 23:40Z (20:40 BRT)

Serial: **#222** (`3ca22d47`) — sétima ronda no mesmo serial. Segue sendo o
aberto mais antigo com aluno afetado (01/09 15:54Z).

Item levado até o fim: **Jesus Peres** (`diretoria@grupoperes.com.br`). É o
**4º aluno consertado** do #222 e o **primeiro em que vincular no automático
teria custado 100.000 créditos**. A ronda anterior mandou medir antes de
vincular. Era isso mesmo.

## Fila conferida antes de escolher

`varredura_travados.cjs`: **5 abertos** (igual), **12 em `aguardando_aluno`**
(igual), 2 presos. Nada fura o serial — não há produção fora do ar nem dinheiro
sendo cobrado errado agora.

## Identidade: por CPF, não por nome

O risco aqui era o oposto do da Fernanda. Dois e-mails no **mesmo domínio de
empresa** (`diretoria@` e `iehudaperes@`, `grupoperes.com.br`) podiam ser duas
pessoas do mesmo escritório. Cruzar por nome não resolveria — foi cruzamento por
nome que quase produziu o falso positivo do Marcio e do `allan_air`.

Medido: **CPF 15101360880** aparece em **exatamente 2 entitlements da tabela
inteira**, os dois com `buyer.name` = "Jesus Peres". Não há terceiro candidato.
A prova aqui é **documento**, e por isso é mais forte que as anteriores.

| entitlement | e-mail | transação / assinante | status | janela | ligado? |
|---|---|---|---|---|---|
| `b409341d` | `diretoria@` | HP1627128211 / HFX4DMC9 | canceled | venceu **25/08** | sim |
| `f52801ee` | `iehudaperes@` | HP2152310460 / A1ZH3SEI | **active** | **18/09** | **órfão** |

Criados **13:23:16** e **13:27:27** de 18/08 — **4 minutos** de diferença, mesma
oferta `ewxrfw9j` "Plano Founder", ambas **R$ 0**. É inscrição em duplicidade,
não duas compras.

## 🔴 Por que vincular direto teria dado 100.000 créditos

Este é o achado da ronda, e é o motivo de a ordem anterior ter dito "não vincule
no automático".

Ele **já recebeu** o `subscription_grant` de 100.000 em 18/08, sob `ref_id`
**HP1627128211**. O entitlement órfão carrega **outras chaves**
(HP2152310460 / A1ZH3SEI). O dedupe do `claim.ts:61-71` é

```
kind='subscription_grant' AND ref_id IN (transação, external_id)
```

Chaves diferentes → **não casa** → `grantSubscriptionCredits` dispara os
`PLAN_MONTHLY_CREDITS` **de novo**, por uma inscrição duplicada de R$ 0.

Medido com **controle positivo** (lição da z2259, aplicada de propósito):

| consulta | resultado |
|---|---|
| chaves do órfão (`HP2152310460`,`A1ZH3SEI`) | **0** |
| chave do grant que ele já teve (`HP1627128211`,`HFX4DMC9`) | **1** |
| controle: `subscription_grant` na tabela toda | **1.978** |

O zero é real, não é zero cego.

## O conserto, na ordem certa

**Marcador ANTES do vínculo**, de propósito: se ele logasse entre as duas
escritas, colheria a dobra.

1. `credit_transactions` **marcador anti-dobra** `9976b9e1`: `amount=0`,
   `balance_after=11650`, `kind='subscription_grant'`,
   `ref_type='payment_event'`, `ref_id='HP2152310460'`, `note` explicando que é
   duplicata de HP1627128211. **Não move saldo.** Reversível por um DELETE.
2. **Repliquei a query exata do `claim.ts`** → devolve o marcador → o
   `if (tx) continue` pula o grant. Conferido **rodando a query**, não
   raciocinando sobre ela.
3. `entitlements.user_id` `null` → `347eccc3`, guardado por
   `and user_id is null`, `RETURNING`: **1 linha**.
4. `profiles` recomposto **como o `recomputeProfileAccess` escreve**
   (`entitlements.ts:185-215`): `plan='pro'`, `access_source='hotmart'` (li o
   `provider` do entitlement ativo antes de escrever),
   `access_until='2026-09-18 12:00Z'`. `RETURNING`: **1 linha**. O `sort` do
   código põe `active` na frente de `canceled`, então o entitlement velho de
   25/08 **não encurta** o acesso — está no próprio comentário do arquivo.
5. **Instrumento independente**, não o eco do meu UPDATE:
   `aluno.cjs diretoria@grupoperes.com.br` → *"acesso: ATIVO até 2026-09-18"*,
   *"créditos: 11.650"* — **não** 111.650 —, *"compras: active · canceled"*.

## Regra final de crédito, respeitada

`pagou_de_verdade` **antes** de escrever, como manda o pré-requisito:

- Assinatura FastCloner: **R$ 0** (Founder). A rec#2 de **R$ 97 está OVERDUE** —
  cobrança existe, **nunca foi compensada**. `OVERDUE` não é pagamento.
- Avulsas **pagas**: **R$ 849,45** (Fábrica de Conteúdo Invisível R$ 252,45 +
  Sistema de Geração Pronto R$ 597), 18/08. É **#173**, decisão comercial —
  **não mexi**.

Não é assinante pagante → **sem créditos novos**, usa os **11.650** que tem.
O vínculo entrega o **acesso** que o próprio entitlement diz ser dele e
**se auto-expira em 18/09**. Recusar repetiria a classe do `ja_pagou`: negar
acesso a quem o sistema diz que tem.

## 🔴 A leva errada de 01/09 NÃO estava fechada — e o erro foi de método

A ronda z2259 concluiu: *"2 cartas, 2 correções, leva fechada"*. **Errado.**

A carta do Jesus é a **uid 435**, 01/09 **21:43:38** — 6 segundos depois da 434.
Mesma leva. Ela escapou porque a z2259 procurou pelo **ASSUNTO exato**, e esta
usa assunto **diferente**:

| uid | assunto |
|---|---|
| 433, 434 (Fernanda, Marcio) | "...esta **ativa**, mas em outro e-mail" |
| **435 (Jesus)** | "...esta **paga**, mas **registrada** em outro e-mail" |

A própria z2259 escreveu esse limite nos "limites honestos" — *"carta com outro
assunto afirmando pagamento inexistente não apareceria aqui"* — e ele se
materializou **na ronda seguinte**. Limite anotado e não fechado vira defeito.

**Refiz pelo DEFEITO, não pelo assunto**: busca da instrução `crie uma conta
usando` nas **100 últimas enviadas** (uid **405–504**) → **exatamente 3**:
Fernanda, Marcio, Jesus. São as 433/434/435. **As 3 agora estão corrigidas.**

⚠️ **Não confundir** com as cartas do **Rodolfo** (`rmf174`) e da **Ruti**, que
também mandam criar conta e estão **CERTAS**: essas pessoas **não têm conta
nenhuma**. O defeito é mandar criar **segunda** conta para quem **já tem**.

Conferido que ele não obedeceu: `auth.users` com `iehudaperes@grupoperes.com.br`
→ **0**. Só existe `diretoria@`.

## Carta de correção — uid 505, cópia confirmada na tentativa 1

Corrige as duas afirmações de frente e uma **terceira** que as cartas do Marcio
e da Fernanda não tinham: a promessa de que *"os créditos caem sozinhos"*. No
caso dele **não caem** — já caíram em 18/08 e ele gastou. Avisei que vai
encontrar **11.650 e não 100.000**, para não abrir a tela esperando um número
que não vem. Também: **não houve cobrança em dobro** (as duas são R$ 0) e
**não há nada a devolver**; o acesso **pausa em 18/09** e por quê; e ofereci
ajuda para treinar a voz — ele tem **0 vozes**, que é o sintoma que o
`aluno.cjs` aponta. `--dry-run` conferido antes (destinatário, remetente, corpo
inteiro).

## Regra 7 — fatos consumados postados no grupo

Via `notify-grupo.sh`, conforme a ordem de canal de 31/08. Corpo em **aspas
simples** — a z2259 mediu que aspas duplas fazem o bash comer `R$0` → `/bin/bash`
e `R$97` → `R7`, numa mensagem sobre dinheiro.

## O que isso muda no #222

1. **O Grupo B ganhou um terceiro tratamento.** Não é só "consertável na mão":
   quando o aluno **já foi creditado** sob outra chave, vincular **concede a
   recarga de novo**. `pagou_de_verdade` continua pré-requisito, e agora
   **conferir `subscription_grant` por chave certa também é**.
2. **A leva de 01/09 tem 3 cartas, não 2** — e as 3 estão corrigidas. Nenhum
   aluno criou a segunda conta.
3. **Causa estrutural intacta**: `claim.ts:39 → reconcileUserEntitlements` casa
   só por e-mail exato. Incidente segue **`investigating`**, de propósito.

Nota no #222: **21 → 22**, 1 linha afetada, conferida na releitura.

## Para a próxima ronda (medido hoje, não tratado)

- **Restam 2 órfãos do Grupo B**: `dropweb` (carta errada uid 494 ainda de pé,
  sem 2ª conta criada, janela 02/10) e o que sobrar da lista. **Antes de
  vincular qualquer um: cheque `subscription_grant` pelas DUAS chaves** — o caso
  do Jesus mostra que a dobra é silenciosa.
- 🔴 **`para_frank_a6e3288b`**: *"Vinicius quer o dinheiro de volta (R$ 2.697,60,
  3 compras Hotmart) — janela de 7 dias vence 05-06/09"*. **Faltam 2-3 dias.**
  Não é do meu serial e não tratei. A z2259 já avisou o Johnny; segue de pé e
  **não pode esperar mais duas rondas**.
- **Marcelo** (`marcelopersonalthe32`): acesso vence **05/09**, 198.950 créditos,
  voz `failed` desde 10/08. Não escrevi.
- **Luan** (`luanmarcal.com`): import quebrado há **6 dias** (arquivo do Drive
  não público). Não escrevi.

## Limites honestos desta ronda

1. **Não consertei a causa do #222.** Remediei o 4º aluno e fechei a leva de
   cartas erradas. O bug do `claim.ts` está de pé — sétima ronda.
2. O **marcador `amount=0`** é intervenção minha num ledger financeiro. É
   honesta (a `note` diz o que é), não move saldo e é reversível por um DELETE,
   mas **é um remendo**: o conserto de verdade é o `claim.ts` reconhecer
   inscrição duplicada do mesmo CPF. Deixo registrado para não virar precedente
   silencioso.
3. A contagem "3 cartas com o defeito" cobre **uid 405–504** (100 últimas de
   504 no total). Carta com o mesmo defeito **antes** da uid 405 não apareceria.
   Reduzi o risco trocando assunto por defeito, **não o eliminei**.
4. Não reverifiquei **#226**, **#234**, **#47**, os dois de áudio nem a Katia.
   **Não afirmo nada sobre eles.**
5. Os recados em `para_frank_*` (**9**) e o `patch_92b1cc85` seguem **não
   tratados** — nona ronda seguida.
6. Não abri o app, não ouvi áudio, não vi imagem: banco, envelope, Hotmart e
   código lido.
7. **Não sei** por que ele se inscreveu duas vezes em 4 minutos, nem por que o
   boleto de R$ 97 não foi compensado. A sequência é a mesma do Marcio e da
   Fernanda — olha conta sem acesso, tenta de novo / gera boleto que não paga —
   mas **três casos iguais sugerem, não provam**.
