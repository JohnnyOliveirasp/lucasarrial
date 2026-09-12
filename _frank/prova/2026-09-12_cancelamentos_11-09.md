# Cancelamentos de 11/09 — conferência (rodada 12/09)

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-11`
Somente leitura. **Nenhum saldo foi tocado** (regra 9-A: quem age é a varredura,
sobre lista aprovada — nunca o relatório).

Janela UTC `2026-09-11T00:00:00Z -> 2026-09-12T00:00:00Z`.
10 eventos `SUBSCRIPTION_CANCELLATION` -> 10 pessoas.
**5 trial, 3 assinantes, 2 estorno.**

Rascunhos desta rodada (todos somente leitura):
`_frank/rascunhos/estorno_saldo_0911.cjs`, `backlog_estorno_0911.cjs`,
`gasto_pos_estorno_0911.cjs`, `trials_0911.cjs`,
`incidentes_tema_estorno_0911.cjs`.

Contraprova de que as tabelas respondem: `profiles` 2.539 linhas,
`credit_transactions` 25.593 linhas, `incidents` 351 linhas.

---

## 1. O que vem primeiro: a regra "estorno zera o crédito" NÃO EXISTE NO CÓDIGO

Ontem foi o primeiro dia destes relatórios com estorno de verdade (07/09 e
08/09 tiveram zero). Com a regra finalmente exercitada, ela falhou nos dois
casos — e a causa não é um webhook que passou batido, é que **nada no sistema
zera crédito por estorno**.

### Os dois de ontem

| pessoa | assinatura | cobrança | crédito hoje |
|---|---|---|---|
| miguelmoedas.propriedades@gmail.com | `AM2ESZ42` | R$19 **PROTESTED** 10/09 | **77.185** ❌ |
| vazilg@gmail.com | `H6YCVVW8` | R$97 **PROTESTED** 06/09 | **100.000** ❌ |

O webhook **não** falhou em enxergar: os dois entitlements estão
`status=chargeback`, gravados 11/09 17:40Z e 20:29Z. Ele viu, classificou certo
e revogou o acesso (`access_until` = NULO nos dois). Só não mexeu no crédito.

### Por que: `revokeAccess` não fala com crédito

`frontend/src/lib/payments/entitlements.ts:99` — o único caminho que o webhook
usa pra estorno/chargeback (`route.ts:292`, via `mapRevokeStatus`, que mapeia
`PURCHASE_REFUNDED -> refunded` e `PURCHASE_PROTEST`/`*CHARGEBACK* ->
chargeback`). O que ele escreve:

```
patch = { status, raw_event, updated_at }          // + access_until se o caller passar
await admin.from("entitlements").update(patch)
await recomputeProfileAccess(existing.user_id)      // só recalcula access_until
```

Nenhum `debit_credits`, nenhum `credits_subscription`, nenhuma linha em
`credit_transactions`. Varri o código: **o único lugar que zera
`credits_subscription` é `frontend/src/lib/credits/trial-expiry.ts`** — que é
a regra do trial, não a do estorno, e está desligada desde 18/08.

A regra 9 já foi cumprida uma vez, **à mão**: `will.tico@gmail.com` e
`contatoabreu25@gmail.com`, -100.000 cr cada em 18/08 18:29, `ref_type=estorno`,
nota *"Estorno da compra pedido pela aluna e processado (dinheiro devolvido). O
credito acompanha o dinheiro. Decisao do Johnny 18/08/2026."* Foi mão de gente,
não máquina. Depois disso, ninguém mais.

### O tamanho da coisa: 967.233 cr em 7 pessoas

`backlog_estorno_0911.cjs` (paginado de propósito — o PostgREST corta em 1000
em silêncio). 14 entitlements `refunded`/`chargeback`; 4 com `user_id` NULO
(sem conta, nada a medir); dos 10 com conta, **7 estão com mensalidade de pé**:

| desde | status | crédito | pessoa |
|---|---|---|---|
| 19/08 | refunded | 130.619 | alexsander20196@gmail.com |
| 29/08 | refunded | 200.000 | marlon@bianchitour.com |
| 07/09 | refunded | 93.305 | zicasantos08@hotmail.com |
| 10/09 | refunded | 187.189 | draortizestefani@gmail.com |
| 11/09 | refunded | 178.935 | adrianomalafaia.webcert@gmail.com |
| 11/09 | chargeback | 77.185 | miguelmoedas.propriedades@gmail.com |
| 11/09 | chargeback | 100.000 | vazilg@gmail.com |
| | | **967.233** | |

O mais antigo é de **19/08** — no dia seguinte ao mutirão manual. A regra está
sem cumprimento há 24 dias.

### ⚠️ `access_until = NULO` NÃO protege esse crédito

Foi a primeira coisa que pensei ("acesso revogado, então não gastam") e está
**errado**. O portão do app é **saldo**, não acesso:

`frontend/src/app/[locale]/app/voice-cloning/page.tsx:66`
```
const canTrain = team || creditsTotal >= TRAINING_CREDIT_COST;
```

`subscribed = hasActiveAccess(...)` existe na linha 63, mas só escolhe o
**título do paywall** (`titleNoCredits` × o outro). Mesmo desenho nas 5 rotas
pagas — `voices/[id]/generate:159`, `voices/[id]/start-training:112`,
`video-clone:231`, `images/generate:167`, `studio:69` — em todas o
`hasActiveAccess` é chamado **dentro do `if (bal.total < cost)`**, só pra
decidir se o CTA diz "assinar" ou "comprar avulso". **Nenhuma das cinco barra
por `access_until`.** Quem tem saldo gera, pela tela normal, sem gambiarra
de API.

### O que está medido, e o que NÃO está

`gasto_pos_estorno_0911.cjs` cruzou cada um dos 7 com
`credit_transactions.created_at > entitlements.updated_at`:

**Ninguém gastou um crédito depois do estorno.** 0 de 7. Os dois únicos
lançamentos "depois" são os -100.000 manuais de 18/08 acima.

Então é **exposição de 967.233 cr, não prejuízo realizado.** Não vou inflar
isso: a porta está aberta há 24 dias e ninguém entrou.

O que o miguelmoedas custou de verdade, e é separado: ele pagou R$19 em 10/09
14:56Z, recebeu 100.000 cr, e em 11/09 entre 15:40Z e 16:54Z **queimou 22.815
cr de GPU** (treino de voz 10.000 · Vídeo Clone 7.980 + 525 · Animar imagem
1.320 · imagens 525 + 525 · áudios 1.140 + 400 + 400). O chargeback foi
gravado às **17:40Z, depois disso** — ou seja, ele tinha acesso válido na hora
em que gastou. **Não é violação de regra**, é o custo do golpe: R$19
contestados + 22.815 cr de GPU entregues, e 77.185 cr ainda de pé.

### Não existe chamado aberto pra isso

`incidentes_tema_estorno_0911.cjs`: dos 351 incidentes, nenhum é sobre estorno
não zerar `credits_subscription`. Os dois que casam no título são outra coisa
(`beef6f02` convite pra quem cancelou, `ce47c3b9` imagem de referência).

**Não abri chamado nem zerei ninguém** — a 9-A diz que o relatório reporta e
quem age é execução separada, e são 7 pessoas com dinheiro em cima. Decisão do
Johnny: (a) mutirão manual como o de 18/08 sobre esta lista de 7, ou (b)
chamado pro `coder` pra `revokeAccess` passar a zerar `credits_subscription` em
`refunded`/`chargeback`. A (b) sem a (a) deixa os 967.233 parados; a (a) sem a
(b) repete o 18/08 e volta a vazar amanhã.

---

## 2. A máquina do prazo do trial continua parada (não é novidade de 11/09)

`expire_trial_credits`: **DESATIVADA** desde 18/08 — corpo lido por
`pg_get_functiondef`, nunca por chamada à RPC (chamar = executar sobre gente
real). Motivo gravado no próprio corpo: *"a primeira rodada real zerou 14
pessoas"*.

Atinge 4 dos 5 trials de ontem. **Nenhum passou do dia 10 ainda** — então nada
está atrasado hoje; o problema é que quando a data chegar não vai acontecer
nada:

| pessoa | dia 10 do trial | crédito parado |
|---|---|---|
| adv.fernandesdejesus@gmail.com | 15/09 | 92.890 |
| matheuslealdamatta@gmail.com | 17/09 | 88.425 |
| abager@ecoestradas.org | 19/09 | 50.186 |
| fariadelimaadvogados@gmail.com | 20/09 | 97.630 |
| | | **329.131** |

Conferi a **origem** do crédito dos 4 (armadilha da Eliane, 06/09: trial na
Hotmart pode ter pago por fora via Stripe). `trials_0911.cjs`: nos quatro, só
`+100.000 payment_event/subscription_grant — "recarga do ciclo"`. Nenhum
`stripe_session`. São trials puros, ninguém pagou nada.

Marcador `trial_credit_expirations`: **nenhum dos 5 está lá** (a tabela tem 328
linhas: 231 `paid`, 97 `zeroed` — responde).

Continua sendo **processo, não chamado**: o desligamento foi deliberado e está
de acordo com a 9-A. O que falta é lista aprovada + passo de execução separado,
não religar no automático.

---

## 3. As 10 pessoas

### Trials (5)

| e-mail | adesão -> cancelou | tempo | crédito | situação |
|---|---|---|---|---|
| fariadelimaadvogados@gmail.com | 10/09 -> 11/09 | 1 d | 97.630 | no prazo (dia 10 = 20/09), varredura parada — §2 |
| adv.fernandesdejesus@gmail.com | 05/09 -> 11/09 | 6 d | 92.890 | no prazo (15/09), varredura parada — §2 |
| matheuslealdamatta@gmail.com | 07/09 -> 11/09 | 4 d | 88.425 | no prazo (17/09), varredura parada — §2 |
| abager@ecoestradas.org | 09/09 -> 11/09 | 2 d | 50.186 + 1.320 extra | no prazo (19/09), varredura parada — §2 |
| breno.souza@expressouniao.com.br | 04/09 -> 11/09 | 7 d | **sem conta** | §4 — nada em risco |

O `breno.souza` tem `rec#2 R$97 **OVERDUE**`: a Hotmart emite a mensalidade de
quem nunca pagou. **Armadilha 1** — filtrar só por `price.value > 0` faria dele
um "pagante". Não pagou.

O `abager` tem 1.320 em `credits_extra`, que a regra do trial **nunca** toca.
Ver §5 — o lançamento está com etiqueta errada.

### Assinantes (3) — todos MANTIVERAM o crédito, como manda a regra 9

| e-mail | adesão -> cancelou | tempo | pagou | crédito hoje | acesso até |
|---|---|---|---|---|---|
| movidaigreen@hotmail.com | 10/08 -> 11/09 | 32 d | R$97 COMPLETE 17/08 + R$97 APPROVED 10/09 | 281.210 ✅ | 10/10 |
| biel.frnds@gmail.com | 27/08 -> 11/09 | 15 d | R$97 COMPLETE 03/09 | 119.642 ✅ | 27/09 |
| giovannikazuo@gmail.com | 04/09 -> 11/09 | 7 d | R$97 APPROVED 11/09 | 200.000 ✅ | 04/10 |

**Nenhum pagante teve crédito zerado por rotina.** A ferramenta procura
lançamento com `ref_type`/`kind` de
`trial_expirad|estorno|subscription_expired|refund|chargeback` nos 3: **zero
ocorrências**. Nenhum marcado como `zeroed` em `trial_credit_expirations`.

⚠️ Fica de olho no `giovannikazuo@gmail.com`: **foi cobrado R$97 em 11/09 e
cancelou no MESMO dia.** Pela regra ele mantém os 200.000 e o acesso até 04/10,
e está certo. Mas é o perfil de quem volta pedindo reembolso — e se voltar,
cai no §1, que hoje não zera nada.

### Estornos (2)

Os dois do §1. Ambos com crédito intacto, contra a regra.

---

## 4. breno.souza: cancelou na Hotmart e nunca existiu na plataforma

Trial de R$0, 3 assinaturas na Hotmart (`WJ53LVOY` INACTIVE, `ROTD8548`
INACTIVE, `CE5XFX14` CANCELLED_BY_SELLER) — ou seja, **se inscreveu três vezes
e nunca entrou.**

Armadilha #222 aplicada (conta com outro e-mail):
- `profiles` por e-mail exato: 0.
- por domínio `%expressouniao%`: **0**.
- por nome `%breno%`: **1**, e não é ele — `breno.hennesschuck@gmail.com`
  ("Breno Hennes Schuck", criado 26/08, 0 cr, sem acesso). Sobrenome
  diferente, e a regra do #239 é não vincular por semelhança de nome.
- Contraprova de que a busca por nome funciona: `display_name ILIKE %a%`
  devolve gente (5 no limite que pedi).

**Nenhum crédito em risco** (não tem conta pra ter saldo) e **não pagou nada**
(rec#2 OVERDUE), então não é caso de compra órfã do #239, que só dispara pra
pagante. Fica anotado como sinal de produto: três adesões grátis, zero entradas.
Não investiguei por que ele não conseguiu criar conta — está fora do escopo
deste relatório.

---

## 5. Achado lateral: estorno de crédito entrando como "pacote avulso"

No `abager@ecoestradas.org`:

```
2026-09-10T00:01  +1320  ref_type=image_video_refund  kind=extra_purchase
                         note="pacote avulso"
```

1.320 é exatamente o preço do "Animar imagem — Bronze". É o **estorno de uma
geração que falhou**, mas foi gravado com `kind=extra_purchase` e nota *"pacote
avulso"*, e caiu em `credits_extra` em vez de voltar pra `credits_subscription`
de onde saiu. O `ehEstorno()` acerta (o `image_video_refund` está na lista do
`_estornos.cjs`), então o guarda do #113/#185 não fica cego — mas quem ler
`kind`/`note` lê "ele comprou um pacote", que é o oposto do que aconteceu.

Isso é a mesma família do comentário em `credits/service.ts:142` ("o negativo
mora em `credits_extra`") e provavelmente explica o
`zicasantos08@hotmail.com`, que está com **`credits_extra = -11.575`** —
saldo extra negativo, que não deveria existir.

Fora do escopo do relatório de cancelamento. Não apurei o alcance. Fica aqui
pro `coder` como ponta de linha, não como conclusão.

---

## 6. O que NÃO foi feito, de propósito

- Não zerei crédito de ninguém — nem os 2 estornos de ontem, nem os 7 do
  backlog (9-A).
- Não chamei a RPC `expire_trial_credits` (chamar = executar sobre gente real);
  li o corpo por `pg_get_functiondef`.
- Não abri chamado no `incidents` pro §1: são 7 pessoas com dinheiro em cima e
  a decisão (mutirão × correção de código × os dois) é do Johnny. O achado está
  aqui, medido, com os caminhos de arquivo.
- Não vinculei o `breno.souza` a conta nenhuma (#239: vínculo é humano, nunca
  por semelhança de nome).
- Não mexi no lançamento torto do §5 nem no saldo negativo do
  `zicasantos08@hotmail.com`.
