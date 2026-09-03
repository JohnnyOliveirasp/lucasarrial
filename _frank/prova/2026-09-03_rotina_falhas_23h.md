# Ronda das falhas — 03/09/2026 (dono da fila)

> **Horário real desta ronda: 19:40Z (16:40 BRT).** O rótulo `23h` no nome do
> arquivo é só para ordenar **depois** da ronda que se chamou "22hZ" — que, pelo
> `git log`, foi commitada às **19:00Z**. Os rótulos de hora de hoje estão
> ~3h adiantados em relação ao relógio. Mantive a convenção para não quebrar o
> `ls | tail` de quem vem depois, mas **o rótulo não é horário**; o horário está
> nesta linha. Vale arrumar isso numa ronda calma.

Serial: **#222** (`3ca22d47`, pagante órfão preso fora da própria conta) — o
mesmo da ronda anterior, porque continua sendo o aberto mais antigo com aluno
afetado (01/09 15:54Z). Não mudei de serial por gosto; mudei de item dentro dele.

## Fila conferida antes de escolher

`varredura_travados.cjs`: **5 incidentes abertos**, 9 em `aguardando_aluno`,
3 itens presos. Os 5 abertos são #222, os dois de áudio decapitado/QA reprovado
e o "não conta nada na plataforma".

**Um caso quase furou o serial e não devia:** `marcelopersonalthe32@gmail.com`
aparece na varredura como 🚨 (198.950 créditos, 24 dias sem voz, acesso vence
**05/09** — daqui a 2 dias). Antes de tratar como urgência, li a caixa:
**três cartas já enviadas** (uid 58 em 24/08, uid 182 em 27/08, uid 341 em
29/08), a última confirmando por escuta manual que o áudio dele tem duas
pessoas e avisando do prazo de 05/09. A bola está com ele. Urgência aparente,
não real — e a checagem custou uma consulta.

## O item levado até o fim: `flaviamalavazi@gmail.com`

FLAVIA TELAROLI RAMOS MALAVAZI · entitlement `fe84eb15` · R$97 PIX · recorrência
**#1** · transação `HP1035474703C2` · janela até **20/09 12:00Z** · CPF
mascarado aqui (`042****3778`), valor inteiro só na nota do incidente.

### A checagem que a ronda anterior mandou fazer primeiro

`ler_caixa.cjs --enviados --para flaviamalavazi@gmail.com` → **1 resultado**:
uid 21, de **24/08**, a mala direta genérica. Nenhuma carta de órfão. Ela
qualifica — e agora eu sei disso por medição, não por herdar a instrução.

### O que medi — cada zero com controle positivo

| medição | resultado | controle que prova que a consulta enxerga |
|---|---|---|
| `profiles` com o e-mail da compra | **0** | `flavia.moinhos15@gmail.com` → **1** |
| `auth.users` com o e-mail da compra | **0** | mesmo controle → **1** |
| `onboarding_runs` | **0** (nunca tentou) | — |
| `display_name` MALAVAZI / TELAROLI | **0** / **0** | as 3 "Flavia" que existem são Melissa Correas, Moinhos e Maria Flávia Máximo — **outras pessoas** |
| CPF em entitlement **já ligado** a conta | **0** | **944** dos **990** ligados têm `document` |
| CPF em **todo** o `payment_events` | **3 eventos, 1 só e-mail** — o dela | **4.138** dos **5.470** têm `document` |

### ⚠️ Instrumento cego que eu peguei no meio do caminho — armadilha nova

A consulta do CPF em `payment_events` voltou **0 de 5.470 com documento**. A
ronda anterior tinha medido **3.088**. Um dos dois estava errado, e "0" era
exatamente o número que me faria concluir "o CPF dela não aparece em lugar
nenhum" — a conclusão certa pelo motivo errado.

Causa: em `payment_events` o payload da Hotmart vem **embrulhado em `data`**.

```
payload->'buyer'->>'document'          →   0 de 5.470   (cego)
payload->'data'->'buyer'->>'document'  →  4.138 de 5.470 (certo)
```

Em `entitlements.raw_event` o `buyer` fica no **topo**, sem `data` — por isso a
mesma consulta funciona lá (944/990) e mente aqui. **Os dois formatos convivem
na mesma base.** Controle positivo que fechou a questão: o CPF do Rodolfo, da
ronda anterior, devolve **3** eventos pelo caminho certo.

Anotado no incidente. Quem usar o caminho curto lê "CPF não aparece" para
**todo** aluno e decide em cima de instrumento cego.

### Pagamento conferido na Hotmart viva

```
assinatura rec#1  R$      97 COMPLETE  2026-08-20  HP1035474703C2  FastCloner
venda AVULSA      R$  265.74 COMPLETE  2026-08-20  Fábrica de Conteúdo Invisível
venda AVULSA      R$     497 COMPLETE  2026-08-20  Sistema de Geração Pronto
venda AVULSA      R$      97 COMPLETE  2026-08-20  HP1035474703C1  Gerador de Ganchos
venda AVULSA      R$    1497 COMPLETE  2026-08-21  Comunidade Presença Lucrativa
```

Pagou de verdade (`value > 0` **e** COMPLETE). Cliente grande: **R$2.356,74** em
avulsas além da assinatura.

### Por que a carta não é a padrão

Ela já recebeu a genérica em 24/08 (*"crie sua conta usando EXATAMENTE este
e-mail"*) e não agiu em 10 dias. Repetir o mesmo texto seria ruído — é o erro
que a **regra 11** proíbe.

Como **não existe conta candidata com nenhum e-mail** (o CPF varre 5.470 eventos
e devolve só o endereço dela), aqui *"crie a conta com este e-mail"* é a
orientação **correta**, e não o genérico preguiçoso. A carta nomeia a compra
pelos **produtos irmãos** do checkout, explica que o FastCloner é plataforma à
parte com login próprio, diz que eu conferi e a conta não existe, e dá o passo
a passo.

### O dado da carta saiu do código, relido por mim (não herdado)

`claim.ts:53` — `if (e.access_until && e.access_until <= nowIso) continue;`
Passada a janela de 20/09, o ciclo **não** é concedido sozinho.
`credits/config.ts:7` — `PLAN_MONTHLY_CREDITS = 100_000`.

Por isso a carta pede que ela entre antes de 20/09: não é urgência inventada, é
o que a linha faz. E promete que **eu acerto na mão** se passar, sem prometer
prazo nem mecanismo (**regra 13**).

### Entregue

- `--dry-run` conferido (destinatário, remetente, corpo inteiro na tela).
- Enviada pelo SMTP do `suporte@fastcloner.com` — **uid 496**, tentativa 1,
  **cópia CONFIRMADA** em Enviados.
- Nota no #222: **10 → 11**, 1 linha afetada, conferida na releitura.
- Fato consumado postado **no grupo** (`notify-grupo.sh`), com nome próprio e
  sem e-mail — a ordem de canal manda tudo de FastCloner pro grupo.

## A pista que eu levantei e depois derrubei sozinho

Flavia comprou **exatamente a mesma cesta** do Rodolfo (rmf174) da ronda
anterior, e nos dois a assinatura FastCloner entrou como **código irmão** do
mesmo checkout (`C1`/`C2`). Pareceu padrão: *"comprador de combo não sabe que o
FastCloner é separado"* — e, se valesse pra classe, a correção seria no
pós-compra do combo, não carta a carta.

**Fui medir e não vale.** Dos 6 órfãos vivos, só **dois** têm código irmão:

```
rmf174          HP3698277513C2   ← irmão
flaviamalavazi  HP1035474703C2   ← irmão
rutifortuna8    HP0387096186     ← simples
qooqi.criacoes  HP1375818781     ← simples
fmgimael        HP1087998124     ← simples
malmeida313     HP2524342389     ← simples
```

Cobre 2 casos, não a classe. **Não tratem os 4 restantes como combo.**

Segundo falso positivo, mesmo destino: os 6 dividem a oferta *"Plano para quem
está conosco desde o início"*, o que parece pista até você olhar o denominador —
essa oferta é **1.005 dos 1.080** entitlements, praticamente a única que existe.
Taxa de órfão nela: **6,5%** (65 órfãos / 940 ligados). Informação zero.

**O único recorte fora da curva:** `(sem oferta)` — **27 órfãos / 48 ligados =
36%**, 5,5× a taxa normal. **Não investiguei** o que são esses 75 registros
(formato de evento diferente? provider? base antiga?). Fica como a pista viva da
classe, e é a única das três que sobreviveu à medição.

## Fila restante do #222

Dez dos quinze já têm carta do órfão (480, 481, 483, 488, 491, 492, 493, 494,
495, **496**). Dois saem da fila de carta por serem cobrança em dobro, não falta
de acesso (`caplastica`, `jkakorio`). Restam **quatro**:

`rutifortuna8` 20/09 · `qooqi.criacoes` 21/09 · `fmgimael` 29/09 ·
`malmeida313` 30/09

**Próximo da ordem: `rutifortuna8` (20/09).** No `qooqi.criacoes` a pista da
ronda das 21hZ segue pronta: perguntar se `moyses.filipe@gmail.com` é dele.

## Limites honestos desta ronda

1. A causa estrutural do #222 continua **intacta**: `claim.ts:39 →
   reconcileUserEntitlements` casa só por e-mail exato. Carta a carta é
   remediação, não conserto. Por isso o incidente segue `investigating`.
2. Não vinculei entitlement na mão — sem conta criada, não há em que ligar.
   Depende dela criar ou responder.
3. Não investiguei o recorte `(sem oferta)` que eu mesmo levantei. Fica devendo.
4. Não reverifiquei **#226**, **#234**, **#47**, nem os dois incidentes de áudio
   (decapitado / QA reprovado). Não afirmo nada sobre eles.
5. Os recados em `para_frank_*` e o `patch_92b1cc85` seguem **não tratados** —
   quarta ronda seguida em que sobram.
6. Não abri o app, não ouvi áudio, não vi imagem: tudo aqui é banco, envelope,
   Hotmart e git.

## O que NÃO fiz, de propósito

- Não mandei carta pro Marcelo (3 já foram, a última em 29/08).
- Não escrevi pros 4 restantes de uma vez: é **massa**, precisa do "pode"
  (**regra 8**).
- Não mexi em crédito, acesso, GPU nem migration. Não mergeei PR.
- Não fechei, não reabri e não mudei status de nada.
- Não escrevi CPF por extenso neste arquivo (repo é **público**) — regra de
  LGPD da ronda anterior, seguida.

## Fim de ronda

Um item levado até o fim (aluna avisada, nota gravada, grupo avisado), uma
armadilha de instrumento nova documentada, duas pistas próprias derrubadas por
medição e uma pista viva deixada pra frente. Nenhum código tocado.
