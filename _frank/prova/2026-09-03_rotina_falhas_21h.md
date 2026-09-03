# Ronda das falhas — 03/09/2026 ~21hZ (dono da fila)

Serial: **#222** (`3ca22d47`, pagante órfão preso fora da própria conta). Tudo
abaixo foi medido nesta ronda. Onde não medi, está escrito que não medi.

## Fila conferida antes de escolher

`varredura_travados.cjs`: **5 incidentes abertos**, 9 em `aguardando_aluno`,
2 itens presos. O mais antigo com aluno afetado continua sendo o **#222**
(01/09 15:54Z) — o serial não mudou por decisão, mudou por medição.

## O que eu fechei que a ronda anterior deixou aberto

As 20hZ registraram como ressalva honesta que **não** conferiram duplicata
**por documento** (o `buyer.document` do Joseph vinha vazio) — "é uma
verificação a menos". Fui medir.

Cruzei os **15** pagantes órfãos contra **todos** os entitlements já ligados a
uma conta, casando por `raw_event->'buyer'->>'document'`: **zero** cruzamentos.

E o zero foi conferido contra instrumento cego, que era o risco óbvio:
**711 dos 988** entitlements *com* conta carregam `document` preenchido (**706**
distintos). O campo do outro lado do join existe e está populado — se houvesse
par, a consulta teria achado.

**Resultado: o caminho do documento não acha a conta de nenhum dos 15.** Somado
ao caminho (b) já medido morto às 13hZ (0 de 26 por CPF/telefone), sobra mesmo
o **(c)**. Quem pegar isto não precisa remedir documento: está medido, e é zero.

## O que ninguém tinha rodado: cruzar os 15 com `profiles` POR NOME

As rondas anteriores conferiram nome **caso a caso**, um aluno por vez. Cruzei
os 15 de uma vez (primeiro nome **E** último nome dentro do `display_name`).
Saíram **quatro** contas candidatas, todas em e-mail diferente do da compra:

| órfã | conta candidata | estado da conta |
|---|---|---|
| `atendimento@dropweb.com.br` | `jose@dropweb.com.br` | **nome IDÊNTICO, mesmo domínio**, conta criada 02/09 (dia da compra), `last_seen` **hoje**. 0 entitlement, access NULL, **0 crédito** |
| `qooqi.criacoes@gmail.com` | `moyses.filipe@gmail.com` | entitlement próprio **CANCELED**, vencido 28/07. Access NULL, 0 crédito |
| `caplastica@hotmail.com` | `gutoassuncao16@gmail.com` | ativa até 22/09, 200.000 cr — **tem acesso** (ver abaixo) |
| `jkakorio@hotmail.com` | `jkakoalves@gmail.com` | já conhecido desde 01/09 — tem acesso |

⚠️ **Isto é PISTA, não prova, e não vinculei nada.** Continua valendo o que as
rondas anteriores decidiram: semelhança de nome não autoriza ligar compra. O
valor da pista é outro — ela muda a **carta** que se escreve, de *"com qual
e-mail você entra?"* para *"a conta X é sua? confirma que eu ligo"*.

## O achado da ronda: 2 pagantes em dobro NOVOS

Rodei o `assinatura_em_dobro.cjs` (lê a **Hotmart viva**: pagou = `value > 0`
**E** COMPLETE/APPROVED). Acusa 5, e **dois nunca apareceram em ronda nenhuma**
— conferi por grep em `_frank/prova` e `_frank/ordens`:

- **Carlos Augusto Ferreira Moreira** = `caplastica@hotmail.com` (a órfã) +
  `gutoassuncao16@gmail.com` (ligada). **R$291 já pagos.** Em **28/08 foi
  cobrado R$97 DUAS vezes**, em transações distintas (`HP4126118814` e
  `HP4258087686`). As duas renovam **22/09**.
- **SOLON ANDRADE** = `lscontabilidade813@gmail.com` + `solonandrade03@gmail.com`,
  duas de R$97 cobradas em 13/08 (`HP3797964181`, `HP3690808585`), renovam
  **06/09** e **13/09**. Este nem órfão é — as duas contas têm dono, então ele
  não aparece em varredura nenhuma de travado, exatamente como o script avisa
  no cabeçalho.

Levados ao grupo nesta ronda. **Não cancelei e não estornei nada**: cancelar
assinatura de aluno é decisão de gente.

## A correção de fila que evita carta errada

O `caplastica` estava na fila desde as 20hZ como "órfão que nunca recebeu nada",
na posição 6, pra receber a carta padrão perguntando com qual e-mail ele entra.

**Seria carta errada.** Ele *tem* acesso, pela conta `guto`. O problema dele não
é falta de acesso, é **cobrança em dobro** — assunto do Johnny, não carta de
órfão. Tirei da fila de carta. Mesmo raciocínio vale pro `jkakorio`, que recebeu
a carta de órfão às 09:23Z (uid 480) tendo acesso pela outra conta.

## O que fiz por gente (2 cartas, cópia CONFIRMADA)

**`isaias.enf@gmail.com`** (Isaias Coutinho) — **uid 493**, tentativa 1. Era o
próximo da ordem: janela **18/09**, R$97, recorrência **#2** desde 18/07, nunca
contatado. Conferido antes: profile com o e-mail dele = **0**; e-mail parecido
com "isaias" = 0; `display_name` parecido = 0; os 2 profiles com "coutinho" são
Jucilen e Igor Eduardo, outras pessoas. `ler_caixa --enviados` = "nada
encontrado", com **controle positivo** em `josephgois` (devolveu o uid 492).

**`atendimento@dropweb.com.br`** (José Carlos) — **uid 494**, tentativa 1. Fora
da ordem por janela (a dele é 02/10, a mais distante) e explico por quê:

Ele já tinha recebido **hoje às 14:00Z** (uid 484) a mensagem genérica mandando
**criar conta** com `atendimento@dropweb.com.br`. Só que ele **já criou** conta,
em 02/09, no `jose@dropweb.com.br`, e esteve na plataforma **hoje** encontrando
0 acesso e 0 crédito.

Ou seja: ele já fez a coisa óbvia, não funcionou, e a nossa única mensagem
mandou fazer de novo. Pela **regra 11**, mandar genérico pra quem já tentou o
óbvio é o que faz aluno explodir — foi o caso da Viviana. A carta nova reconhece
o erro da anterior, diz o que estou vendo, **pede confirmação** de que a conta
`jose@` é dele (e diz com todas as letras que não vou ligar por conta própria) e
manda **não** criar segunda conta nem comprar de novo.

## Funil reproduzido (medição própria, não herdada)

**92** órfãos → **46** `active` → **26** janela vigente → **15** com `price>0`
pelo caminho `raw_event->'purchase'->'price'->>'value'`. **Controle do caminho
errado** (`raw_event->'data'->...`) devolveu **0**. Bate com 17hZ/18hZ/20hZ.

## Fila restante do #222

Dos 15: **oito** já têm carta do órfão (480, 481, 483, 488, 491, 492, 493, 494).
**Dois** saem da fila de carta por serem cobrança em dobro, não falta de acesso
(`caplastica`, `jkakorio`). Restam **seis**, todos com apenas mala direta
genérica, por janela que vence primeiro:

`rmf174` 19/09 · `flaviamalavazi` 20/09 · `rutifortuna8` 20/09 ·
`qooqi.criacoes` 21/09 · `fmgimael` 29/09 · `malmeida313` 30/09

**Próximo da ordem: `rmf174@gmail.com` (19/09).** E no `qooqi.criacoes` já tem
pista pronta: perguntar se a conta `moyses.filipe@gmail.com` é dele.

## Limites honestos desta ronda

1. A pista do `dropweb` é a mais forte que este chamado já teve (nome idêntico +
   mesmo domínio + mesmo dia) — e continua sendo **pista**. Não liguei.
2. Não reverifiquei **#226**, **#234** nem **#47** por medição própria. Não
   afirmo nada sobre eles nesta ronda.
3. Os recados em `para_frank_*` e o `patch_92b1cc85` seguem **não tratados**.
4. Não abri o app, não ouvi áudio, não vi imagem: tudo aqui é banco, envelope e
   git.
5. O achado do `rutifortuna8` (`price.value` 118887 PYG) segue sem investigação
   própria minha — herdei a leitura das 10hZ de que é guarani, não remedi.

## O que NÃO fiz, de propósito

- Não vinculei nenhuma órfã na mão.
- Não cancelei nem estornei assinatura de ninguém (os 2 em dobro são do Johnny).
- Não mandei o texto pros 6 restantes de uma vez: é **massa**, precisa do "pode"
  (regra 8).
- Não mexi em crédito, acesso, GPU nem migration. Não mergeei PR.
- Não fechei, não reabri e não mudei status de nada — o #222 segue
  `investigating`.

## Fim de ronda

Nota gravada no #222 (8 → 9 notas, conferida na releitura, 1 linha afetada).
Nenhum código tocado. Log commitado direto na `main`.
