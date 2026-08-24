# 23/08 — Relatório noturno (consolidado do dia)

Fechado 24/08 **01:05 UTC** (22:05 BRT de 23/08). Este arquivo é a prova
técnica; o Telegram levou o resumo e o caminho daqui.

---

## 1. Produção — o que está NO AR agora (verificado, não deduzido)

### 1.1 Site (Hetzner)

| | |
|---|---|
| Commit no ar | **`9633444`** (PR #38) |
| BUILD_ID no servidor | `cZaMzmdZ5eNfJMiXexvd_` |
| Build feito em | 2026-08-23 **22:49:07 UTC** (Action iniciou 22:47) |
| pm2 `aiverse` | **online**, uptime 132 min na hora da medição, 379 restarts acumulados |
| `main` × `origin/main` | **0 ↔ 0** — em sincronia, nada preso local |

**Prova de deploy por md5, não por Action verde.** O servidor não é checkout
git (`git rev-parse` lá devolve `not a git repository`), então "o commit está no
ar" tem que ser medido no arquivo:

| arquivo | local (`9633444`) | servidor | bate? |
|---|---|---|---|
| `src/lib/audio/wav-to-mp3.ts` | `9e4e57cf2c1174436582b6a184db0488` | `9e4e57cf2c1174436582b6a184db0488` | ✅ |
| `src/lib/audio/transcode.ts` | `9450d7feccf4f68478433f40b242b3c5` | `9450d7feccf4f68478433f40b242b3c5` | ✅ |

Esses são exatamente os dois arquivos que o PR #38 alterou. **Está no ar.**

### 1.2 Worker de GPU (RunPod) — deploy SEPARADO, e é onde mora o PR #16

O PR #16 (corte da referência no meio da palavra) **não passa pelo deploy do
site**: ele é `runpod-worker/`, que vira imagem Docker e é apontado no template
do RunPod. Confundir os dois é como dar por entregue algo que nunca saiu.

| | |
|---|---|
| Action `Build RunPod Worker` | `600ddb1` — **build: success · deploy-runpod: success** (23/08 21:51 UTC) |
| Template `itkncnhn7y` (VOX B) | `ghcr.io/johnnyoliveirasp/lucasarrial-runpod:`**`600ddb1`** ✅ lido pela API |
| Template `03vs3iiph6` (principal) | **não consigo ler de volta** — esse template não aparece no `podTemplates` nem no REST (limitação conhecida, comentada no próprio workflow) |

**Honestidade sobre o template principal:** eu não li a imagem dele com meus
olhos. O que eu tenho é que o passo de deploy **falha o job de propósito** se o
`saveTemplate` não voltar com a imagem nova (`grep -q imageName || exit 1`), e o
job passou. É prova indireta forte, **não é o md5**. O VOX B, que recebe a mesma
imagem no mesmo passo, confirma `600ddb1` diretamente.

### 1.3 O que NÃO foi pra produção nenhuma (e está certo assim)

- **PR #40 (`43500d9`)** mexe só em `_frank/ferramentas/ler_caixa.cjs` —
  ferramenta minha, roda da minha máquina. Não é código do site. Nada a
  deployar.
- Commits `4df4c29`, `fc25a97`, `89b7254`, `9dd883f` (19:55→20:20 BRT) são
  ferramenta e prova, posteriores ao build das 22:49 UTC. **Não exigem
  rebuild** — nenhum toca `frontend/src`.

---

## 2. O que eu resolvi hoje

**5 incidentes fechados** (3 `fixed`, 2 `ignored`). Em ordem de peso:

### 2.1 O MP3 que cortava o final do áudio do aluno — CORRIGIDO E NO AR

Incidente fechado 23/08 22:54 UTC · commit `9633444` (PR #38).

`ffmpegWavToMp3` escrevia em `pipe:1`, que não é seekável. O libmp3lame só grava
o header Xing (obrigatório em VBR) se puder voltar ao início do arquivo — sem
ele, o player estima a duração pelo primeiro frame assumindo CBR e **erra pra
menos**. O arquivo no R2 sempre esteve inteiro; quem mentia era a duração
anunciada. Quanto mais longo o texto, mais o aluno perdia — **pior caso medido:
17,1s de 112,7s**.

**O que isso NÃO resolveu, e é por isso que tem incidente aberto:** o fix vale só
pra geração **nova**. As **2.625 entregas antigas** continuam anunciando duração
errada. Escrevi a ferramenta de cura (`curar_mp3_xing.cjs`, commit `89b7254`) —
remux `-c copy`, sem reencode, sem GPU, sem crédito, com backup no R2 antes e
verificação depois — **mas não rodei**. É pergunta pro Johnny (§3).

### 2.2 Referência cortada no meio da palavra — CORRIGIDO NO WORKER

PR #16 (`600ddb1`), deployado no RunPod às 21:51 UTC. Causa raiz do áudio
"embolado" da Kessuly: a referência era cortada em 30,000s no meio de uma
palavra. Agora o corte procura a fronteira de palavra.

**Mesmo caveat:** não cura voz **já treinada**. Incidente aberto pedindo
backfill.

### 2.3 Aluna sem resposta há 38h — RESPONDIDA

Fechado 24/08 00:51 UTC. Ela mandou o material por e-mail, duas mensagens, e
ninguém respondeu por 38h. Respondida por SMTP do `suporte@`.

### 2.4 Daniel — a premissa do chamado estava errada

Fechado 23/08 11:46 UTC. O chamado dizia "diz ser pagante e o banco não tem
compra nenhuma". **Ele é pagante** — a compra está na Hotmart. O erro era nosso,
não dele. Reclassificado.

### 2.5 "38 contas free gastaram 330.400 sem crédito" — NÃO É BUG

Fechado como `ignored` 23/08 19:43 UTC. Comportamento autorizado pelo Johnny.
Eu tinha aberto esse incidente às 18h achando que era vazamento de dinheiro.
**Era eu que não sabia da regra.** Registro aqui porque abrir incidente errado
custa atenção de quem lê o board.

### 2.6 Bônus fora de incidente: a varredura diária estava mentindo o número

Achei enquanto levantava os dados **deste** relatório. `varredura_travados.cjs`
tinha `.limit(15)` na consulta de incidentes **e imprimia `inc.length` como se
fosse o total** — ou seja, ela dizia "INCIDENTES ABERTOS: 15" com **20** no
banco. Cinco abertos invisíveis, todo dia, no exato instrumento que eu uso pra
dizer se o dia foi limpo.

Pior: o `error` da consulta era descartado. Consulta que erra volta `data: null`
→ o `if` não entra → o script fecha com **"✅ Nada preso, nada aberto"**. É o
acidente de 18/08 esperando pra repetir.

Corrigido: `count: "exact"` separado da lista, limite de 50, "mostrando N"
quando corta, e erro na cara com aviso explícito de **não** tratar a rodada como
limpa. Verificado depois do fix: imprime **20**.

Arquivo: `_frank/ferramentas/varredura_travados.cjs`.

---

## 3. O que precisa do Johnny — 3 perguntas binárias

1. **Rodo o backfill dos 2.625 MP3 já entregues?**
   Conserta o áudio que os alunos já baixaram e que corta no final. Remux bit a
   bit, sem reencode, sem GPU, **sem crédito**, backup antes e verificação
   depois. Não toca no banco. É mexer em arquivo de 2.625 alunos de uma vez —
   por isso pergunto em vez de fazer.

2. **Aviso os 4 pagantes que estão com crédito e sem voz nenhuma há 14–29 dias?**
   Não estão trancados (têm acesso e crédito), mas nunca conseguiram uma voz.
   Dois falharam por "áudio curto demais", dois por falha de treino nossa. É
   e-mail individual — eu decido sozinho pela regra — **mas dois deles envolvem
   oferecer refazer por conta da casa**, e isso é promessa que custa. Por isso
   pergunto.

3. **Mudo o texto do Vídeo Clone que promete treinar com vídeo?**
   Ele não treina com vídeo. O Luciano ia gravar **45 min** em cima dessa
   promessa. Mudar a tela é código e eu faço; o que precisa de você é a decisão
   de assumir pro aluno que a página prometia o que o produto não faz.

---

## 4. Estado geral

### 4.1 Incidentes abertos: 20 (13 `open` + 7 `investigating`)

| idade | quantos |
|---|---|
| ≤ 24h | 16 |
| 1–3 dias | 3 |
| > 3 dias | 1 |

**Mais antigo: 30/07, `d3d8d1b2` — "Geração de áudio: tempo de execução
estourado", `investigating` há 587h (≈ 24 dias)**, com `last_seen_at` parado em
18/08. Ou está sendo investigado ou tem que fechar; há 24 dias não é nenhum dos
dois. Não mexi nele hoje.

**O 20 é inflado e eu sei em quanto.** Seis dos abertos são **a mesma rajada do
Martin**, quebrada em 6 linhas idênticas criadas em 140ms pela burst-rule
(signature não-única). Descontando, são **~14 reais**. O bug que fabrica
incidente já tem incidente próprio aberto.

### 4.2 Filas: nada preso

As 6 tabelas da varredura (`voices`, `video_clones`, `react_jobs`,
`image_generations`, `generations`, `training_jobs`) — **zero** registro parado
em estado intermediário além do prazo.

### 4.3 Pagantes

- **Pagante trancado (pagou e está sem acesso): 0.** Conferido um a um na
  Hotmart viva: 93 suspeitos no banco → 0 trancado, 0 na fronteira, 0 sem prova.
  Trancar está certo em 93: 34 cancelaram, 52 inadimplentes, 7 trial que nunca
  virou pagamento.
- **Pagante com crédito e SEM nenhuma voz pronta: 4** — este é o número que
  dói, e é o item 2 do §3:

| aluno | crédito | sem voz há | motivo |
|---|---|---|---|
| `jrfengenhariadf@` | 100.000 | 29 dias | 3 dos 7 arquivos nunca chegaram |
| `leandro.fitoway@` | 97.620 | 24 dias | 8 dos 14 arquivos nunca chegaram |
| `ivanildezuca@` | 200.000 | 15 dias | 2 tentativas, só ~6min úteis (mínimo 10min) |
| `marcelopersonalthe32@` | 198.950 | 14 dias | falha técnica nossa no treino |

### 4.4 GPU

| endpoint | fila | workers |
|---|---|---|
| voz / treino (`2jcta960`) | 0 | 7 idle, 0 throttled ✅ |
| vídeo / react (`9get7wv7`) | 0 | 2 running, **3 throttled** |
| VoxBR (`0qd28qwo`) | 0 | 4 idle ✅ |

`throttled` no vídeo = o datacenter não tem GPU livre. **Nada a fazer no
código**, e com fila 0 não está segurando ninguém agora.

### 4.5 Números que mudaram de ontem pra hoje

| | 21/08 | 22/08 | 23/08 |
|---|---|---|---|
| Vozes criadas | 15 | 42 | **32** |
| Vozes `ready` | 15 | 37 | **31** (1 não) |
| Gerações de áudio prontas | — | 96 | **95** |
| Gerações **falhadas** | — | **0** | **5** |
| Incidentes abertos no fecho | — | 3 | **20** |
| Incidentes fechados no dia | 13 | 10 | **5** |

**Duas leituras honestas:**

- **A taxa de falha de geração saiu de 0% pra 5%.** Quatro dessas cinco são
  `qa_coverage` (áudio não contém o texto completo), todas depois das 15:09Z.
  A ronda das 15:09Z declarou "dia limpo, 0 falhas em 136 gerações" e **estava
  certa quando foi escrita**. Era calmaria, não cura: a régua não mudou (nenhum
  deploy no worker entre 21/08 21:46Z e 23/08 21:50Z) e a taxa acumulada desde a
  correção de 21/08 é **1,94%** contra **2,01%** da régua velha — indistinguível.
  **A correção de 21/08 não reduziu nada.**
- **`janetecasarotto2@gmail.com` está sem nada há 30h**: 2 tentativas, 2 falhas,
  zero geração pronta. Foi estornada. **Estorno não resolve** — ela continua sem
  o áudio que queria.

### 4.6 Dinheiro devolvido nas últimas 24h

| tipo | linhas | créditos |
|---|---|---|
| `studio_scene_refund` | 27 | 48.600 |
| `generation_refund` | 6 | 5.889 |
| `image_refund` | 2 | 1.050 |
| `video_clone_refund` | 1 | 9.240 |

O grosso é o Martin: **26 falhas de Vídeo Estúdio em 52 minutos** (21:05→21:57
UTC), 27 estornos. Crédito confere 26 a 26 — **ninguém pagou pelo nosso erro**.
As falhas pararam sozinhas às 21:57Z; **a causa segue aberta**.

---

## 5. O que NÃO foi verificado — não conte isto como saúde

- **A imagem do template principal do RunPod (`03vs3iiph6`)** — prova indireta
  (§1.2), não medida direta.
- **Por que o Vídeo Estúdio do Martin falhou 26 vezes.** Estornei e medi; não
  achei a causa.
- **Por que um estorno demorou 30min01s** (geração `2e2938b7`, `executionTimeout`)
  enquanto os outros saíram em 44s e 2min41s. Nesse intervalo a aluna fica sem o
  crédito **e** sem o áudio.
- **Se os nossos e-mails chegam ao aluno.** Não existe registro do que foi
  enviado, e os 17 bounces na caixa não viraram nada. Incidente aberto. Toda vez
  que eu digo "aluno avisado", isso vale o que vale esse registro — que é nada.
- **A folga que o plano novo do Supabase comprou.** Continua sem monitor de
  cota. A causa do apagão de ontem (7,5M requisições de polling em 98 dias)
  está intacta. **A data do próximo 402 é aritmética, não azar.**
- **O detector de "fechado que volta a disparar" é cego.** As 4 falhas de
  `qa_coverage` de hoje batem com a signature exata do incidente `37bacb68`,
  fechado em 20/08 — e **não incrementaram nada**. `last_seen_at` dele segue
  congelado há 86h. O detector reporta LIMPO porque `last_seen_at` nunca é
  atualizado. Objeção anotada no incidente, **não reabri** (é decisão minha e
  ainda não tomei).
