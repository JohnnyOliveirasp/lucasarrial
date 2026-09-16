# Rotina das falhas — 16/09 14h

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Fechado:** #424 (`1e133bcd`), as duas pernas em produção.
**Tocado e não fechado, com o passo nomeado:** #99 (`6c38c99d`).

---

## 0. Como escolhi o item

Fila com **86 abertos**, 0 patch do Vigia, 99 recados `tell_frank`.

Os dois mais velhos não são trabalho nosso pendente e confirmei um a um:
**#9ac03612** (56,6d) e **#d3d8d1b2** (48d) estão travados em decisão do Johnny
— o segundo é aceite de risco consciente com todos os alunos já estornados.

> Registro um fato que não sei explicar e por isso **não invento causa**: os
> três cartões mais velhos (`9ac03612`, `d3d8d1b2`, `6c38c99d`) carregam
> `resolution_note` dizendo "FECHADO" / "aguardando_aluno", e os três estão
> `investigating` no banco. Pode ser UPDATE que falhou em silêncio, pode ser
> reabertura por reincidência. **Não medi**, então não afirmo. Fica anotado
> porque três divergências iguais cheiram a classe, não a acaso.

Cabeça real da fila com aluno afetado: **#99**, 23,9 dias.

---

## 1. #99 — o prazo que mandava no cartão morreu, a dívida não

O cartão do Luciano de Pinho (`lucianodepinho@gmail.com`) tinha um relógio: a
nota de 15/09 dizia que a **rec#3 de R$ 97 caía 19/09 12:00Z**.

**Fui conferir na fonte viva, e não na nota.** A razão está escrita na própria
cabeça do `cancelar_assinatura.cjs`: em 15/09, **neste mesmo caso**, o
cancelamento funcionou na Hotmart e o script imprimiu *"registrado no incidente
407"* **sem ter gravado nada** — `--incidente` ia cru pro `.eq("id", ...)` e
`407` é o `numero`, não o `uuid`; o UPDATE pegou 0 linhas em silêncio. Nota que
afirma sucesso logo depois de uma falha silenciosa é exatamente a que eu não
posso acreditar de graça.

`GET /subscriptions` hoje: assinatura **LGKZLCLN** está **CANCELLED_BY_SELLER**.
**A cobrança de sábado não acontece.** O prazo está neutralizado de verdade.

Aluno servido, conferido por uid nos enviados: **uid 2416** (15/09 12:02Z) avisou
o cancelamento e **uid 2494** (16/09 01:52Z) corrigiu o erro de que os créditos
expirariam em 19/09 — e avisou ele do defeito de tela **antes** que ele batesse
nele. Saldo **166.035** intacto e reconciliado com o ledger
(166.980 + (−945) = 166.035 = `balance_after` da última linha). O
`credits_extra` **negativo não é dívida**, é a repartição do saldo. Estorno dos
630 conferido por `ref_type=video_clone_refund`, **nunca por `kind`**.

**Não fechei, e o motivo não é técnico:** o pedido que ele fez em **24/08**
(afirma ter comprado pacote com clone feito *pela equipe*, #95) segue sem
resposta comercial. **23 dias.** Pagante de **R$ 991**, que já pediu pra sair.
Marcar `fixed` seria dizer que respondemos. Não respondemos. **Escalado ao grupo
como urgente**, com a pergunta fechada em sim/não pra poder ser despachada no
celular.

---

## 2. #424 — a última tela que ainda mentia

A casa dizia a quem **tem** saldo que precisava assinar pra *"liberar"* o que já
era dele. O motor sempre esteve certo: o portão é **saldo**, não assinatura
(`voice-cloning/page.tsx`: `canTrain = team || creditsTotal >= COST`). Quem
mentia era a interface — contra a `REGRA_FINAL_CREDITO`, fechada pelo Johnny em
20/08.

**Perna 1 — Créditos:** já estava no ar. Commit `1acf147`, deploy `35048142916`
SUCCESS 02:28:55Z. O cartão nasceu **01:52Z** e o fix subiu **02:28Z**, 36 min
depois; ninguém fechou. O cartão nunca esteve errado, ficou órfão.

**Perna 2 — Minha Conta: achado desta ronda, e não estava em cartão nenhum.**
Fui varrer as outras superfícies da mesma classe antes de fechar, justamente
porque classe fechada que segue disparando é o padrão do `8d370ef5` (escondeu 14
ocorrências). `settings/page.tsx` (API) já estava certa. `account/page.tsx` não:
decidia só por `hasActiveAccess` e **nem carregava** `credits_subscription` /
`credits_extra` no `.select()`. Não era `if` errado — era **informação ausente**.

Corrigido pelo **PR #313**, merge `3349adc`, deploy **`35105753711` SUCCESS**,
conferido **por `headSha`**, não por "o PR mergeou".

### A revisão, que não foi `tsc` verde

O PR veio com `creditsTotal === 0` separando os ramos. **Saldo negativo não é
`=== 0`**, então caía no ramo de baixo e a pessoa leria *"seus créditos
continuam valendo, use até acabar"* **tendo saldo negativo** — a mesma mentira,
virada do avesso, introduzida pelo próprio fix.

Medi antes de reclamar: **12 contas** com total negativo, a pior em **−10.525**
(o onboarding grava débito de propósito, nota `[onboarding: pode ficar
negativo]`). Devolvido ao coder, corrigido pra `creditsTotal <= 0` (`a463b0e`).
`tsc --noEmit` e `eslint` rodados **por mim** na branch, ambos exit 0 — não
herdados do relatório dele.

Autor: `coder` (cards `934e156b` + `7aaf3305`). Revisor: eu (14-B).

---

## 3. O número que eu me impedi de publicar

435 contas sem janela de acesso aberta somam **39.841.190** créditos; **281**
delas têm `access_source='hotmart'` com janela fechada e 28.797.040 créditos.

Era tentador escrever **"281 pagantes"**. Amostrei 3 contra a Hotmart viva:
`ddfleury@gmail.com`, com **343.468 créditos**, voltou **SEM PAGAMENTO
ENCONTRADO**. Logo `access_source` **não é prova de pagamento**, e usar esse
número como "pagantes" repetiria o *"23 de 40"* inflado. A contagem estrita
continua sendo a de 01:52Z: **102 pagantes / 23.598.446 créditos**. O defeito
independe de qual número vale.

Na mesma linha: quase reportei um bug em `ehAtiva()` porque uma assinatura
cancelada voltou `ativa: true`. Era **erro meu** — `ehAtiva` recebe a *string* de
status e eu passei o objeto, que virou `"[object Object]"`. Conferi antes de
abrir a boca; a função está certa.

---

## 4. O que eu NÃO fiz

Não estornei nada (os 3.885 cr do clone de 37s são cortesia comercial, não
correção de defeito — decisão do Johnny). Não cancelei nada. Não escrevi pra
aluno nesta ronda. Não mexi em `access.ts` / `access-window.ts`, em crédito,
plano ou saldo. Não apliquei migration (não há DDL). Não toquei nos 99 recados
`tell_frank` — método é serial, e isso é um item próprio.

---

## 5. Sobra nomeada, e não estou dizendo que acabou

Se o `SELECT` do profile **falhar**, `profile` vem `null` → `creditsTotal = 0` →
a pessoa **com** saldo cai no convite de assinar. É a classe *"erro de leitura
vira ausência de direito"* — a mesma do #222 e a que o #282 fechou no
`entitlements.ts` hoje de manhã.

**Não é regressão do PR #313** (o comportamento em erro é idêntico ao de antes) e
o conserto exige decidir o que a tela diz num estado desconhecido, que é produto.
Achado do coder, confirmado por mim, registrado no #424 pra virar cartão próprio.

**Fila: 86 → 85 abertos.**
