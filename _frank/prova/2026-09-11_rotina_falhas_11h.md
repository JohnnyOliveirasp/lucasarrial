# Ronda das falhas — 11/09/2026, ~11h–12hZ

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Canal: ordem de 31/08 — tudo de FastCloner no **grupo**, nunca no privado.

---

## O que saiu daqui

| fato | onde |
|---|---|
| **1 e-mail enviado** a aluno pagante (Marcelo), prazo fechando hoje | uid 1715, cópia confirmada |
| **2 escalações ao grupo** (uma urgente, com prazo de horas) | `notify-grupo.sh` |
| **3 cartões anotados** (`#341`, `#265`, `#312`), 1 linha afetada cada | conferido na releitura |
| **0 incidentes fechados** | nenhum dos três estava resolvido — ver abaixo |
| **0 crédito movido, 0 GPU, 0 migration** | — |

Não fechei nada e digo por quê: os três itens que toquei dependem de decisão do
Johnny ou de ação do aluno. Marcar `fixed` em qualquer um seria mentira (regra 14).

---

## 1. `#341` / `b633b18c` — devolução do SGP · **PARADO NO "PODE" DO JOHNNY**

**Passo em que travou:** autorização de valor. 136.825 cr passa do teto de
100k/dia da regra 9-B. Não é investigação — é alçada.

O que eu acrescentei, medindo em vez de herdar:

- **O número mudou de novo: 136.825, não 147.350 e não 168.400.** `evelyn.cheida@`
  foi perdoada em 10/09 22:21Z, 3h31 **depois** da nota que previu essa decadência.
  Sobram **13** pessoas, não 14 nem 16. Quem executasse pela lista do título
  pagaria em dobro para **3**.
- **A decadência não é gente pagando à mão — é o código.**
  `perdoarNegativoDoOnboarding` (`service.ts:211`), chamado por
  `grantSubscriptionCredits` (`service.ts:185`), zera o negativo **no instante em
  que a pessoa assina**. A Evelyn e a Carlane não foram socorridas: elas
  **assinaram**. Os 13 pendentes são exatamente os que ainda não assinaram.
- **A causa está provada morta, não só mergeada.** Medi o desfecho, não o commit:
  débitos com `note ilike '%onboarding%'` e `amount < 0` depois de `fdcba70`
  (10/09 12:46Z) = **zero linhas em ~27h de produção**. Nenhuma vítima nova.
- **Escopo reconferido, e a conta fecha na unha:** 35 perfis negativos hoje,
  −322.715 no total. Meus 13 = −136.825; a outra classe (sem `sgp_pedido`) =
  −185.890. **136.825 + 185.890 = 322.715**, exato. Não há terceiro grupo
  escondido e eu não alarguei o pagamento pelo saldo negativo.

**Consequência que levei ao Johnny, porque muda a decisão:** ninguém dos 13 está
trancado. Todos com `access_until` NULL, sem acesso vivo, exatamente 2 movimentos
no extrato (os dois débitos) e nenhum crédito positivo jamais. O perdão não
concede crédito gastável — só apaga uma dívida que a decisão dele de 30/08 já
disse que não pode ser cobrada. **Não é urgência, é faxina de carteira.**

---

## 2. `#265` / `71410a81` — Marcelo · 🔴 **O RELÓGIO FECHA HOJE 00:00Z**

Peguei este fora da ordem de idade de propósito: é a exceção da regra 8
(dinheiro, prazo irreversível fechando agora).

**O caso, sem enfeite.** Pagante desde 05/08, **três ciclos pagos**
(05/08, 12/08, 05/09), 298.950 créditos, e **nunca teve uma voz pronta**.
Pediu para sair em **09/09 16:37**, dentro da janela — e a nossa caixa tratou o
pedido como silêncio por um dia (bug do encaminhamento, `#337`, já corrigido).

**Medido agora, não herdado:** `payment_events` = 1 linha paga (HP0618766977,
R$97, APPROVED 05/09 14:17Z). **Zero** evento de reembolso, chargeback ou
protesto. `warranty_date` = **2026-09-12T00:00:00Z**. Nada se moveu em ~22h.

**Confirmei antes de gastar GPU à toa:** retreinar a voz dele seria inútil. A
única voz (`f6f82819`) tem 1 arquivo de 2825s que é uma **entrevista com mais de
uma pessoa** — o treino não separa vozes no mesmo arquivo. Refazer por conta da
casa falharia de novo. Não disparei nada.

**O que fiz, e por que não esperei o "pode".** A alçada do reembolso é do Johnny
e eu não a tomei. Mas existe um caminho que **não depende de nós** — o pedido
direto na Hotmart — e o último dia dele é **hoje**. Segurar o aluno esperando
resposta interna com o relógio correndo repetiria exatamente o erro que já lhe
custou o dia 09/09. Regra 8 de 21/08: e-mail individual, caso que estou tratando,
eu decido sozinho.

E-mail enviado (uid 1715, cópia confirmada na 1ª tentativa): hoje é o último dia;
**conferi e não consta pedido no nome dele**; o pedido de saída está registrado
com a data certa (09/09) e foi levado como urgente; quem autoriza não sou eu e eu
não garanto resposta antes da meia-noite; **peça direto na Hotmart hoje**, que
vale sozinho; se a casa aprovar depois, um anula o outro e ninguém devolve duas
vezes; conta segue com acesso ativo e 298.950 créditos intactos.

**O que falta:** uma palavra do Johnny sobre os R$97. Levado ao grupo, urgente.

---

## 3. Hellen — **falso alarme do instrumento**, anotado no `#312`

O bloco "ACESSO VIVO, COM CRÉDITO E SEM NENHUMA VOZ PRONTA" me entregou
`hellengrasso@gmail.com` como vítima abandonada. **Não é.**

- **Pagou de verdade:** 597 BRL no Sistema de Geração Pronto + 47.94 GBP na
  Fábrica de Conteúdo Invisível, ambos APPROVED 05/09. A assinatura FastCloner
  dela é **trial 0 GBP** — por isso o acesso morre em 12/09. (Armadilha do `#138`:
  acesso vivo ≠ pagante. Cruzei com `pagou_de_verdade.cjs` antes de decidir.)
- **Já foi respondida, e bem**, em 06/09 23:48Z: explicamos que 5 dos 7 arquivos
  não chegaram (culpa nossa), que nada foi cobrado, que a tela de envio foi
  corrigida, e apontamos o portal do SGP como o caminho melhor e já pago.
- **Já agiu:** abriu o pedido do SGP em 10/09 14:23Z (`18e17126`), status `dados`.
  Está no meio do fluxo, **não travada**. O SGP é produto à parte e não depende do
  trial que vence amanhã — o vencimento de 12/09 não fecha porta nenhuma pra ela.

**Não escrevi de novo.** Terceiro e-mail em 5 dias sobre assunto que ela já
entendeu e já está executando é rajada, não cuidado. A régua da casa é 7 dias.

**O defeito do instrumento, que é o achado real:** comprador de SGP no meio do
onboarding é **visualmente idêntico** a pagante abandonado pela casa, porque o
alarme olha `voices` + créditos + `access_until` e **nunca** `sgp_pedidos`. Custa
a ronda inteira de quem for honesto e conferir — e, no sentido contrário, pode
fazer alguém "resgatar" com GPU quem só não terminou de subir o material.
Anotei no `#312` (mesma classe: varredor cego pro SGP) em vez de abrir o 72º
cartão.

---

## O que continua parado

| | idade | passo em que está |
|---|---|---|
| `#265` Marcelo — R$97 | **fecha hoje 00:00Z** | palavra do Johnny |
| `#341` `b633b18c` — 13 pessoas, 136.825 | 23h | palavra do Johnny (teto 9-B) |
| `#309` Victor — prazo **já venceu** | 3d | decisão de vendedor na Hotmart |
| `#313` `2d0509b4` — 15 vitalícios de graça | 3d (19ª ronda pedindo) | ordem de conserto anotada |
| `#331` `3528dd59` — Mastroianni | 2d | reposição de crédito |
| PR **#92** em DRAFT | 15 dias | — |

## Números da ronda

- **71 → 71** em `open`/`investigating` (1 em `open`, o `#351` do vigia);
  13 em `aguardando_aluno`. **Não fechei nada, e o motivo está escrito em cada
  item** — os três dependem de terceiro, não de investigação.
- **1 e-mail enviado**, cópia confirmada na pasta de enviados (uid 1715).
- **0 crédito movido, 0 GPU, 0 migration, 0 e-mail em massa.**
- Caixa lida só com `EXAMINE` + `BODY.PEEK`, busca `SEEN`. **Não toquei em não-lido.**
- 🧹 Higiene, **estável**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais os não rastreados em
  `_frank/rascunhos/`. **Décima ronda seguida.** Não são meus, **não toquei**;
  commitei só este log.
