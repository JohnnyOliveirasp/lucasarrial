# 25/08 — Relatório noturno (consolidado do dia)

Fechado **26/08 01:15 UTC** (22:15 BRT de 25/08). Este arquivo é a prova
técnica; o Telegram levou o resumo e o caminho daqui.

Janela contada: **25/08 03:00 UTC → 26/08 01:15 UTC** (o dia 25/08 em BRT).
⚠️ Faltam ~1h45 pro dia fechar em BRT — os números de volume (vozes, gerações)
ainda podem subir um pouco. Não são finais e estão marcados como tal.

---

## 1. Produção — o que está NO AR agora (medido, não deduzido)

### 1.1 Site (Hetzner)

| | |
|---|---|
| Commit no ar | **`97fa8cc`** — `video-clone: gate de rosto frontal ANTES de cobrar (#131)` |
| BUILD_ID no servidor | **`fam_u_vhAvTVYLbBiz1BX`** |
| Build gerado em | **25/08 21:37:16 UTC** (`stat` do `.next/BUILD_ID`; Action de `97fa8cc` disparada 21:35:38Z) |
| pm2 `aiverse` | **online** · **484** restarts acumulados (ontem 405) · `unstable restarts: 0` |
| `main` × `origin/main` | **0 ↔ 0** — em sincronia, nada preso local |
| Deploys de frontend no dia | **5**, todos `success` |

**Prova por md5, não por Action verde.** O servidor não é checkout git, então
"está no ar" tem que ser medido no arquivo. O `97fa8cc` alterou **dois**:

| arquivo | local (`97fa8cc`) | servidor | bate? |
|---|---|---|---|
| `frontend/src/app/api/v1/video-clone/route.ts` | `6f563ae02a7f9daa526f5cd69cd3560b` | `6f563ae02a7f9daa526f5cd69cd3560b` | ✅ |
| `frontend/src/lib/video-clone/face-gate.ts` | `a828b00713be0f0a1d70f8b81304c3bd` | `a828b00713be0f0a1d70f8b81304c3bd` | ✅ |

**Está no ar.**

⚠️ **Um ponto que eu não expliquei:** o pm2 subiu de **405 → 484 restarts** em
24h (79 restarts) e o processo atual tem **29 min de uptime**, ou seja reiniciou
por volta de **26/08 00:32Z** — **3h depois** do último deploy (21:37Z). Os 5
deploys do dia explicam no máximo 5. O `pm2 describe` diz `unstable restarts: 0`
e o log de erro não mostra crash — só warnings de Node 18 e erros de cliente.
**Não achei a causa dos outros ~74 e não vou fingir que achei.** Fica anotado
como número que subiu sem explicação.

Deploys de frontend do dia (todos na `main`, todos `success`):
`9e97569` (12:45Z) · `2b01ad2` (13:55Z) · `d238195` (18:41Z) · `f334c8d`
(21:31Z) · `97fa8cc` (21:35Z).

### 1.2 Worker de GPU (RunPod) — deploy SEPARADO

O worker não passa pelo deploy do site. Confundir os dois é dar por entregue o
que nunca saiu.

| | |
|---|---|
| Último `Build RunPod Worker` **na main** | `d238195` — **success** (25/08 18:41 UTC) |
| Template `itkncnhn7y` (VOX B) | `ghcr.io/johnnyoliveirasp/lucasarrial-runpod:`**`d238195`** ✅ lido pela REST |
| Template `03vs3iiph6` (principal) | **404 na REST** — 2º dia seguido, não consegui ler de volta |
| Builds de worker no dia | **6** (1 na `main`, 5 na `dev` — 3 success, 2 cancelled) |

**Honestidade sobre o template principal:** não li a imagem dele com meus olhos,
igual ontem. O que tenho é o passo de deploy que falha o job de propósito se o
`saveTemplate` não voltar com a imagem nova, e o job passou — prova indireta
forte, **não é o md5**. O VOX B, que recebe a mesma imagem no mesmo passo,
confirma `d238195` diretamente.

Os 5 builds da `dev` apontam o endpoint de **TESTE** — não tocam produção.

---

## 2. O que eu resolvi hoje

**13 incidentes fechados** (8 `fixed`, 5 `ignored`) contra **13 abertos**. A
fila fecha o dia em **4 abertos**.

Números fechados: `128 130 82 132 129 134 131 136 123 108 135 52 138`.

### 2.1 O vídeo clone cobrava 10.120 créditos sem olhar se havia rosto na foto

`#131`. A cadeia imagem→animar→clone debitava **10.120 créditos** e só depois
descobria que a foto não tinha rosto frontal utilizável. **`97fa8cc` põe o gate
ANTES da cobrança** (`frontend/src/lib/video-clone/face-gate.ts`, 81 linhas
novas + 15 no route). No ar, md5 conferido (§1.1). Fechado 21:35:38Z.

### 2.2 A Fast prometia "seus créditos não expiram nunca" para trial R$0

`#136`. O manual da Fast (`frontend/src/lib/agent/manual.ts`) afirmava
`CREDITOS NAO EXPIRAM` **sem distinguir crédito PAGO de trial R$0**, na seção de
Créditos. Quem cancelava no trial saía com a promessa por escrito. Corrigido em
**`f334c8d`**: a promessa vale pra quem **PAGOU**; trial R$0 vale até o **10º
dia**. No ar. Fechado 21:52:53Z.

Isto é a mesma família do `#138` (§2.6): rótulo que afirma pagamento onde o
critério nunca mediu pagamento.

### 2.3 Três alunos que estavam esperando de verdade — entregues e avisados

| aluno | o quê | prova |
|---|---|---|
| **Katia** (`#47`) | áudio refeito por conta da casa, com a causa (respiro entre frases / pacing 220-0) explicada por escrito | Enviados **uid 112**, 22:55:37Z |
| **Luciano** (`#99`) | clone novo gerado por conta da casa, `ready` **22:43Z**, entregue | Enviados **uid 113**, 23:06:29Z |
| **Giovanna** (`#133`) | pagante ATIVA (acesso até 19/09) que escreveu cobrando 15 dias de silêncio; respondida com o defeito achado e os créditos devolvidos | Enviados **uid 106**, 21:49:24Z |

⚠️ **Conferi a promessa em vez de acreditar no e-mail** no caso do Luciano: o
e-mail diz que o vídeo está na conta e o vídeo existe mesmo (`aluno.cjs`: Vídeo
Clone 25/08 22:43 `ready`). Sem cobrança: último débito dele é de 24/08.

⚠️ **`#133` (Giovanna) está em `aguardando_aluno` e isso está HONESTO** — eu
suspeitei que fosse um chamado parqueado indevidamente (aluna reclamando não é
aluna esperando) e fui conferir na pasta Enviados **antes** de reportar como
problema. A resposta saiu 21:49Z. A bola está com ela. **Achado derrubado.**

### 2.4 Os dois cancelamentos com relógio, os dois fechados no prazo

- **`#132` — Douglas**: pediu reembolso na janela de garantia às 16:35Z, sem
  dono. Prazo fechava hoje. Fechado 18:51:19Z.
- **Grazielle** escreveu *"Pode cancelar por favor a Compra"* às **20:02Z**
  (uid 300). `entitlements` dela: **`canceled`, `updated_at` 20:13:53Z** — 11
  minutos depois. Período pago respeitado (acesso até 01/09). **Não abri chamado
  porque não havia o que abrir**: já estava feito quando fui olhar.

### 2.5 `#129` — a coluna "já pagou" estava `false` nos 1.515 perfis

O backfill da migration 79 nunca saiu. Fechado 21:31:12Z com a medição de que
**nenhum arquivo em `frontend/` lê a coluna** — ou seja, ninguém estava
decidindo nada em cima dela. Não é dano consumado; é uma armadilha desarmada
antes de alguém pisar.

### 2.6 `#138` — a varredura chamava trial R$0 de "PAGANTE"

O bloco imprimia `🚨 PAGANTE COM CRÉDITO E SEM NENHUMA VOZ PRONTA`, mas o filtro
(`varredura_travados.cjs:191`) é `access_until > now` + saldo — **nunca mediu
pagamento**. Conferidos um a um no `pagou_de_verdade.cjs`: **4 dos 5 nomes nunca
pagaram**.

O `leandro.fitoway` é o traiçoeiro: ele **tem** R$97 no sistema, só que
**OVERDUE**. "Existe R$97" lê como assinante numa passada de olho.

**`9cd5e82`**: rótulo virou `ACESSO VIVO, COM CRÉDITO E SEM NENHUMA VOZ PRONTA`,
com aviso na linha seguinte mandando cruzar com `pagou_de_verdade.cjs` antes de
decidir crédito. **Conferido DEPOIS de gravar**: mesma população de 5, mudou só
o texto. Nenhum aluno afetado — defeito de rótulo interno. Fechado 00:49:41Z.

### 2.7 O e-mail pro aluno chegava com o acento quebrado

`d079815`. Faltava `Content-Transfer-Encoding` no `enviar_email.cjs` — o aluno
recebia *"vocÃª"* no lugar de *"você"*. Ferramenta, não código do site: nada a
deployar. É o tipo de defeito que ninguém abre chamado e todo mundo vê.

### 2.8 O resto que subiu (por peso)

| commit | o que mudou pro aluno |
|---|---|
| `d238195` | seletor de ritmo (opção B: "mais calmo / normal / mais rápido") + `reference_wav_path` junto do prompt + QA de ritmo mais apertado |
| `6c7e237` | promessa "reenviar basta" agora **exige margem** — a projeção desconta 25% de cada arquivo perdido antes de prometer |
| `ad7eec6` | envio incompleto que nem inteiro fecharia a porta **para de prometer** que reenviar basta |
| `67cfcbb` | `retry_badcase_ratio_threshold` volta ao padrão do fabricante (6.0) |
| `9cd5e82` `c109f4f` `c80b1c5` `9954ce4` `8ee94a6` | varredura: rótulo honesto, bloco próprio pro `aguardando_aluno`, critério da cura vira DIVERGÊNCIA da produção |
| `d29959b` | `refazer_audio_conta_da_casa`: `--texto-arquivo` e `--nome` (rotular A/B) |
| `ae7ab42` | `telegram_audio.cjs` — manda áudio pro grupo (usado nos testes de ritmo) |

### 2.9 Duas coisas que a ronda da noite **derrubou** com medição

Registro porque as duas viraram pedido ao Johnny antes de serem medidas, e as
duas estavam erradas. Isto é o que impede o relatório de virar telefone sem fio.

**(a) O e-mail em lote pros 12 do `#137` está CANCELADO.** As rondas de 23h40 e
00h escalaram um pedido de "pode?" pra escrever a 12 alunos com voz em
`awaiting_training`. A ronda de 00h15 mediu a população um a um (17 vozes / 16
donos): **14 já têm pelo menos uma voz `ready`**. Só **1** está realmente preso
— e entrou hoje, parado 0,4 dia. `awaiting_training` é majoritariamente
**entulho de primeira tentativa**: o aluno grava, não gosta, grava de novo e
treina a segunda. Mandar *"sua voz está esperando você treinar"* seria escrever
pra 14 pessoas satisfeitas sobre um rascunho que elas mesmas descartaram.
**O pedido foi retirado. Nenhum e-mail saiu.**

**(b) A varredura do trial (`#135`) NÃO está morta — está desligada de
propósito, e desde 18/08.** A ronda de 00h reportou "varredura parada há 7 dias,
a promessa dos 176.320c do Douglas está sendo cumprida **por acidente**". Fui
ler o log de produção agora:

```
[sweep-clones] expiração de trial FALHOU: expire_trial_credits devolveu
resposta inesperada: {"ok":false,"error":"DESATIVADA MANUALMENTE 18/08:
deteccao de pagante errada, zerou 14 pagantes. Nao reativar sem novo teste."}
```

O cron **está vivo** e roda a cada 5 min (00:35, 00:40, 00:45, 00:50, 00:55,
01:00Z — medidos). Quem responde `ok:false` é a **própria função**, com a razão
escrita dentro dela. O desligamento está documentado neste repo desde 18/08
(`_frank/prova/2026-08-18_os_14_nunca_pagaram.md:85`). `trial_credit_expirations`
confirma: **328 linhas, 328 resolvidas, última 18/08 18:45:05Z** — não há fila
parada, há uma função que se recusa a rodar.

**Consequência:** o Johnny fechar o `#135` como `ignored` estava **certo** — ele
sabe do desligamento. O crédito do Douglas não está protegido por acidente, está
protegido por um interruptor com bilhete colado. O que falta no chamado é só a
`resolution_note`, e isso é escrituração, não risco.

### 2.10 Erro meu

Quase reportei o `#133` (Giovanna) como chamado parqueado indevidamente sem
antes olhar a pasta Enviados (§2.3). Teria sido um alarme falso sobre a única
pagante ativa que reclamou hoje. Conferi antes de escrever. Custou uma consulta.

---

## 3. O que precisa do Johnny (perguntas binárias)

| # | pergunta | prazo |
|---|---|---|
| 1 | **`ycarlosk@gmail.com`** perde o acesso em **~11h** (26/08 12:00Z) com 100.000 créditos e zero voz. Gravou 1min do mínimo de 20, levou a recusa e nunca voltou. Trial R$0 (nunca pagou). **Estendo?** | **~11h** |
| 2 | **PR #57** — a lista de vozes não avisa que falta o aluno clicar em "treinar". Rótulo de UI + render condicional, sem migration e sem crédito. `tsc` 0 erros, `eslint` limpo. **Mergeio?** | — |
| 3 | **`#97`** — vídeo clone troca o rosto em áudio longo, parado há **~57h** esperando decisão de produto. **Limito a duração da geração longa (sim) ou sigo só avisando na tela (não)?** | — |
| 4 | **Regra 7** — WAHA só escuta em `127.0.0.1` no servidor e eu rodo fora dele. **3ª ronda seguida** sem conseguir postar no grupo do Lucas. **Provisiono o caminho (túnel/token)?** | — |
| 5 | **`FASE_TELEMETRIA_SECRET`** não está no servidor: medido hoje, **0 de 133** gerações das últimas 24h carregam `qa->fase_corrente`. O código sobe e **se desliga sozinho**. **3º dia perguntando. Ponho a variável?** | — |

---

## 4. Estado geral

### 4.1 Incidentes abertos: **4**

| nº | o que é | idade | oc |
|---|---|---|---|
| `97` | vídeo clone troca o rosto em áudio longo (3 alunos) | **57,4h** | 4 |
| `137` | voz pronta pra treinar e nunca treinada — **população re-medida, 14 dos 17 já têm voz** (§2.9a) | 1,4h | 12 |
| `139` | recusado no portão de 20min e nunca voltou (2 trials) | 1,0h | 2 |
| `140` | **NOVO, 01:00Z** — Luzielia: link do OneDrive deu 401, ela mandou link novo | 0,25h | 1 |

O `140` chegou **depois** da última ronda. A Fast já respondeu (Enviados uid
117, 01:00:14Z) e escalou pro Johnny (uid 116). A aluna **não tem conta nem
`entitlement`** — veio pela planilha do onboarding e o áudio dela nunca entrou.
O caminho é reprocessar o import com o link novo; precisa dos fileIds do Drive.

**Fora da contagem de "abertos": 7 em `aguardando_aluno`** — `47` (6d), `65`
(5d), `72` (4d), `99` (2d), `120` (1d), `124` (1d), `133` (0d). **15 alunos.**
Registro de novo pra ninguém ler "4 abertos" como "4 pessoas esperando": são
**19 alunos** somando as duas listas.

⚠️ `120` (Sandra Diniz, pré-venda) está em `aguardando_aluno` **sem nota** há
1 dia. `47` está parado há 6 dias — a regra diz que 7d+ sem resposta pede
**segunda tentativa**, não silêncio. Ele vence amanhã.

### 4.2 Filas: nada preso

As 6 tabelas da varredura (`voices`, `video_clones`, `react_jobs`,
`image_generations`, `generations`, `training_jobs`) — **zero** registro parado
em estado intermediário além do prazo.

**1 resíduo de escrituração, sem ninguém esperando:** `training_jobs` tem 1
linha obsoleta (job `ebf5cc56` nunca saiu de `queued/running` mas a voz
`f4b9b0f2` já está `ready`). É o mesmo de ontem. Não abri chamado.

### 4.3 Pagantes

- **Pagante trancado (pagou e está sem acesso): 0.** Conferido um a um na
  Hotmart viva: **119 suspeitos** no banco → **0 trancado, 0 na fronteira, 0 sem
  prova**. Trancar está certo em 119: **48 cancelaram, 67 inadimplentes, 4 trial
  que nunca virou pagamento**. (Ontem: 107 / 39 / 58 / 10.)
- **Acesso vivo, com crédito e SEM nenhuma voz pronta: 5** (ontem 6). Rótulo
  novo do `#138` — **acesso vivo ≠ pagou**. Cruzado com `pagou_de_verdade.cjs`:

| aluno | crédito | sem voz há | acesso até | pagou? | motivo |
|---|---|---|---|---|---|
| `leandro.fitoway@` | 97.620 | **26 dias** | 29/08 | **NÃO** (R$97 OVERDUE) | 8 dos 14 arquivos nunca chegaram — `#72`, bug nosso |
| `marcelopersonalthe32@` | 198.950 | 16 dias | 05/09 | **SIM** (R$97, 12/08) | áudio com mais de uma pessoa falando |
| `ycarlosk@` | 100.000 | 2 dias | **26/08** | **NÃO** | 1min < mínimo de 20min — **pergunta 1 da §3** |
| `oliver_humberto@` | 100.000 | 0 dias | 01/09 | **NÃO** | `awaiting_training`, entrou hoje, falta clicar |
| `definidameta@` | 98.425 | 0 dias | 01/09 | **NÃO** | 15min < mínimo de 20min |

**Só 1 dos 5 pagou de verdade.** Ontem essa lista teria sido lida como "6
pagantes presos"; hoje ela diz a verdade. Foi pra isso que o `#138` existiu.

`jrfengenhariadf@` e `dr.aleciotenorio@`, que estavam na lista ontem, **saíram** —
o acesso do `jrf` venceu 25/08 12:00Z durante a ronda das 12h.

### 4.4 GPU: fila 0 nos três, 0 throttled

| endpoint | fila | workers | falhas acumuladas |
|---|---|---|---|
| voz/treino (`2jcta960`) | 0 | 7 idle ✅ | 120 / 4.222 |
| vídeo/react (`9get7wv7`) | 0 | 3 idle + 2 initializing, 1 job em curso ✅ | 150 / 2.468 |
| VoxBR (`0qd28qwo`) | 0 | 4 idle ✅ | 5 / 233 |

**Nenhum `throttled`** — ontem o de vídeo tinha 2. Ninguém esperando GPU agora.

### 4.5 Dinheiro pendurado: **0**

**Uma única geração falhou nas últimas 24h** — Janete Cazarotto, 25/08 21:44Z,
`qa_coverage: audio gerado nao contem o texto completo`. **Estornada: +400.**

O `estorno_confere` acusa **4 "sem estorno casado"**, e os 4 estão certos:
`kessulyl` ×2 (24/08 18:47 e 18:53 — refação **por conta da casa**, 0 débito),
`johnny.oliveirasp` (conta da casa) e `serescastro6` (20/08). **Nada a
devolver.** O "4 sem estorno" lido sem essa conferência viraria alarme falso.

### 4.6 Caixa e canais

- **Fila de não-lidos: 1** (uid 302, chegou agora) — a Fast lê a cada 5 min.
  Último lido: uid 301 (Luzielia, § 4.1).
- **50 mensagens saíram hoje** da caixa do suporte (Enviados uid **68 → 117**),
  a maioria automática do onboarding.
- **Vigia: 0 patch pendente e 0 recado pendente.** O patch `patch_a3ced7ac` dele
  foi revisado linha a linha e virou o **PR #57** (pergunta 2 da §3). Nada do
  trabalho dele morreu na fila hoje.

### 4.7 Números que mudaram

| | 23/08 | 24/08 | **25/08** |
|---|---|---|---|
| Vozes criadas | 30 | 26 | **24** |
| Vozes `ready` | 29 | 25 | **22** |
| Gerações de áudio | 112 | 148 | **116** |
| Gerações **falhadas** | 7 | 5 | **1** |
| **Taxa de falha** | 6,3% | 3,4% | **0,9%** |
| Incidentes abertos no fecho | 20 | 7 | **4** (+7 aguardando aluno) |
| Incidentes fechados no dia | 11 | 14 | **13** |
| Incidentes abertos no dia | 20 | 7 | **13** |
| Pagante trancado | 0 | 0 | **0** |
| Suspeitos conferidos na Hotmart | — | 107 | **119** |
| Acesso vivo com crédito e sem voz | 4 | 6 | **5** |
| Deploys de frontend | — | 15 | **5** |
| PRs abertos | — | — | **20** (mais velho: 174h) |

**Leitura honesta dos números:**

- **Taxa de falha 3,4% → 0,9%** é o melhor número da semana, mas **o dia não
  fechou** (faltam ~1h45 em BRT) e **1 falha em 116 não sustenta tendência**.
  Não conte como saúde ainda. O que dá pra dizer é que a única falha do dia foi
  estornada em minutos.
- **Vozes criadas 26 → 24 e gerações 148 → 116.** Não tenho causa medida.
  Terça-feira depois de uma segunda forte. **Não conte como problema nem como
  saúde até ter série maior** — é a mesma ressalva de ontem.
- **Divergência com o relatório de ontem, e ela é real:** ontem eu reportei "17
  fechados em 24/08"; a medição de hoje por `resolved_at` diz **14**. A
  diferença são `82`, `108` e `52`, que foram fechados em 24/08 e **reabertos e
  fechados de novo hoje**. O número de ontem não estava errado no momento em que
  foi medido; ele deixou de valer. Registro pra ninguém tratar como erro.

---

## 5. O que NÃO foi verificado — não conte isto como saúde

- **A telemetria de fase continua INERTE**: **0 de 133** gerações nas últimas
  24h carregam `qa->fase_corrente`. Mesmo número de ontem, medido de novo, não
  herdado. É a pergunta 5 da §3, **3º dia**.
- **A imagem do template principal do RunPod (`03vs3iiph6`)** — 404 na REST, 2º
  dia. Prova indireta (§1.2), não medida direta.
- **Os ~74 restarts do pm2 sem explicação** (§1.1). Número que subiu e eu não
  sei por quê.
- **O defeito do `#72` NÃO está corrigido**, só mitigado: a aba/conexão morrer
  entre os PUTs e o `uploads-complete` continua possível. O `leandro.fitoway`
  segue na lista da §4.3 por causa dele, há 26 dias.
- **Envio ≠ entrega.** Tenho uids na pasta Enviados; não tenho confirmação de
  leitura, e **bounce não escreve `last_seen_at` em lugar nenhum**. Toda vez que
  eu digo "aluno avisado", vale o que esse registro vale.
- **20 PRs abertos, o mais velho de 174h (7,3 dias).** O **PR #15** (143h)
  adiciona `awaiting_training` aos alvos da varredura — a ferramenta que teria
  mostrado a classe do `#137` **6 dias antes** está parada numa fila. ⚠️ Ele
  **não mergeia limpo**: conflita em `varredura_travados.cjs` e no README, e
  agora também com o `9cd5e82` de hoje. Precisa de rebase.
- **A cota do Supabase continua sem monitor.** A causa do apagão de 22/08 está
  intacta. A data do próximo 402 é aritmética, não azar.
- **Não conferi o `#124` (Dr. Negrini) nem o `#120` (Sandra) nesta ronda** —
  estão em `aguardando_aluno` e não tinham movimento novo, mas "não tinha
  movimento" é o que eu vi na listagem, não uma conferência caso a caso.

---

## 6. Regra 7 — o grupo do Lucas segue inalcançável (3ª ronda seguida)

Medido de novo, não herdado: `avisar_grupo.cjs` aborta com `WAHA_API_URL/
WAHA_API_KEY ausentes nesta máquina`. A WAHA só escuta em `127.0.0.1` no
servidor e esta máquina não tem caminho até lá.

**Os fatos consumados de hoje que deveriam ter ido pro grupo e não foram:**
o `#131` (gate de rosto antes de cobrar), o `#136` (promessa de crédito do
trial), o `#138` (rótulo PAGANTE), a entrega da Katia, a entrega do Luciano e a
resposta à Giovanna. **Seis linhas que o Lucas não viu.**

Isto precisa de provisionamento, não de mais uma anotação. É a pergunta 4 da §3.
