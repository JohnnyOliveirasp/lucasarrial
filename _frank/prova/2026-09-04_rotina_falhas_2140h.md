# Ronda das falhas — 04/09/2026 ~21:41–21:55Z (Frank, dono da fila)

Fila no início: **11 abertos** (`open`/`investigating`). A ronda anterior fechou
às ~21:05Z e deixou uma lista numerada de "próxima ronda começa por aqui".
Comecei pelo **item 1** dela, que era o mais caro e o mais antigo em silêncio.

## Item da ronda: `#254` — perguntar a quem ninguém tinha perguntado

A ronda das 21h mediu 21 pessoas com assinatura dupla e deixou explícito o que
faltava: **lucila blanco** e **Carlos Augusto** pagam **R$ 291 em dobro cada** e
**nunca foram perguntados**. Pela **regra 9-C** eu não posso cancelar sem pedido
do titular — então a ação correta não era esperar, era **perguntar**. Pela
**regra 8**, e-mail individual sobre caso que estou tratando eu decido sozinho.

### O que eu confirmei na fonte viva antes de escrever

Não escrevi para aluno em cima do que o card dizia. Reconferi tudo:

| aluno | assinaturas | pago | conta |
|---|---|---|---|
| lucila blanco | `2Q4Y1CDE` (blancolucila539) + `6JEANY3Z` (contatoecocannabis) | R$ 97 em 30/07 e 23/08 + R$ 97 em 03/09 = **R$ 291** | as duas têm conta |
| Carlos Augusto | `UMJP7PDY` (gutoassuncao16) + `MY5O3KWB` (caplastica) | R$ 97 em 28/08 + **R$ 194** (13/08 e 28/08) = **R$ 291** | `MY5O3KWB` tem `user_id` **NULL** |
| Diego Send Zap | `MYEXXEMA` (sendzapoficial) + `4UKYMN4L` (admin@ag12x) | **R$ 0** — os dois trials vencem **08/09** | `4UKYMN4L` órfã |

**O caso do Carlos é pior do que o card dizia.** Os **R$ 194** — o lado em que
ele pagou **mais** — saíram na assinatura cuja `entitlement` tem `user_id` NULL:
ele pagou por um acesso em que **nunca conseguiu entrar**. As duas compras são
de 22/07, às **14:47** e às **15:10**. Vinte e três minutos. É o `#222` no
relógio: comprou, não liberou, comprou de novo com o outro e-mail.

**"Nunca foi contatado" eu medi, não deduzi.** Busquei a pasta `Sent` por cada
um dos 6 endereços (`ler_caixa.cjs`, que abre com EXAMINE e lê com PEEK — não
marca lida, não atropela a Fast). lucila: **1** e-mail na vida, uid 407, sobre o
botão de gravar. Carlos: **zero**. Diego: **zero**.

### A conferência que evitou eu dar conselho errado

Antes de sugerir "cancele a órfã", conferi **de onde vem o crédito** — se a
recarga viesse da órfã, minha sugestão cortaria o crédito do aluno. O grant de
**28/08 14:57** na conta `38bf5777` casa com o `updated_at` do entitlement
**`UMJP7PDY` (28/08 14:57)**, não com o da `MY5O3KWB` (28/08 **14:59**). Só
depois disso escrevi ao Carlos, com prova, que cancelar a órfã **não mexe nos
créditos dele**. Mesma verificação para o Diego.

## O que EXECUTEI — 3 alunos, 6 e-mails, cópia confirmada em Enviados

Ensaio `--dry-run` rodado antes. Mandei para **os dois endereços de cada um**, de
propósito: quem só lê o e-mail da compra não veria, e o custo de não ver é mais
R$ 97.

| aluno | uids em Enviados |
|---|---|
| lucila | **1033** (contatoecocannabis) · **1034** (blancolucila539) |
| Carlos Augusto | **1035** (gutoassuncao16) · **1036** (caplastica) |
| Diego Send Zap | **1037** (sendzapoficial) · **1038** (admin@ag12x) |

**O Diego é o caso preventivo**, e é a lição que o Neto custou hoje: os dois
trials dele viram **R$ 194** em **08/09**, e até agora **não saiu cobrança
nenhuma**. Resolver esta semana custa zero; resolver depois vira estorno que eu
não controlo. Ele é usuário ativo — 4 vozes prontas, 44.713 créditos.

## O que eu NÃO prometi, de propósito

**Nenhum reembolso, nenhum prazo, nenhum valor.** Escrevi que devolução de cartão
passa pela Hotmart, que estou levantando internamente e que **a decisão não é
minha**. Ofereci a única coisa que eu controlo e cumpro: **confirmar por escrito
à Hotmart que a duplicidade foi defeito nosso**, se pedirem.

⚠️ Isso é diferente do que foi prometido ao Jackson em 01/09 e 04/09 ("estou
encaminhando internamente para acertarem isso com você, e retorno assim que tiver
a definição"). Essa promessa **está viva e sem dono** — ver abaixo.

## Achados que eu não fui buscar, mas não vou deixar passar

1. **lucila tem 200.000 créditos em CADA conta e ZERO voz nas duas.** Pagou
   R$ 291 e **não produziu nada**. Ela escreveu em 01/09 sobre o botão de gravar
   e a instrução que demos estava errada. Perguntei no mesmo e-mail se ainda está
   travada e me ofereci para ajudar passo a passo.
2. **O `#247` (Jackson) re-disparou às 21:20Z** — não era reabertura de defeito:
   era a **Fast respondendo** (uid 1031). Jackson propôs converter o reembolso em
   créditos; a Fast respondeu que "a equipe" decide. Somando com o uid 432 e o
   657, **prometemos três vezes uma definição de reembolso que ninguém tem
   mandato para dar** (a 9-C diz que reembolso é entre aluno e Hotmart). Isso é
   decisão do Johnny, não minha: **levei ao grupo**, não fechei sozinho.

## Cards mexidos

- **`#254`** → segue **investigating**, com nota nova (6 notas, 1 linha afetada,
  conferido na releitura). Não fechei: Solon, os estornos e 4 pares preventivos
  continuam abertos.

## O que ficou aberto, sem maquiagem

- **Solon**: escrito às 20hZ, sem resposta. Não é estar travado.
- **4 pares de trial preventíveis que eu NÃO escrevi**: helton bertoldi 14/09,
  ELVIS LANDI 16 e 20/09, ALTAIR 18/09, **KELINN 27/09** — esta com as **duas no
  MESMO e-mail** (`kelinnavelar@icloud.com`, mesmo dono `1c9ff2cf`), que nem é
  caso de e-mail trocado. Três individuais eu decido sozinho; **quatro de uma vez
  já é rajada**, e rajada precisa do "pode" (regra 8). Pedi no grupo.
- **PR #179** (`feat/cancelar-assinatura-orfa`, `6274f5d`) continua **fora da
  main**. Só a main deploya.
- **Trabalho de terceiro solto na árvore** (SGP: `painel.ts`, `cobranca.ts`,
  `106_sgp_cobrancas.sql`, `qa-users.mjs`, `medir_palavra_decepada.cjs`): 3ª
  ronda seguida aparecendo. **Não commitei** — não é meu.

## Nota de ferramenta (não é do produto)

A **ferramenta Bash da minha sessão estava quebrada** a ronda inteira: `pwd` e
até `/bin/echo alive || /usr/bin/true` voltavam exit 1 sem saída — ou seja, o
shell não executava. O `Write` falhava com `EDQUOT` com 3,1 GB livres em `/tmp`.
Rodei a ronda inteira por um terminal alternativo (MCP). **Nada foi pulado por
causa disso**, mas registro porque uma ronda futura pode morrer calada nisso.

## Próxima ronda começa por aqui

1. **Resposta de lucila / Carlos / Diego** → cancelar o que cada um pedir (9-C
   autoriza, não precisa esperar ninguém). Diego tem prazo: **08/09**.
2. **O "pode" do Johnny** para os 4 pares preventivos restantes.
3. **Decisão do Johnny sobre reembolso** — 3 promessas vivas ao Jackson.
4. **Mergear o PR #179**.
