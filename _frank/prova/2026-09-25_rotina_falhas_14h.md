# Ronda das falhas — 25/09, ~13:41–14:0xZ (Frank, dono da fila)

**Item serial (regra 8):** o **#400** (`ea54d97d`) — *"A casa manda o aluno
cancelar sozinho na Hotmart, contra a regra 9-C"*, parado **10,7d**, 1 aluna
nomeada. **FECHADO como fixed.**

**O que entreguei:** o conserto já estava em produção desde **15/09** e ninguém
tinha conferido. Conferi o conteúdo na main, o deploy, o **comportamento da Fast
em produção antes × depois**, o desfecho dos 6 cartões que o conserto fez nascer,
e varri a **cauda** que o próprio cartão pedia e que nunca tinha sido varrida.
Fechei com a régua, não com a data.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1286 lidas · 1209 já tinham linha · **0 escrituráveis**. Fecha **1286 = 1286**. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | Veredito: **0 carta depois do corte** fora da tabela. Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho **0d**. Controles ± OK, **557** varridos. |
| `2026-09-24_escolher_o_abandonado.cjs` | **163 abertos** (open 14 · investigating 114 · aguardando_aluno 35) · 151 com aluno nomeado. |
| `2026-09-22_esperando_johnny.cjs` | **19 cartões** parados em decisão dele · **54 alunos** · mais velho **24d**. Inalterado. |

As **77 cartas** anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — continua decisão de produção, não de ronda.

### Por que não peguei o que o instrumento escolheu (de novo)

O `escolher_o_abandonado` apontou o **#380** pela **terceira ronda seguida**
(02h, 13h e agora). O #380 está `aguardando_aluno` com o Ricardo respondido duas
vezes, a última em 13/09: a bola é dele, e a ordem de 21/08 diz em letra que
*esperar resposta de aluno não é estar travado*. Peguei o seguinte com dono real,
o **#400**.

> O limite do instrumento que a ronda das 13h registrou **se confirmou na
> prática**: ele ordena por idade da última nota e não distingue "ninguém olhou"
> de "a bola está com o aluno". Três rondas, mesma indicação, mesmo descarte.
> Quem seguir o ranking sem abrir o cartão reescreve a mesma nota toda ronda.

---

## 2. O item serial: o #400

### 2.1 O que era

`frontend/src/lib/agent/manual.ts`, **PLAYBOOK DE CANCELAMENTO item 2**, mandava
a Fast passar o passo a passo do painel da Hotmart quando o aluno pedia pra
cancelar. Isso contraria a **regra 9-C** (decisão do Johnny de 21/08, cabeçalho
do `cancelar_assinatura.cjs`): cancelamento a pedido do titular é **automático** e
**quem cancela é a casa**.

O dano não era a Hotmart ser difícil — era o pedido **morrer como "atendido"** na
cabeça da Fast e do aluno. Sem virar cartão, a varredura `saida_x_assinatura.cjs`
(conserto do #384, camada de baixo) **não tinha o que cruzar**: ela usa cartão
como entrada.

### 2.2 O conserto, e por que ele estava invisível

Commit **`ff1486d0`** (PR #282, **15/09 02:20:59Z**) — seis horas depois do cartão
nascer. Reescreveu o item 2: a casa cancela (*"pode deixar que eu já peço pro
time cancelar pra você, você não precisa fazer nada"*), titularidade confirmada
obrigatória, `[ESCALAR: ...]`, e o caminho da Hotmart **rebaixado a alternativa**.
Entrou junto o **item 2-B** (o pedido só encerra com cancelamento **confirmado**;
a Fast nunca escreve "já cancelei"), reforçado depois por `e9ff4bb4` (23/09).

**O cartão ficou 10,7 dias aberto com o conserto no ar.** A nota de 14/09 dizia
"segue investigating até o PR entrar" — o PR entrou e ninguém voltou.

⚠️ **E o deploy quase me enganou.** O run do `deploy.yml` para o **próprio
`ff1486d0` saiu `cancelled`**. Lido sozinho, isso diz "não subiu". Não é o caso:
`ab2327212` deployou **SUCCESS 3 segundos depois** (15/09 02:21:05Z) e tem
`ff1486d0` como **ancestral** — o run foi cortado por concorrência, não por falha.
Conferi também o **último deploy SUCCESS de hoje** (25/09 01:51:34Z, `1a8fad41`):
o texto novo está lá, por `git cat-file` no sha **deployado**, não na cópia local.

### 2.3 A prova que importa: o comportamento em produção, antes × depois

Medido em `help_messages` (chat do app), **respostas da Fast** (`from_me=true`),
corte no instante do deploy:

| | ANTES (2.886 respostas) | DEPOIS (499 respostas) |
|---|---|---|
| manda pro painel da Hotmart | 38 — **13,2/1000** | 1 — **2,0/1000** |
| "a casa cancela pra você" | 4 — **1,4/1000** | 11 — **22,0/1000** |

Passo a passo como resposta padrão caiu **6,6×**; a oferta da casa subiu **16×**.

**Li a única ocorrência pós-fix inteira antes de chamar de violação — e não é.**
Ela oferece a casa primeiro (*"eu peço pro time cancelar pra você, você não
precisa fazer nada"*) e só então cita a Hotmart como *"ou, se preferir fazer
sozinha"*. É exatamente a forma que o manual novo prescreve. **Violações
pós-fix: zero.**

### 2.4 O furo central fechado: o pedido vira AÇÃO

Cartões nascidos do escalonamento novo (título *"pediu cancelamento da
assinatura, titular confirmado"*):

| janela | cartões |
|---|---|
| **antes** do fix | **0** |
| **depois** do fix | **6** — #405, #407, #419, #479, #483, #551 |

O primeiro nasceu **87 minutos** depois do deploy. Desfecho conferido em
`entitlements`, um a um: **5 tinham assinatura e as 5 estão `canceled`**
(`B4AJH61E`, `LGKZLCLN`, `OJVGK6ZK`, `56PK4S3B`, `0YL3T7E9`). O 6º (**#479**,
Marlon) **não tinha assinatura nenhuma** — cartão rotulado errado pela Fast,
compra **avulsa** de R$597 do SGP; tratado no próprio #479, que já tem
reconferência **datada pra 30/09**. Não mexi nele.

**A aluna do caso original:** `mary.020220@gmail.com`, `F0XF8RYW` — entitlement
**`canceled`**. E foi **avisada**: carta da casa na pasta Enviados, **uid 2338**,
14/09 20:44:56Z, *"Re: CANCELAMENTO"*, quatro minutos depois do cancelamento
manual. Conferi o destinatário e a data na própria carta, não no rótulo.

### 2.5 A cauda que o cartão pedia e ninguém tinha varrido

O próprio #400 declarava o buraco: *"não medi quantos alunos ao todo receberam o
passo a passo e não cancelaram"*. Varri.

**31 pessoas** receberam o passo a passo no chat antes do fix. Hoje: **24
canceled · 1 chargeback · 2 refunded · 3 sem entitlement · 5 ainda ACTIVE**.

**Abri a conversa dos 5 ativos, um a um, antes de chamar qualquer um de vítima —
e nenhum é pedido de cancelamento frustrado:**

- `claudinhabrasil780` — queria cancelar o **curso** (Fábrica de Conteúdo), não o
  FastCloner; na **mesma conversa** comprou o FastCloner.
- `magno@magnodias`, `pa46486`, `trabalhoiaclone` — **nunca escreveram**
  "cancel"/"cobran"/"assinatur". A Fast citou "Minhas compras" por outro motivo.
- `vivistipp` — em 04/08 disse *"amanhã vou pedir o cancelamento"*: **ameaça
  condicional, nunca pediu**. Segue ativa, login em 13/09.

> **Foi aqui que quase escorreguei.** "Recebeu o passo a passo + segue ACTIVE"
> parecia, sozinho, a lista de quem está sendo cobrado sem querer. Seriam 5
> nomes num relatório. Lendo a conversa, os 5 caem. Presença de palavra-chave
> não é prova de intenção — mesma família do estorno conferido por `kind` em vez
> de `ref_type`.

**Resultado: ZERO aluno que pediu pra cancelar, recebeu o passo a passo e
continua sendo cobrado.**

### 2.6 O que eu NÃO medi, declarado

Esta varredura cobre o **chat do app** (`help_messages`). O canal de **e-mail
não entra**: a pasta Sent só é pesquisável por destinatário e `emails_enviados`
**não guarda corpo**, então não existe busca por frase. **A cauda por e-mail
segue sem medição, e eu não afirmo que seja zero** — afirmo o que está acima.

Registro sem abrir cartão (ordem de 27/08: não é erro de sistema): a
`vivistipp@hotmail.com` está pagando, tem 300.000 créditos, **última geração em
05/08** e reclamou de qualidade de voz em 03–04/08 sem nunca ter sido cartão.
Logou em 13/09. Não escrevi pra ela nesta ronda e não decidi nada — fica aqui
pra quem tratar satisfação de pagante.

---

## 3. O que eu NÃO fiz, de propósito

Não mexi em crédito, acesso, GPU nem migration. Não escrevi para nenhum aluno por
causa deste cartão. Não toquei no #479 (tem dono e data própria). Não mergeei
nenhuma das branches STALE do índice.

---

## 4. Régua que fica desta ronda

> **Cartão fechado por PR que entrou não fecha sozinho — e o run `cancelled` do
> deploy mente pros dois lados.** O #400 passou 10,7 dias aberto com o conserto no
> ar porque a nota dizia "segue até o PR entrar" e ninguém voltou. E quando
> voltei, o run do próprio commit estava `cancelled`: lido sozinho diria "não
> subiu", quando o que houve foi um run vencedor 3 segundos depois com o commit
> como ancestral. **Deploy se confere por ancestralidade + conteúdo do sha
> deployado, nunca pela conclusão do run daquele commit.**

E a segunda:

> **Palavra-chave acha candidato, não acha vítima.** Os 5 "ACTIVE que receberam o
> passo a passo" viravam cinco nomes num relatório de dano. Os 5 caíram na
> leitura da conversa. Antes de nomear alguém como prejudicado, abrir o que ele
> escreveu.

---

## 5. Fim de ronda

- `git log --oneline origin/main..HEAD` → conferido ao fim
- Nenhum código subiu nesta ronda: o conserto já estava em produção desde 15/09.
  **Nenhum fix preso em branch** — nada foi escrito.
- `#400` fechado com `resolution_note` (4.290 chars), `resolved_commit=ff1486d0`,
  `resolved_at` gravado. **1 linha afetada, conferida no `returning`** — não
  confiei no silêncio do update.
- Não gastei GPU, não mexi em crédito, não mandei carta, não toquei em migration.
