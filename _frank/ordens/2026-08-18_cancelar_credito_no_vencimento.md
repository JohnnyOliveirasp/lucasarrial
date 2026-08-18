# ORDEM — Crédito morre com a assinatura (18/08)

**Esta ordem corrige a conclusão de `2026-08-18_147_sem_acesso.md`.** Lá eu
tratei os 147 como gente bloqueada de menos. É o contrário: eles estão
**soltos demais**. Leia esta aqui por cima daquela.

---

## 1. A regra (decidida pelo Johnny com o Lucas em 18/08)

> Passou o período, não renovou ou pediu cancelamento → **cancela o acesso E
> zera os créditos.** Ela deixou de pagar; não fica com o que não seguiu
> pagando. Nenhuma parte do sistema é livre.

Está na **regra 9** do `01_REGRAS_DURAS.md`, reescrita hoje. A versão antiga
dizia "crédito é o único portão, não invente bloqueio por assinatura" — era
ela que te fez ler o gate do Roteiro como violação. Aquela redação morreu.

## 2. O que o código faz hoje (e por que é vazamento)

Fui atrás e **não existe nada que zere crédito**. Nem no cancelamento, nem no
fim do ciclo, nem em varredura:

- `lib/credits/service.ts:37` — `getBalance` soma `credits_subscription +
  credits_extra` e devolve. Não olha acesso, não olha validade.
- `lib/payments/entitlements.ts:122` — `recomputeProfileAccess` corrige o
  cache de **acesso** no profile, e **não toca no saldo**.
- `lib/db/types.ts:60` — o comentário diz `// créditos do plano (zeram/
  recarregam no ciclo)`. **Isso não acontece em lugar nenhum.** O comentário
  descreve uma intenção que nunca virou código.

**Consequência:** quem venceu continua gastando. Voz, clone e imagem passam
só com crédito, e o crédito nunca morreu. Cada geração dessas queima GPU que
sai do bolso do Johnny. O `ddfleury@gmail.com` tem 343.468 créditos parados —
quase uma hora de Vídeo Clone, e o acesso dele venceu em 07/08.

⚠️ **Isso está acontecendo agora.** É a parte urgente desta ordem.

## 3. O que construir

Card pro **coder**, na `main` (é fix de dinheiro vazando, não feature — vale
a regra 5).

### 3.1 Fechar a torneira primeiro (é o que para o sangramento)

O débito é o ponto mais estreito e mais seguro: **um lugar só**. Em
`debitCredits` (`lib/credits/service.ts:52`) e/ou na RPC `debit_credits`,
recuse quando o usuário não tem acesso ativo — mesmo com saldo.

- Reaproveite `hasActiveAccess`, que já existe e já trata allowlist/admin.
- A resposta pro aluno tem que dizer a **verdade**: o período acabou, é só
  renovar. Nunca "créditos insuficientes" — ele tem saldo na tela e ia achar
  que é bug.
- ⚠️ **Não quebre a equipe:** `bypassesBilling` (Johnny, Lucas, Edu) e os
  admins continuam passando.
- ⚠️ **Não quebre estorno nem bônus:** `add_extra_credits` é o caminho de
  devolver dinheiro por falha nossa e de campanha. Ele **não** entra nessa
  trava — só o débito.

### 3.2 Zerar de verdade, no evento

Quando o entitlement deixa de estar ativo (cancelamento ou vencimento),
zere o saldo. `recomputeProfileAccess` já é chamado nessa hora e já tem o
`if` que decide ativo/inativo — é ali.

- Registre o zeramento em `credit_transactions` com um `kind` próprio (ex.:
  `subscription_expired`), com quanto foi zerado. **Zerar sem deixar rastro é
  o mesmo que perder o número.** Se alguém renovar e reclamar, você precisa
  saber quanto tinha.
- Zere `credits_subscription` **e** `credits_extra`? **Pergunte antes de
  fazer.** "Avulso" é crédito comprado à parte; pode ter sido pago fora da
  assinatura. Não decida isso sozinho — é dinheiro. Mande a pergunta binária
  e siga com o resto.

### 3.3 O caso que nenhum evento cobre

**Vencer não dispara webhook nenhum.** Ninguém avisa que a semana acabou — o
`access_until` simplesmente fica no passado. Então o zeramento por evento não
alcança quem só venceu.

Isso é **exatamente um detector do vigia noturno**: varrer quem tem acesso
vencido e saldo > 0, e aplicar a regra. Se o vigia já tem espinha, esse
detector entra na Onda 1 — ele agora vale mais que os outros dois, porque é o
único que está custando dinheiro todo dia.

## 4. Os 147 (retroativo) — NÃO faça sozinho

Zerar saldo de 147 pessoas não tem desfazer. Antes de qualquer coisa, me
traga três números:

1. **Quanto crédito** está parado no bolso dos 147, somado.
2. **Quanto já foi gasto** por eles **depois** do `access_until` vencer —
   é o vazamento que já aconteceu, e o número que diz se isso é urgente ou
   histórico.
3. **Como a lista se separa** entre quem **pediu cancelamento** e quem
   **só venceu**. Se o webhook da Hotmart marca o cancelamento, isso deve dar
   pra distinguir. Importa: cartão que falhou e renova amanhã não é a mesma
   coisa que gente que pediu pra sair.

Com os três números o Johnny decide o retroativo. **Você não zera nada até
ele dizer.** A trava do débito (3.1) já para o sangramento sem tocar em
saldo de ninguém — faça ela primeiro e o retroativo deixa de ser urgente.

## 5. E o Roteiro e a Edição?

Ficam **como estão**. Aquelas duas telas exigindo assinatura estavam certas o
tempo todo — na verdade elas eram as **únicas** partes do sistema aplicando a
regra que o Johnny acabou de confirmar. O resto do produto é que estava
frouxo.

## 6. Ordem de execução

1. Os três números do item 4 (é consulta, não muda nada).
2. A trava do débito (3.1) — para o vazamento.
3. O zeramento no evento (3.2), depois da resposta sobre o crédito avulso.
4. O detector no vigia (3.3).
5. Retroativo dos 147, só com o ok do Johnny.

E não esqueça: **a Viviana continua esperando** e o caso dela não é nada
disso.
