# 22/08 22h UTC — Rotina das Falhas (dono da fila)

`git checkout main && git pull --ff-only` → estava 2 commits atrás, subiu pra
`91185f5`. Ordem vigente conferida no índice: `2026-08-20_dono_da_fila_e_fila_zerada.md`
(⭐ leia primeiro) + método serial e comunicação de `2026-08-21_passagem_incidentes_para_claude.md`.

Método: backlog serial. Peguei **um** incidente por vez e levei até o fim.
Fechei **1**, abri **2** (um deles já reconciliado e à espera só do fix de código).

---

## 1. `f574d04f` (#87) — Creator Ouro · **FECHADO**

**O que era:** ele escreveu 22/08 02:23 UTC pedindo cancelamento e ficou **~20h
sem resposta nenhuma**. Não era bug de produto: era silêncio.

**Corrigi a leitura da ronda anterior.** O Vigia anotou "pagou (+100.000
`subscription_grant`)" e concluiu que era pedido de **reembolso a ser decidido
pelo Johnny**. É falso — ele **nunca pagou**:

| fonte | o que diz |
|---|---|
| `payment_events` | 1 único evento, `PURCHASE_APPROVED` 21/08 18:55, `price.value=0` **e** `full_price.value=0`, oferta `ewxrfw9j` "Plano Founder", `date_next_charge` = 28/08 |
| `pagou_de_verdade.cjs` | `NUNCA PAGOU \| PURCHASE_APPROVED>0 no nosso banco: 0` |
| Hotmart viva (`cancelar_assinatura.cjs`, ensaio read-only) | `SW686ZXP` · **CANCELLED_BY_CUSTOMER** · `trial: true` |

O `+100.000` é **grant de trial**, não prova de pagamento — mesma armadilha do
caso Manu (21/08). Não havia reembolso a decidir, e nada precisava subir pro
Johnny. E o cancelamento que ele pediu **ele mesmo já tinha feito** na Hotmart;
faltava alguém dizer isso pra ele.

**Feito:** e-mail enviado 22:0x UTC pra `creatorouro@gmail.com` (endereço
resolvido no banco na hora do envio, bcc suporte@, aceite SMTP confirmado):
cancelamento está feito, **nada foi cobrado em momento nenhum**, acesso segue
até 28/08 sem custo, pergunta aberta sobre o que ele esperava e não achou, e
oferta de apagar conta+dados se ele responder "apagar". Zero crédito mexido.

**O que NÃO ficou resolvido:** o buraco de classe. Cancelamento/reembolso ainda
cai no marcador `[ESCALAR:]`, que **não abre chamado** — foi ele que produziu
as 20h de silêncio aqui e a explosão da Viviana antes. Não é deste chamado;
fica registrado aqui e na `resolution_note`.

---

## 2. `69f0aec5` (#89) — geração de imagem presa **pra sempre** · aberto, rows já curadas

Peguei a partir do item 1 do "o que fica pra hoje" da varredura da manhã (uma
`image_generations` parada há 8,8h). O que achei é maior do que estava escrito.

**A causa.** `syncImageTask` (`frontend/src/lib/images/sync.ts`) só é chamado
por duas portas: o poll do `GET /api/v1/images/[id]` — ou seja, **o aluno com a
tela aberta** — e o webhook do Kie. Se o webhook não chega **e** ninguém está
com a tela aberta, a row fica presa **indefinidamente**. Não existe varredura
nenhuma que reconcilie `image_generations` com o Kie. No fluxo de **onboarding**
isso é garantido: a pessoa nem tem acesso ao app pra abrir tela.

**A varredura também era cega.** `varredura_travados.cjs` olhava só `pending` e
**não** `generating` — por isso as duas mais velhas eram invisíveis há semanas.
Mesma lição do `b9c5a0d1`: enumerar estado ruim erra por omissão. Corrigido
neste commit.

**Não era 1 row. Eram 3** — perguntei ao Kie o desfecho real de cada uma
(`recordInfo`, leitura, não gasta GPU):

| row | aluno | presa há | Kie diz | crédito |
|---|---|---|---|---|
| `96b2f27a` | contato@terapiadaarte.com.br | **676h (28 dias)** | `fail` — upstream timeout | -525 debitado, **nunca estornado** |
| `1d9109a3` | karinnarihanna@gmail.com | 150h (6 dias) | `fail` — upstream timeout | `credits_cost=0`, nada debitado |
| `e1f7269f` | robson@soulsolucoes.com.br | 19h | **`success` em 74s** | -525 (onboarding, conta da casa) |

O terceiro é o que dói: **o Kie entregou a imagem em 74 segundos e ela ficou 19
horas parada esperando alguém ir buscar.** Conferi que o arquivo ainda estava
vivo (HTTP 200, 1,9MB) antes de agir — as URLs do Kie expiram.

**Feito nesta ronda** (ferramenta nova `_frank/ferramentas/reconciliar_imagem_kie.cjs`,
ensaio primeiro, depois `--confirmar`):

- `e1f7269f` → **ready**. Baixei 1.956.708 bytes, gravei no R2 em
  `f6b776c0…/images/e1f7269f…/result.png`, confirmei com `HeadObject` **depois**
  de gravar, `.select()` devolveu **1 linha**.
- `96b2f27a` e `1d9109a3` → **failed**, com `kie_raw_error` cru gravado.
  `.select()` devolveu **1 linha** cada.
- Releitura independente pelo `sql.cjs` confirma os 3 estados, e
  `image_generations` em `pending`/`generating` agora é **0**.

**Crédito: não toquei, de propósito.** A ferramenta não estorna. Ver item 4.

**Falta o conserto de código** — por isso o incidente está `investigating`, não
`fixed`. Card **`164e297e`** aberto pro `coder`: rota de manutenção que varre
`pending`/`generating` com `kie_task_id` há mais de 15min e chama o
`syncImageTask` que já existe (sem criar task nova no Kie, try/catch por row,
limite por rodada), branch `feat/reconciliar-imagens-kie` + PR com base `main`.

---

## 3. `7963388e` (#90) — a promessa feita pra kessuly · **aberto, é o próximo da fila**

O Vigia anotou uma objeção no `6f988c2e` e ela procede. O fechamento daquele
chamado responde a pergunta de **crédito** dela e isso confere, mas sobraram
dois defeitos técnicos sem dono — e uma promessa: a Fast respondeu em nome da
equipe *"vou pedir pra equipe técnica dar uma olhada na sua voz clonada... sem
custo"*, e o chamado foi fechado sem ninguém assumir isso. É o padrão exato que
produziu o caso Katia.

1. **Voz embola no meio da fala** (*"non sá onde"* no lugar de *"não sabe para
   onde"*): é o defeito de **referência cortada no meio da palavra**, item 2 da
   ordem de 20/08. Cura manual provada. ⚠️ Automatizar exige **timestamps de
   palavra** — a heurística por energia foi **REPROVADA duas vezes**, não subir.
2. **Face do Video Clone troca ao longo do vídeo**: sem medição nossa nenhuma.
   Primeiro passo é **medir**, não consertar — não dá pra prometer conserto de
   coisa que talvez seja limitação do modelo.

Abri chamado com o nome dela porque "item 2 de uma ordem" não é fila e não
aparece em varredura nenhuma. **Não escrevi pra ela e não curei a voz nesta
ronda** — a regra serial é levar um até o fim antes de pegar o próximo, e eu
estava no `69f0aec5`.

---

## 4. Decisão de crédito que eu tomei, em voz alta (reversível)

**Fernanda / `contato@terapiadaarte.com.br` — os 525 do `96b2f27a`: NÃO estornei.**

O débito é de 25/07 e o estorno automático nunca rodou porque a row nunca
chegou a `failed`. Só que em **18/08 o bolsão inteiro dela foi zerado por
decisão sua** (`-100000 adjustment (trial_cancelado)`, trial cancelado sem
nenhuma mensalidade paga, conferido na Hotmart). Hoje ela está com **0 créditos,
sem acesso e nunca pagou**. Devolver 525 agora criaria saldo pra um trial
cancelado — desfaz em parte a decisão de 18/08, e o crédito seria inutilizável
de qualquer jeito (sem acesso, sem porta).

Então mantive o status quo, que é a opção **reversível**. Se você discordar, é
uma linha de transação e eu faço. Não estou escondendo: está aqui, está na
`resolution_note` do incidente e foi pro grupo.

Os outros dois não têm pergunta: `1d9109a3` nunca foi debitada (`credits_cost=0`)
e `e1f7269f` é avatar de onboarding por conta da casa, e além disso **foi
entregue**.

---

## 5. Higiene do repositório

O Vigia apontou arquivos não commitados de rondas anteriores. Resolvi o que é
registro de ronda e **deixei o resto quieto**:

- `_frank/prova/2026-08-22_varredura_manha.md` — **commitei**. A regra é
  explícita: registro de ronda vai pra `main`, senão a próxima ronda não o
  enxerga (foi o que quase aconteceu comigo hoje).
- `_frank/prova/lgpd/` — **não commitei**. É evidência de remoção de dados de
  aluna (Kelly); não vou empurrar dado pessoal pro git sem alguém decidir o que
  pode ficar versionado. Fica registrado pra quem decidir.
- `_frank/ferramentas/2026-08-21_medir_8379549c.cjs` e `resgatar_voz.cjs`
  modificados — **não são meus, não toquei**.

---

## 6. O que eu NÃO verifiquei (não conte como saudável)

- **GPU e sweep por SSH**: não olhei, mesma limitação das duas rondas
  anteriores de hoje.
- **Se o webhook do Kie chegou e falhou, ou nunca chegou** para as 3 rows. Sei
  o efeito (row presa) e a lacuna estrutural (não há reconciliador), **não** a
  causa da perda do webhook. O card `164e297e` conserta o efeito; a causa segue
  em aberto e está dita assim no incidente.
- **`creatorouro`: não existe evento `SUBSCRIPTION_CANCELLATION` dele** em
  `payment_events` (o tipo existe na tabela, 227 ocorrências pra outros),
  embora o `entitlement` esteja `canceled`. Não apurei quem gravou esse
  `canceled`. **Sem risco de cobrança**: quem não vai cobrar é a Hotmart, que já
  tem a assinatura cancelada na origem. Registro como pergunta aberta, não como
  conclusão.

## 7. Placar

| | |
|---|---|
| Incidentes fechados | 1 (`f574d04f`) |
| Incidentes abertos por mim | 2 (`69f0aec5` investigating, `7963388e` open) |
| Rows destravadas | 3 (1 entregue, 2 marcadas failed com o erro cru) |
| Alunos avisados | 1 (creatorouro) |
| Crédito movimentado | **0** |
| GPU gasta | **0** — só `recordInfo`, que é leitura |
| Migration | nenhuma |
| Cards pro `coder` | 1 (`164e297e`) |
