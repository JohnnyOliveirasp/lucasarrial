# Ronda das falhas — 06/09, ~13hZ (10h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e levei até o fim.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: aviso no **grupo** (ordem de 31/08).

---

## 0. A ronda em uma linha

**7 alunos que pagaram R$97 e estavam sem acesso nenhum voltaram a ter o que
compraram — e o que destravou não foi autorização nova, foi descobrir que a
objeção escrita no próprio card ("vincular na mão é frágil") já tinha sido
corrigida no código e ninguém tinha reconferido.**

---

## 1. Por que peguei este, e o que descartei

Fila: **32 não-fechados** (19 `investigating`, 13 `aguardando_aluno`).

O mais antigo é o **#15 `d3d8d1b2`** (30/07) e **não o peguei**: segue travado no
passo da **migration 82**, que depende de aval do Johnny. Sem a migration não há
dado novo a produzir — as hipóteses vivas já foram fechadas na ronda de 00:48Z.

Peguei o **#222 `3ca22d47`** (01/09, 5 alunos) por ser o mais antigo com gente
sofrendo. Lendo as 31 notas, achei o que realmente importava: a ronda de 01:54Z
tinha medido **8 pagantes de R$97 sem acesso** e deixado a receita pronta **sem
executar**, com a justificativa honesta de que o achado tinha 40 minutos e mexer
em 8 contas de madrugada em cima de hipótese era o que a regra 14 proíbe. Eu sou
a ronda seguinte. Aluno pagante sem o que pagou vem antes de limpeza de fila.

---

## 2. O que destravou (e é o achado da ronda)

O **próprio card** proibia o conserto: *"vincular o órfão na mão é FRÁGIL —
o próximo evento da Hotmart sobrescreve o `user_id` de volta para NULL"*. Essa
objeção está **refutada, medida hoje**:

A guarda **`ba6a235`** está na main: `frontend/src/lib/payments/vinculo.ts:36-46`
(`donoDoEntitlement`), chamada em `entitlements.ts:71`. A regra é *"o lookup por
e-mail só ADICIONA dono, nunca REMOVE"*. O cabeçalho do próprio `vinculo.ts` diz
que a guarda existe justamente para *"vincular órfã na mão"* deixar de apodrecer.

**O método que o card proibia passou a ser seguro em algum momento e ninguém
reconferiu a proibição.** Foi isso, e não falta de autorização, que segurou o
caso por 8 rondas.

---

## 3. O que eu fiz, com o número de linhas conferido

7 entitlements **ativos e pagos**, órfãos, com `buyer_email` **idêntico** ao
e-mail da conta (não é a classe do #222, onde os e-mails divergem):

| external_id | aluno | janela |
|---|---|---|
| LTY61KB0 | max@md2net.com.br | 13/09 |
| E1239TIK | cris_evangelista22@hotmail.com | 13/09 |
| CL0KLOQ8 | rmf174@gmail.com | 19/09 |
| JJ54Q2L2 | flaviamalavazi@gmail.com | 20/09 |
| WEVYYE64 | rutifortuna8@gmail.com | 20/09 |
| 3847B6V3 | malmeida313@yahoo.com | 30/09 |
| E1BGOQEH | atendimento@dropweb.com.br | 02/10 |

- `UPDATE entitlements` guardado por `user_id is null and status='active' and
  access_until > now()` → **7 linhas** no `returning`.
- `UPDATE profiles` reproduzindo a regra do `recomputeProfileAccess`
  (`entitlements.ts:157-215`, inclusive o critério de `canceled` com data futura)
  → **7 linhas**. Todos saíram de `plan=free` / `access_until` NULL para
  `plan=pro`, `access_source=hotmart`, com a janela da compra.
- Snapshot do estado anterior em `_Bugs/2026-09-06_snapshot_7_orfas.json`
  (reversível).
- **Verificação por instrumento independente:** o detector original de órfã ativa
  paga com perfil existente voltou **vazio**.

### 3.1 Dropweb — conferi a promessa escrita ANTES de tocar

A carta **uid 494** (03/09) promete por escrito: *"eu não vou fazer essa ligação
por conta própria sem você confirmar"*. Fui ler antes de agir. A ligação
prometida era para a conta **`jose@dropweb.com.br`** — e-mail **diferente** do da
compra. Eu vinculei a `E1BGOQEH` à conta **`atendimento@dropweb.com.br`**, que é o
e-mail **idêntico** ao da compra, exatamente o que a carta **uid 484** já tinha
dito que aconteceria sozinho no primeiro acesso. **A conta `jose@` segue
intocada.** A promessa não foi quebrada.

---

## 4. O que eu NÃO provei (e por isso não afirmo)

**Crédito segue 0 nos 8, de propósito.** `grantAccess` **não** concede crédito
(`entitlements.ts:74-90` só faz upsert + recompute); quem concede é o `claim.ts`
no **login** (`claim.ts:41-77` → `grantSubscriptionCredits`), com dedupe por
`ref_id` (transação **e** `external_id`, `claim.ts:61-70` +
`scripts/67_credits_accumulate.sql:71-83`). Logo o crédito **deve** entrar
sozinho no primeiro acesso, sem risco de dobra.

**Não testei com login real e não afirmo que funcionou.** Fica como verificação
da próxima ronda: quando qualquer um dos 8 logar, conferir se
`credit_transactions` ganhou a linha. **Se não ganhar, o defeito é maior do que
este card.**

---

## 5. Duas correções de leitura das rondas anteriores

1. **Eram 8, viraram 7 — e o motivo desmente a leitura intuitiva.**
   `fmgimael@gmail.com` (AQA0PSFE) saiu de órfã sozinho às 06:09Z de hoje. A
   suposição natural seria "ele entrou e o claim funcionou". **Ele tem
   `last_sign_in_at` NULL — nunca logou.** Quem o vinculou foi um evento novo da
   Hotmart caindo no `grantAccess`, que agora acha o perfil (criado em 04/09).
   Isso explica com precisão o padrão **"acesso sim, crédito não"**.

2. **Armadilha de medição, registrada para não repetir:** `WEVYYE64`
   (rutifortuna8) tem `price value` **118887 em PYG** (guarani), não 97. Qualquer
   detector que filtre por `value = 97` em vez de `value > 0` **perde essa aluna
   em silêncio**. O filtro certo é `valor > 0` + status COMPLETE/APPROVED, como
   manda o `pagou_de_verdade`.

Também registro um **erro meu**: a primeira consulta que fiz leu `raw_event ->
'data' -> 'purchase'` e devolveu `valor: null` em todo mundo. O `raw_event` não
tem o wrapper `data`. Se eu tivesse acreditado nesse `null`, teria concluído que
nenhum deles pagou.

---

## 6. Estado dos cards

- **#222 `3ca22d47` — continua `investigating`, e é correto.** O recorte que eu
  restituí **nem era da classe dele** (lá os e-mails divergem; aqui batem). A
  causa do #222 (`claim.ts:39`, casamento só por e-mail) segue **intocada**.
  Fechar agora seria fechar a lista, não a causa. Nota nº 32 gravada (31 → 32,
  1 linha conferida na releitura).
- **#282 `03e7b34b` — ABERTO por mim**, separando a segunda causa: o lote do SGP
  cria a conta e **não reconcilia**. Mesmo movimento que a ronda de 04/09 fez ao
  separar a cobrança em dobro no #254 — card com duas causas vira card imortal.

---

## 7. Precisa de DECISÃO do Johnny

1. 🔴 **#282 — o conserto de verdade não está feito.** Eu restituí 7 pessoas;
   **o próximo lote do SGP repete o defeito**. O conserto é fazer o lote
   reconciliar na criação da conta e parar de engolir a exceção no
   `.catch(()=>{})` do `sgp/processar.ts`. Isso é código, precisa de PR.
2. 🔴 **Migration 82** — segue sendo o único passo que destrava o `d3d8d1b2`
   (38 dias).
3. 🔴 **21 PRs abertos e zero commit na main.** #186, #176 e #90 fecham chamado
   aberto agora.
4. **Diego (#254)** — recomendação da ronda das 12hZ mantida: com CPF e titular
   diferentes, **não** cancelar unilateralmente; se ele não responder até 08/09,
   deixar cobrar e tratar como reembolso. Cancelar errado não tem desfazer.
5. **#222** — vínculo por confirmação, decisão de produto. Sétima ronda parada.

---

## 8. O que eu NÃO fiz

Não concedi crédito, não estornei, não apliquei migration, não gastei GPU, não
mergeei PR, não reabri incidente, não escrevi para aluno nesta ronda e não toquei
em nada da planilha. Leitura da caixa foi `EXAMINE` + `BODY.PEEK` (só os
Enviados do dropweb, para conferir a promessa).

**Por que não escrevi para os 7:** eles receberam o e-mail de definição de senha
em 04/09 e o acesso agora está de pé para quando entrarem. Nenhum deles tem
incidente de bounce. Um empurrão por e-mail é defensável, mas são 7 mensagens e o
ganho real depende de eles definirem a senha — vou avaliar na próxima ronda, com
o dado de quem logou, em vez de disparar 7 e-mails sem saber se ajudam.
