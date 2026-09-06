# Ronda das falhas — 06/09, ~15hZ (12h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** assunto e levei até o fim.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: aviso no **grupo** (ordem de 31/08).

---

## 0. A ronda em uma linha

**A ronda das 13h restituiu acesso a 7 alunos e escreveu que "o crédito deve
entrar sozinho no primeiro acesso". Fui verificar essa promessa, como ela mesma
mandou — e ela estava errada: a própria restituição tinha DESLIGADO o
auto-conserto do crédito. 9 pagantes estavam presos em zero e agora têm os
100.000 que compraram.**

---

## 1. Por que peguei este

A ronda das 13h deixou uma verificação explícita em aberto (item 4 do log dela):
*"quando qualquer um dos 8 logar, conferir se `credit_transactions` ganhou a
linha. Se não ganhar, o defeito é maior do que este card."* Fui conferir. É a
continuação direta do item que já era meu (#282) e envolve dinheiro de aluno
pagante, que vem antes de limpeza de fila.

Fila no início: **20 incidentes abertos**, 13 `aguardando_aluno`, 3 presos.

---

## 2. O que eu encontrei (o achado da ronda)

`claimPurchasesOnLogin` é o único caminho que concede a recarga do ciclo a quem
o webhook não creditou. Ele tem **dois** pontos de entrada, e os dois falham
exatamente para quem a ronda das 13h tentou ajudar:

1. **`app/[locale]/app/layout.tsx:43`** só chama o claim se
   `!profile.plan || plan === "free"`. **A guarda detecta ACESSO faltando, nunca
   CRÉDITO faltando.** Como a restituição gravou `plan='pro'`, ela passou a
   barrar as 8 contas que queria consertar.
2. **`auth/callback/route.ts:50`** chama sem guarda — mas só é atravessado por
   OAuth/magic-link. Os 8 vieram do lote SGP **com senha e e-mail já
   confirmados em 04/09**, então entram por e-mail+senha e nunca caem lá.

Resultado: zero crédito, e permanente — não é "ainda não logou", é "não existe
caminho".

### 2.1 A prova de que isto NÃO é dano da ronda das 13h

Eu poderia estar só descrevendo o estrago da restituição manual. Não é o caso:
**`gestao@qooqi.com.br` está com `plan='pro'` e ZERO crédito desde 21/07 — 47
dias**, sem nenhuma intervenção manual envolvida. Pagante confirmado na Hotmart
viva (rec#3, R$97 COMPLETE, trx `HP1375818781`), comprou no e-mail
`qooqi.criacoes@gmail.com` (classe do #222). **A guarda é defeito antigo em
produção; a restituição manual só ampliou o alcance dele.**

---

## 3. O que eu fiz, com o número conferido

Detector novo — `plan='pro'` + acesso vigente + saldo 0 + **nenhum**
`subscription_grant` — achou **12**. Conferi um a um na Hotmart **viva**
(`pagou_de_verdade.cjs`: valor > 0 **E** COMPLETE/APPROVED): **9 pagantes**.

Concedi **100.000 créditos** a cada um pela **mesma RPC do sistema**
(`grant_subscription_credits`, `kind='subscription_grant'`,
`ref_type='payment_event'`, `ref_id` = **a transação**). A RPC deduplica por
`(user_id, kind, ref_id)` e o `claim.ts:60-70` procura pelas duas chaves
(transação e `external_id`) — então **o caminho automático, se um dia rodar,
enxerga o meu crédito e não concede de novo.** Sem risco de dobra.

| aluno | ref_id (transação) | valor |
|---|---|---|
| max@md2net.com.br | HP0799231253 | 97 BRL |
| cris_evangelista22@hotmail.com | HP3362497348 | 97 BRL |
| rmf174@gmail.com | HP3698277513C2 | 97 BRL |
| flaviamalavazi@gmail.com | HP1035474703C2 | 97 BRL |
| rutifortuna8@gmail.com | HP0387096186 | 118887 PYG |
| malmeida313@yahoo.com | HP2524342389 | 97 BRL |
| atendimento@dropweb.com.br | HP1348994675 | 97 BRL |
| fmgimael@gmail.com | HP1087998124 | 97 BRL |
| gestao@qooqi.com.br | HP1375818781 | 97 BRL |

- **9/9 conferidos no BANCO depois de gravar**: saldo `0 → 100000` e linha em
  `credit_transactions` relida por id. Não acreditei no retorno da RPC.
- **Verificação por instrumento independente:** detector reexecutado, **12 → 3**.

Os **3 que sobraram são exclusão proposital**: `ftfranzolin@gmail.com` e
`cdmarciofernandes@gmail.com` são **trial** (valor 0, rec#1) e não têm crédito a
receber; `jmo.usa.007@gmail.com` está no item 5.

Script em `_Bugs/2026-09-06_restituir_credito_pagante.cjs` (ensaia sem
`--confirmar`).

---

## 4. O que eu NÃO fiz

Não estornei, não debitei, não toquei em acesso/plano, não apliquei migration,
não gastei GPU, não mergeei PR, não reabri incidente e não toquei em nada da
planilha. **Não escrevi para os 9**: são 9 mensagens de uma vez, o que cai na
regra de e-mail em massa (precisa do "pode" do Johnny). Todos já têm acesso e
crédito de pé para quando entrarem — proponho no item 5.

---

## 5. Precisa de DECISÃO do Johnny

1. 🔴 **#284 `b9a0b022` — pagante que pagou 3 ciclos e nunca viu um crédito.**
   `jmo.usa.007@gmail.com` pagou **20 USD × 3** (COMPLETE em 09/06, 09/07 e
   09/08) e tem saldo 0 desde sempre; o único movimento da conta foi o
   onboarding (−10.525 e o perdão +10.525). O automático nunca vai pegar: o
   entitlement está `canceled` e o `claim.ts:45` só olha `active`.
   **Não concedi de propósito** — a REGRA FINAL DE CRÉDITO diz as duas coisas
   aqui ("pagou, tem créditos" × "parou de pagar, não terá créditos novos") e a
   ordem manda perguntar em vez de escolher em silêncio quando é dinheiro de
   aluno. **O ciclo pago vence 09/09: a janela é de 3 dias**, depois a pergunta
   vira estorno.
2. 🟡 **Posso mandar um e-mail curto aos 9** avisando que a conta está pronta?
   Seis deles nunca logaram.
3. 🔴 **#282 continua `investigating` e é correto** — a causa (o lote do SGP não
   reconciliar) segue intocada; hoje foi remediação de quem já estava quebrado,
   não conserto. O conserto é código e precisa de PR.
4. 🔴 **Migration 82** — segue sendo o único passo que destrava o `d3d8d1b2`
   (38 dias).
5. 🔴 **21 PRs abertos e zero commit na main.** #186, #176 e #90 fecham chamado
   aberto agora.
6. **Diego (#254)** — mantida a recomendação: com CPF e titular diferentes, não
   cancelar unilateralmente; se não responder até 08/09, deixar cobrar e tratar
   como reembolso.

---

## 6. Estado dos cards

- **#282 `03e7b34b`** — nota gravada (0 → 1, 1 linha conferida). Segue
  `investigating`: a causa não foi tocada.
- **#283 `cced114f` — ABERTO por mim**: a guarda do claim
  (`layout.tsx:43`) que prende pagante em zero crédito. Separado do #282 de
  propósito — card com duas causas vira card imortal.
- **#284 `b9a0b022` — ABERTO por mim**: o caso `jmo.usa.007`, que é decisão de
  dinheiro e não bug a consertar.

Conserto do #283 **delegado ao `coder`** (card `fdcadd40`): branch
`feat/claim-guarda-credito-faltando` + PR com base `main`, sem merge. A
restrição que passei junto é a que importa: a condição nova **não pode**
disparar o claim a cada page load para quem gastou os créditos legitimamente —
"nunca recebeu" e "recebeu e gastou" são estados diferentes.

---

## 7. Lição que fica (para a próxima ronda não repetir)

**Restituir acesso na mão gravando `plan='pro'` DESLIGA o auto-conserto do
crédito.** Enquanto o #283 não subir, toda restituição manual de acesso tem de
conceder o crédito **junto**, senão cria pagante preso em zero — silenciosamente,
que é o pior jeito.

E a lição de método: a ronda das 13h escreveu "não testei, fica para a próxima"
em vez de afirmar que funcionou. **Foi exatamente essa honestidade que permitiu
achar o defeito hoje.** Se ela tivesse escrito "crédito entra sozinho no
login", ninguém teria conferido e 9 pagantes ficariam em zero por tempo
indeterminado.
