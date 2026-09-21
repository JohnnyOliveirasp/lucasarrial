# Ronda diária — saúde do qa_coverage — 21/09/2026 (leitura 15:19Z, segunda)

Script: `/tmp/perf/qacov.cjs` (saída `/tmp/perf/_out_0921_corrigido.txt`, exit=0).
Apoio: `/tmp/perf/_recont_0921.cjs`, `/tmp/perf/_estorno_0921.cjs`,
`_frank/ferramentas/pagante_trancado.cjs`.

## 0. O que conclui hoje

> **O achado da ronda é contra o instrumento, não contra a plataforma. Por 13
> dias eu imprimi "régua NOVA (2adb080: piso 0.65 + gate terminal)" e as DUAS
> afirmações eram falsas.** `2adb080` mexeu em **um arquivo de teste** (13
> linhas, zero gate) e o piso **nunca foi 0.65** — é **0.85**, valor único nas
> 1.434 gerações com telemetria desde 25/08. Ver §1. É a doença fundadora desta
> ronda (medir a régua errada) voltando pelo **rótulo**, que nenhuma das minhas
> checagens lê.

> **Segundo achado: o detector de cobertura era cego a um dos dois caminhos de
> falha.** Falha de cobertura chega pelo worker (`qa_coverage: ...`) **ou** pelo
> frontend (`O áudio saiu incompleto...`). O detector `/qa_coverage/i` via só o
> primeiro. Dano medido é **limitado — 1 falha invisível desde 25/08** — mas o
> mecanismo não é: um deploy de **frontend** cega este instrumento sem nenhum
> build aparecer no `gh run list` do worker. Ver §2.

**Build verde e deployado de verdade.** `561f6867` terminou 20/09 22:26:15Z,
job `deploy-runpod` verde incluindo `Point template to new image + recycle
workers`. **Não é corte de régua** (referência de voz / speech-rate; grep de
gate no diff = vazio). Nenhum run falhou, nenhum `in_progress`. Sem notícia
ruim de deploy.

**Nenhum aluno travado agora.** 0 presas, 0 `failed` com erro vazio,
`pagante_trancado.cjs` = **0 pagantes trancados**, 0 na fronteira, 1 sem prova
(`drfabiovilhena29@gmail.com`, sem subscriber code). **18/18 falhas do pool
estornadas**, 0 aluno sem estorno.

**ONTEM (20/09) fechou com 1 falha em 38 gerações = 2,6%** — e com o detector
corrigido essa falha **é** de cobertura (antes aparecia como `qa_coverage=0`).
É 1 evento, não tendência: em n=38 uma falha vale 2,6 pontos.

**HOJE não diz nada.** 0/24 às 15:19Z. n=24 passa raspando o mínimo, mas a faixa
que quebra (≥1000ch) tem **n=3**. Não concluo nada de hoje. Ver §4.

> **O que não é de QA e não é meu para agir — e é a pior notícia daqui:**
> **Tania Regina (`taniaregina.espadaro@gmail.com`) perdeu o acesso HOJE às
> 12:00Z.** A ronda de ontem marcou "morre em menos de 24h"; morreu. Ela **nunca
> voltou** depois das 3 falhas de 16/09 — a última coisa que ela viu na
> plataforma foram três falhas seguidas, todas estornadas. Estorno não a trouxe
> de volta. Decisão do Johnny. Ver §3.

---

## 1. Qual régua está no ar (PASSO 1) — e por que o rótulo estava errado

`gh run list --workflow=runpod-worker.yml --limit 5`: cinco runs, **cinco
verdes**, nenhum `in_progress`.

| run | sha | terminou (updatedAt) |
|---|---|---|
| último | `561f6867` | 2026-09-20T22:26:15Z |
| anterior | `d49837ff` | 2026-09-20T00:20:17Z |
| — | `b2d9f47a` | 2026-09-15T03:49:41Z |
| — | `7b673a72` | 2026-09-15T02:44:36Z |
| — | `2adb0807` | 2026-09-08T15:22:32Z |

**`561f6867` é deploy de verdade, e não é corte.** Critério, não gatilho:

- `git diff --numstat 561f6867^1 561f6867 -- runpod-worker/` → `jobs/train.py`,
  `jobs/train_reference.py`, `voice_pipeline/reference.py`,
  `test_reference_speech_rate.py`, `test_reference_word_snap.py`.
- `grep -iE 'qa_cov|coverage|piso|threshold|MIN_COV'` no diff → **VAZIO**.
- É corte da referência da voz por words-per-second / cutmode: **treino**, não o
  portão de completude da **inferência**.
- Mas `deploy-runpod` rodou `Point template to new image + recycle workers`
  **verde** ⇒ **houve troca de frota às 22:26Z**. Segunda reciclagem em 22h
  (a outra 00:20Z). Entra como contexto vigiado no elapsed, não como régua.
  (Terceira lição de 20/09 valendo pela segunda vez.)

### O rótulo que estava falso

O script imprimia `regua NOVA (2adb080: piso 0.65 + gate terminal)` e ancorava
**toda** a análise acumulada em 08/09 15:22Z. Conferido hoje:

- `git diff --numstat 2adb080^1 2adb080` → **1 arquivo**:
  `test_fase_telemetria.py`, **13+/1-**. Um commit só (`5b4a2d90`,
  *"fix(test): destrava test_fase_telemetria, defasado desde o PR #209"*).
  `grep -icE 'qa_cov|coverage_qa_min|threshold'` no diff → **0**.
  **Mexeu em teste. Nada mais.** Não é corte de régua.
- O piso é `TTS_COVERAGE_QA_MIN`, default **`"0.85"`**
  (`runpod-worker/jobs/tts_settings.py:252`). O `0.65` é
  `TTS_COVERAGE_ESPALHADA_MIN` (linha 258) — **outro botão, outro fenômeno**.
- Prova no dado, não no código: `qa.coverage_min` nas gerações com blob →
  **`0.85`, n=1.434, valor ÚNICO, de 25/08T21:44Z até hoje 15:02Z.** Nunca
  existiu piso 0.65 no ar.

**Consequência do erro:** a divisão "régua NOVA vs ANTERIOR" partiu em dois um
pool **homogêneo**. A última mudança real no gate é `f8586783` (05/09 08:28Z).

| pool | total | falhas | taxa | cobertura (corrigida) |
|---|---|---|---|---|
| corte **fabricado** 08/09 15:22Z | 1.029 | 18 | 1,75% | 3 (0,29%) |
| corte **real** `f8586783` 05/09 08:28Z | **1.209** | **18** | **1,49%** | 3 (0,25%) |

A régua no ar tem **16 dias**, não 13. Nenhuma correção escrita e não deployada.

---

## 2. A cegueira do detector (PASSO 2)

A falha de ontem 22:55Z veio com `error_message` =
`"O áudio saiu incompleto (mais curto que o texto). Refaça — os créditos foram
devolvidos."` — **texto do frontend**, não do worker
(`frontend/src/app/api/v1/webhooks/runpod/route.ts:230`, caminho `truncado` /
`audioCurtoDemais`; também em `generations/[id]/route.ts:166`).

São **dois caminhos** para a mesma doença:

1. worker esgota regenerações → `"qa_coverage: audio gerado nao contem o texto
   completo apos esgotar regeneracoes"`;
2. worker **entrega** áudio curto → o frontend reescreve para `"O áudio saiu
   incompleto..."`.

O detector era `/qa_coverage/i` ⇒ via só o (1). Recontagem desde 25/08:

| detector | cobertura |
|---|---|
| antigo `/qa_coverage/` | 12 |
| corrigido (+ `saiu incompleto`) | **13** |
| **invisíveis ao antigo** | **1** |

**Dano real: 1 falha.** Não houve distorção grande na série — mas a falha de
20/09 estava classificada como `qa_coverage=0` quando **é** reprovação de
cobertura: `coverage_soma=0.833` contra `coverage_min=0.85`, `regens=2`,
`exhausted=1`, `coverage_flagged=3`, `faltantes_amostra=["viana"]`.

**O que isso ensina é maior que o número:** o texto do erro é escrito pelo
**app**, e o PASSO 1 desta ronda só vigia `runpod-worker.yml`. A pergunta "qual
régua está no ar" tem **dois lados** e eu vigiava um.

Corrigido em `/tmp/perf/qacov.cjs` (detector + rótulo + lições no topo).

### Integridade da base

- **(e)** `qa_coverage` desde 25/08: 13 (era 12, `delta=+1` = a falha nova de
  20/09). Falhas totais: 31 (era 30, `delta=+1`). **Nenhuma falha de período
  fechado desapareceu.**
- **(e2)** 3 linhas sumiram de dias fechados: **10/09** (90→89), **16/09**
  (77→75). Conferido contra (e): as falhas desses dias estão intactas (16/09
  segue com 4, 10/09 com 0) ⇒ **o que foi apagado foram SUCESSOS**. A taxa
  desses dias **piorou** (16/09: 4/77=5,19% → 4/75=5,33%), não melhorou. Não é
  a direção perigosa, mas a linha de base passa a ser o valor **vivo**.
  Quarto dia seguido com linha sumindo — **nenhum dia é "estável"**.
- **(d)** `elapsed` NULL em `ready`: 258/1.011 = 26% (faixa normal 13-29%).

---

## 3. Quem falhou (PASSO 3)

**18/18 falhas do pool estornadas** (`ref_type='generation_refund'` — nunca por
`kind`: o estorno de ontem gravou `kind='extra_purchase'`, e filtrar por `kind`
faria parecer que ninguém foi estornado). **0 falhas de aluno sem estorno.**

A falha de ontem:

- **Larissa Fonseca de Oliveira Carvalho Viana** (`larissaoviana@yahoo.com.br`)
- 20/09T22:55:55Z, 28ch, `elapsed=30.096s`, cobertura 0,833 < piso 0,85.
- A palavra que sumiu do áudio foi **"viana"** — o próprio sobrenome dela, num
  texto de 28 caracteres.
- Estorno **confirmado**: 400 créditos, 22:56:28Z, `ref_type=generation_refund`.
- **Tem 2 gerações na vida**: 14/09 (ok) e 20/09 (falhou). **Não voltou.**
- `access_until = 2026-09-25T12:00Z` — **4 dias.**

### Estornado ≠ resolvido — quem não voltou

| aluno | última falha | voltou? | access_until |
|---|---|---|---|
| `taniaregina.espadaro@` | 16/09 19:51Z | **NÃO** (0 gerações) | **21/09 12:00Z — venceu HOJE** |
| `larissaoviana@` | 20/09 22:55Z | **NÃO** (0 gerações) | 25/09 12:00Z (4 dias) |
| `mariana@exceller…` | 17/09 20:32Z | voltou, 11 gerações | 07/10 |
| `semeadorriquezas@` | 17/09 22:08Z | voltou, 7 gerações | 24/09 |
| `flavio@menosvintesete` | 17/09 16:00Z | voltou, 5 gerações | 22/09 |
| `roseni.pimentel@` | 17/09 21:55Z | voltou, 4 gerações | 24/09 |
| `goudardexecutivo@` | 11/09 20:53Z | voltou, 2 gerações | null |

**Tania Regina perdeu o acesso hoje às 12:00Z** (leitura às 15:19Z: já
expirado). A ronda de ontem registrou a previsão; hoje ela se cumpriu no lado
ruim. Cinco dias parada, três falhas como última experiência, estorno que não a
trouxe de volta. **Não está travada** (não há geração presa) e **não é minha
para agir** — mas é o custo humano desta série e o Johnny precisa decidir.

---

## 4. Os números (PASSO 2) — e o que o n permite dizer

| janela | total | falhas | taxa | cobertura | veredito |
|---|---|---|---|---|---|
| **20/09 inteiro** (fechado) | 38 | 1 | **2,6%** | 1 (2,6%) | 1 evento, não tendência |
| **21/09 até 15:19Z** | 24 | 0 | 0,0% | 0 | **não concluo** (faixa ≥1000ch n=3) |
| pool régua real (05/09→agora) | 1.209 | 18 | **1,49%** | 3 (0,25%) | a que conclui |

**O build verde terminou ONTEM às 22:26Z**, então a partição pedida pelo PASSO 2
("hoje antes / hoje depois do build") **não existe hoje**: todo o dia 21/09 está
depois dele. Registro isso em vez de fabricar uma janela vazia.

Contexto das reciclagens de frota (rotulado, não é régua):

| janela | total | falhas |
|---|---|---|
| 20/09 entre as duas reciclagens (00:20Z→22:26Z) | 29 | 0 |
| desde a 2ª reciclagem (22:26Z→agora) | 32 | 1 (3,1%) |

n=32 e n=29 — **pequenos demais** para atribuir a falha à troca de frota.

### Dia da semana (quarta lição de 20/09)

Domingos da série: 30/08=57, 06/09=49, 13/09=50, **20/09=38**. 38 é o **menor
domingo**, abaixo dos três anteriores — volume baixo de verdade, não só
calendário. Mas volume não é taxa; a taxa de 2,6% vem de 1 falha.

### Elapsed — hang ou reprovação?

| grupo | n | mediana | p90 | max |
|---|---|---|---|---|
| `ready` pré-05/09 | 139 | 96,46s | 169,06s | 357,16s |
| `ready` pool atual | 753 | 95,36s | 179,41s | 378,88s |
| ≥1000ch pool atual | 171 | 155,73s | 258,07s | 378,88s |

A falha de ontem teve `elapsed=30,1s` — **baixo** (faixa 0-100ch: mediana
46,98s). É reprovação de QA, **não hang**. Incidente `d3d8d1b2` **segue
fechado**, sem motivo para reabrir. Duas reciclagens de frota em 22h não moveram
a mediana (95,36s vs 96,46s).

---

## 5. O que muda no que eu faço amanhã

1. **O rótulo da régua se confere no dado, não se herda.** Todo dia:
   (a) `git diff --numstat <sha>^1 <sha>` — `--stat` de merge engana, use o pai;
   (b) o limiar sai do **blob** (`qa.coverage_min`), nunca da minha memória.
   Se o rótulo diz um número, esse número tem que aparecer no dado.
2. **Vigiar os dois lados da régua.** O PASSO 1 só olha `runpod-worker.yml`, mas
   o texto do erro — de onde sai a classificação — é escrito pelo **frontend**.
   Deploy de app pode cegar o instrumento sem build de worker.
3. **O indicador de dano ao aluno é o RETORNO, não o estorno.** 18/18 estornadas
   e ainda assim 2 alunas não voltaram, uma delas perdendo o acesso hoje.
4. Todas as minhas checagens vigiam **números**; este erro entrou pela
   **string**. Defesa nova precisa ler o que está escrito, não só o que é contado.
