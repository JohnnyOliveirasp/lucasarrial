# Rotina das falhas — 16/09 ~18hZ

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Item levado até o fim:** **#305** (`54c14038`) — dois defeitos reais corrigidos
e **em produção**, com deploy conferido.
**NÃO fechado**, e o §4 diz exatamente por quê. A causa original continua sem
prova, e cravar uma das duas hipóteses seria inventar (regra 14).

Fila: **82 abertos** (era 82 ao abrir; abri o **#428**, então fecha em 83 — não
maquiei o número pra parecer progresso).
Commits de código: **2**, os dois em produção. Cartão novo: **1**.

---

## 0. Como escolhi o item — e por que NÃO trabalhei o mais velho

A cabeça da fila segue parada em palavra alheia, e eu confiri **um a um** em vez
de herdar a tabela da ronda das 17hZ:

| cartão | idade | por que não é bola nossa hoje |
|---|---|---|
| `9ac03612` | 56,8d | decisão do Johnny |
| `d3d8d1b2` | 48,2d | `ignored` por aceite de risco |
| `6c38c99d` | 24,0d | escalado, resposta comercial |
| `#226` / `#234` | 15,0d / 14,1d | chave de GPU, com o Johnny |
| `#249` / `#250` | 12,0d | aval de WhatsApp, com o Johnny |
| **`f1ada07e`** | **11,9d** | ver §1 — **furei a fila por ele e voltei** |
| `#263` / `#270` | 11,2d / 11,1d | com o Johnny |
| **`#305` `54c14038`** | **10,1d** | **nossa, e só nossa → peguei** |

## 1. `f1ada07e` — furei a fila pela exceção da regra 8, e a exceção não se sustentou

O cartão anuncia **dinheiro sendo cobrado errado agora**, que é a única coisa que
autoriza furar a fila. Remedi na Hotmart viva: **4 pagando em dobro** (Johnny é
conta de teste de R$ 1), lista **idêntica** à de 15/09 — nada entrou nem saiu.
O relógio real é o **Carlos Augusto, que renova 22/09 (6 dias)**.

**Não escrevi a 3ª carta pra ele, e isso é medição, não preguiça.** Em vez de
herdar o "bola com o aluno" do título, fui **ler as duas cartas no IMAP** (uid
1036 de 04/09, uid 1297 de 08/09). Procurei um fato novo que uma 3ª carta
levaria. **Não existe nenhum**: as duas já dizem que a `MY5O3KWB` não tem conta
ligada e que ele paga por um acesso onde nunca entrou, que a falha é nossa e por
quê, que cancelar não mexe nos créditos dele, a data 22/09 nomeada, e o caminho
do reembolso com oferta de confirmar a duplicidade por escrito.

> Repetir a mesma carta pela 3ª vez não é diligência, é ruído — e ruído no canal
> do aluno gasta a credibilidade que a 4ª carta vai precisar.

Travado **neste passo, nomeado**: falta a frase escrita do titular, e só ela
destrava (9-C). As duas cartas **prometem a ele** que a casa não cancela sem ele
falar; quebrar isso agora seria desmentir a própria carta. Voltei pra fila.

## 2. #305 — o defeito que eu **medi** antes de tocar em código

Fui conferir o mapa `orphan_alerts` vivo em vez de executar o plano da nota 1.
Dos **19** registros, **3 estão com `canais: []`** — o aviso **não chegou a
ninguém**:

| chave | e-mail | quando | pagante? |
|---|---|---|---|
| `GGMWWE5Q` | scandovieri41@hotmail.com | 03/09 | **SIM — R$ 97 × 2** |
| `5O6U1GCW` | rodrigoaugusto@hotmail.com | 03/09 | não (trial R$ 0) |
| `IVU666FZ` | gabriel.pereira@p-excellence.com.br | 06/09 | não (trial R$ 0) |

E o check de idempotência olhava só a **existência** da chave. Como o registro é
gravado mesmo com `canais: []`, **um aviso que não chegou a ninguém carimbava o
assinante como "já avisado" para sempre** — nenhuma cobrança seguinte reabria o
assunto.

O `GGMWWE5Q` é o caso concreto: **R$ 97 em 26/07 + R$ 97 em 26/08**, as duas
`COMPLETED`, `user_id` **NULL**, assinatura **ativa**, **renovando em 26/09**. O
webhook **nunca mais falaria dele**. Ele só foi atendido porque uma ronda
anterior tropeçou nele **na mão** (Enviados uid 481 e uid 1311, que eu reli).

**PR #314 → merge `4796aba` → deploy SUCCESS 17:55:49Z.** A correção **preserva o
motivo pelo qual o comportamento antigo existia** em vez de revertê-lo: aviso
entregue segue uma-vez-por-entitlement; aviso que não chegou a ninguém dá direito
a **uma** tentativa nova na próxima **cobrança**, freada por transação. Reenvio do
mesmo evento continua mudo. Sem migration.

## 3. O motivo pelo qual este cartão ficou 10 dias sem resposta **também era bug**

O webhook **descartava `aviso.motivo`**. Só `avisou=true` + `canais=[]` virava
linha em `payment_events.error`. Com `avisou=false`, gravava `error` **NULL** —
indistinguível de "tudo certo". O `UKC2COC2` de 06/09 tem `error` NULL por isso.

> **O dado que responderia à pergunta deste cartão nunca foi gravado.** Cinco
> rondas apuraram no escuro por **defeito de instrumento**, não por falta de
> esforço. Foi a parte mais útil da ronda de hoje.

**PR #315 → merge `cbfffeb` → deploy SUCCESS 18:01:44Z.** Só **pagamento** entra,
de propósito: trial de R$ 0 repetido encheria a coluna de ruído e faria o sinal
parar de ser lido — a mesma lição que criou a trava de pagamento em 09/09.

## 4. Por que **não** fechei — e o que eu de fato provei

**ELIMINADO com prova:** "o código não rodou". O `avisoError` só é escrito quando
`avisou=true` e `canais=[]`; como o `error` de 06/09 é NULL e ele entrou no ramo
`!userId`, a chamada **aconteceu** e devolveu **`avisou=false`**. Nenhuma ronda
anterior tinha estabelecido isso. **Medido:** os 4 eventos dele carregam o **mesmo**
`subscriber code` e o mesmo produto — troca de chave e `produto_de_fora` estão fora.

**Hipótese 1** (a da nota 1, que eu quase descartei e voltou de pé): o rec#1 de
30/08 era R$ 0, e a trava de pagamento só entrou em **09/09** — em 30/08 um trial
**passava** e consumia a chave. O R$ 97 de 06/09 cairia em `ja_avisado`.

**⚠️ Contradição que eu NÃO resolvi, registrada em vez de escondida:** se a chave
foi consumida, o evento de **14/09** não deveria ter avisado — mas avisou e
gravou `at=14/09`. Para isso a chave precisa ter sumido entre 07/09 e 14/09, e eu
**não achei o que a removeu**. O mapa não tem registro anterior a 03/09, o que
combina com ele ter sido esvaziado no deploy do #239 (02/09) — só que, se foi
esvaziado em 02/09, então em 06/09 a chave estava ausente e o aviso **deveria**
ter saído. **As duas leituras se mordem.**

**Hipótese 2**, que o encaixe perfeito com `error` NULL não deixa descartar: o
aviso **saiu** em 06/09 por telegram e o registro foi depois **sobrescrito** pelo
de 14/09 (mesma chave). Nesse caso a premissa do título foi medida numa janela em
que a entrada ainda existia — o cartão nasceu **14:13:04**, no mesmo minuto do
evento (**14:13:04.279**).

Entre as duas eu não tenho prova. **Fica `investigating`.** O que muda é que a
**próxima ocorrência se explica sozinha**, com o #315 no ar.

## 5. Cartão novo — **#428** (`e8885d03`)

**Nenhum dos 19 avisos saiu por e-mail.** Todos `["telegram"]` ou `[]`. Se o canal
funcionasse alguma vez, algum registro teria `"email"`. Caminho suspeito, **não
confirmado**: `sendEmail` (`resend.ts:33-35`) devolve `false` **em silêncio** sem
`RESEND_API_KEY`/`RESEND_FROM_EMAIL`. **Não afirmo a causa** — não tenho leitura do
env de produção daqui. Afirmo a medição: **0 de 19**.

Importa porque esse alerta é o que avisa a casa que um **pagante está sem acesso**,
e hoje ele pende de **um canal só**. Não confundir com o **#308** (victor@ morto em
`admin_emails`): lá o aviso saía e **um** destinatário não recebia; aqui não
entregou para **ninguém, nenhuma vez**.

**Irmão, não determinado:** 12 dos 19 avisos não têm recado `para_frank_orfa_*`
(total de recados = 7, bate exato com os 7 que têm). Como `registrarDuravel` roda
**antes** dos canais, todos deveriam ter. Não apurei se foram consumidos ao serem
tratados ou se nunca foram escritos.

## 6. O que eu NÃO fiz

Não escrevi pra aluno nenhum nesta ronda (§1 explica o único caso em que quase
escrevi). Não cancelei assinatura, não estornei, não mexi em crédito, acesso nem
entitlement. **Não editei estado de produção na mão** — os 3 registros com
`canais: []` se resolvem sozinhos na próxima cobrança, já com a regra nova no ar.
Não gastei GPU, não apliquei migration, não mergeei branch stale.

---

### Prova de fim de ronda

- `#314` merge **`4796aba`** · deploy `Deploy Frontend (production)` **SUCCESS 17:55:49Z**
- `#315` merge **`cbfffeb`** · deploy `Deploy Frontend (production)` **SUCCESS 18:01:44Z**
- `aviso-orfao.test.ts` **20/20** · `src/lib/payments` **213/213** · `tsc --noEmit` limpo
- Grupo avisado (regra 7, canal do grupo) com os dois fatos consumados
