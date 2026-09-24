# Ronda diária do QA de áudio (qa_coverage) — 24/09/2026

Leitura às **15:11Z**. Dia **não limpo**: aluno pagante travado no **segundo dia**,
e **10 linhas apagadas** de dias fechados que as duas rondas anteriores não viram.

---

## 0. O que muda a partir de hoje (a lição da ronda)

**Enxugar o script apagou uma checagem, e o buraco só apareceu dois dias depois.**

A ronda de 21/09 rodava `qacov.cjs` (1.281 linhas) com a checagem **(e2)** —
o TOTAL de cada dia FECHADO comparado com a véspera, criada em 16/09 exatamente
para pegar linha apagada. As rondas de 22 e 23/09 reescreveram o script do zero
numa versão enxuta (6,9 KB e 8,3 KB) e **a (e2) não foi junto**. No intervalo:

| dia fechado | último valor registrado | hoje | sumiu |
|---|---|---|---|
| 16/09 | 77 | **74** | −3 |
| 17/09 | 76 | **71** | −5 |
| 21/09 | 74 (23/09) — era 77 em 22/09 | **72** | −2 |
| baseline f8586783 inteiro | 1.226 | **1.219** | −7 |

**10 linhas**, o maior sumiço da série — e 3 delas (21/09: 77→74) aconteceram
*durante* a janela cega, entre a ronda de 22/09 e a de 23/09, sem ninguém notar.

A lição de 16/09 dizia "atualize a tabela toda ronda". Ela não previu o modo de
falha real: **a checagem não foi burlada, foi DELETADA na reescrita.** Todas as
minhas defesas vigiam o dado; nenhuma vigia **se a defesa ainda existe**.
Parente direto da lição de 21/09 (o rótulo não é verificado por nenhuma checagem),
um nível acima: lá o *nome* escapava, aqui escapa o *instrumento inteiro*.

> **REGRA NOVA:** script de ronda reescrito herda a LISTA DE CHECAGENS da versão
> anterior, item por item, e a ronda declara quais rodaram. Checagem que some
> numa refatoração é indistinguível de checagem que passou limpa — as duas
> imprimem silêncio. **(e2) restaurada neste script e ela é que achou as 10.**

**Direção do dano (importa):** as falhas seguem **35** e as `qa_coverage` seguem
**16** — inalteradas. Então as 10 linhas apagadas eram todas **SUCESSOS**, e as
taxas dos dias **PIORARAM**, não melhoraram (17/09: 15,79% → **16,90%**).
Não é a direção perigosa (falha apagada = taxa melhora sozinha), mas é a prova
de que o mecanismo está vivo e de que eu estava cego para ele por dois dias.

Mecanismo: o número de **alunos distintos no baseline segue 353**, igual ao que
23/09 registrou. Exclusão de conta (cascade) derrubaria a contagem de alunos —
não derrubou. Logo são **deleções individuais** (`DELETE /api/v1/generations`),
alunos apagando geração própria, não conta inteira.

---

## 1. PASSO 1 — qual régua está no ar

**Nenhum corte novo. A régua canon (`94c2a825`, 21/09 19:27:52Z) segue no ar,
com 3 dias.**

| run | sha | terminou | é corte? |
|---|---|---|---|
| **último** | **`a77c90c9`** | **23/09 15:41:38Z** ✅ | **NÃO** — telemetria |
| anterior | `7dc53d7a` | 23/09 14:16:11Z ✅ | NÃO — telemetria |
| corte vigente | `94c2a825` | **21/09 19:27:52Z** ✅ | **SIM** (grafia conta como coberta) |

Critério, não gatilho — `git diff --numstat a77c90c9^1 a77c90c9`:
`inference.py` 37+/3−, `worker_log.py` 12+/2−, e **184 das 221 linhas são TESTE**
(`test_fase_telemetria.py`, `fase-telemetria.test.ts`).
`grep -inE "qa_cov|coverage|piso|threshold|MIN_COV|0.85|0.65"` no diff: **só**
acertos em `regens`, que é contador de telemetria, e em arquivo de teste.

Diff de produção lido linha a linha: `_STATS_NO_HEARTBEAT` passa de `("regens",)`
para `("regens", "setup_s", "since_t0_s")`, e o provedor de stats vira método pra
recalcular `since_t0_s` ao vivo. Objetivo declarado no próprio commit: num job
morto por SIGKILL, saber se **o setup comeu a base do teto**. Não toca limiar nem
fluxo. ⇒ **o acumulado da régua canon NÃO reinicia.**

`git log a77c90c9..origin/main -- runpod-worker/` → **VAZIO**. Não existe correção
escrita e não deployada; os alunos não estão numa régua velha por atraso de build.

**Piso conferido no BLOB, não na memória** (lição de 21/09): `qa.coverage_min` =
**0.85**, valor ÚNICO em **1.580** gerações com telemetria, e **0.85** também nas
**145** pós-corte canon. O piso não mudou de número.

**Efeito colateral que não é telemetria:** o `saveTemplate` reciclou a frota 0→N
às **15:41Z**. Terceira reciclagem em 4 dias. Entra como contexto no elapsed,
não como régua — medido no §4, **sem anomalia**.

---

## 2. PASSO 2 — os números

| janela | total | falhas | taxa | qa_coverage | alunos atingidos | veredito |
|---|---|---|---|---|---|---|
| **BASELINE** f8586783 (05/09 08:28Z → 21/09 19:27Z) | 1.219 | 18 | 1,48% | 3 (0,25%) | 7/353 | a base |
| 22/09 inteiro (canon, fechado) | 63 | 2 | 3,17% | 1 (1,59%) | 2/35 | 2 eventos |
| **ONTEM 23/09 INTEIRO** (canon, fechado) | **58** | **2** | **3,45%** | **2 (3,45%)** | **1/30** | as 2 são o MESMO aluno |
| ↳ 23/09 depois da reciclagem 15:41Z | 32 | 0 | 0,00% | 0 | 0/19 | contexto |
| HOJE 24/09 até 15:11Z (PARCIAL) | 44 | 0 | 0,00% | 0 | 0/24 | ver §2.2 |
| **ACUMULADO RÉGUA CANON** (21/09 19:27Z → agora) | **193** | 4 | 2,07% | 3 (1,55%) | **2/85** | **não concluo** |

### 2.1 O único p<0,05 da tabela é o número falso

| comparação canon × baseline | razão | Fisher p | célula rara |
|---|---|---|---|
| **gerações com qa_coverage** — 3/193 vs 3/1.219 | **6,32×** | **0,0367** | 3 |
| gerações com falha — 4/193 vs 18/1.219 | 1,40× | 0,5283 | 4 |
| episódios (retry colapsado) — 3/193 vs 11/1.219 | 1,72× | 0,4238 | 3 |
| **alunos atingidos** — 2/85 vs 7/353 | 1,19× | **0,6882** | 2 |
| alunos com qa_coverage — 1/85 vs 3/353 | 1,38× | 0,5795 | 1 |

A manchete disponível era **"qa_coverage subiu 6,3× na régua canon, p=0,037"**.
Ela é **falsa**, e pela razão que a ronda de ontem já tinha escrito: as 3
`qa_coverage` da régua canon são **um aluno, um texto de 1.944ch, três
tentativas**. Contado por aluno vira **1/85 vs 3/353, p=0,58** — nada.

Isto é a lição de 23/09 sendo exercitada **num dia em que ela mudaria o
resultado**, e não só confirmada num dia limpo (2ª lição de 20/09: checagem só se
valida em dia sujo). Hoje ela valeu: **sem ela, esta ronda reportaria uma piora
de régua que não existe.**

### 2.2 Poder — a pergunta antes do critério (lição de 20/09)

Para detectar, no nível do aluno, um efeito real contra a base de 1,98%, com 80%
de poder e α=0,05:

| efeito a detectar | alunos necessários por braço | tenho |
|---|---|---|
| 2× (1,98% → 3,97%) | ~1.151 | **85** |
| 3× (1,98% → 5,95%) | ~379 | **85** |
| 5× (1,98% → 9,92%) | ~139 | **85** |

**Com 85 alunos eu não detecto nem uma régua 5× pior.** Não existe leitura desta
janela que seja conclusiva — nem a favor, nem contra a régua canon. Escrever
"régua canon está boa" seria fabricar desfecho. **INDECIDIDO é o desfecho honesto.**

### 2.3 O 0/44 de hoje não é notícia

Hoje às 15:11Z: **0 falhas em 44**. Parece ótimo e **não significa nada**:

- na taxa canon (2,07%), o esperado em 44 gerações é **0,91 falha** e
  **P(ver zero) = 39,8%**. Na taxa baseline, 51,9%. O resultado mais provável
  de um dia normal é exatamente este.
- **ressalva permanente (lição de 19/09):** as falhas da série concentram-se
  **≥16:00Z**. A ronda roda ~15:1xZ e lê sistematicamente a metade do dia onde
  o problema nunca apareceu. Esta leitura devolveu "0 falhas" **inclusive em
  17/09**, que fechou com 12.
- mesmo horário de ontem: **hoje 0/44 vs ontem 2/24**. Ontem tinha as duas
  falhas do Diego já dentro. Hoje representa ~41% do que um dia inteiro costuma
  ter nesse horário.
- mesmo dia da semana (quintas): 27/08=74, 03/09=68, 10/09=89, 17/09=71.
  Hoje 44 às 15:11Z está na rota normal. **Volume não é anomalia.**

### 2.4 Sanidade e integridade

- **(a) presas hoje: 1** — `ca64be28`, `pending` desde **15:06Z**, 5 minutos na
  leitura. Em voo normal, **não é travamento**.
- **(b) `failed` com `error_message` vazio hoje: 0.**
- **(e) numerador:** `qa_coverage` desde 25/08 = **16** (23/09 registrou 16,
  delta 0); falhas totais = **35** (delta 0). **Nada do numerador sumiu.**
- **(e2) denominador:** ver §0 — **10 linhas apagadas**, todas sucessos.
- **cobertura declarada (regra de 16/09):** (e2) pega sucesso e falha apagados
  no total do dia. **NÃO cobre** linha apagada e reinserida, nem dias anteriores
  a 16/09, que não estão na tabela.

### 2.5 Taxonomia (7 dias) e um falso alarme meu

`qa_coverage` 3× (as 3 do Diego) · `O áudio saiu incompleto` 1× ·
`executionTimeout exceeded` 1×.

O detector marcou `"O áudio saiu incompleto"` como **assinatura inédita**.
**É falso positivo do meu próprio check:** é a falha de **20/09** (28ch,
`larissaoviana@`), já documentada desde a ronda de 21/09 — o caminho em que o
*frontend* reescreve áudio curto (`webhooks/runpod/route.ts:230`). Ela só parece
inédita porque sua ÚNICA ocorrência na tabela cai dentro da janela de 7 dias que
uso como "recente". O check compara contra falhas anteriores à janela e por isso
não consegue ver um padrão raro que estreou dentro dela. **Corrigir amanhã:**
comparar contra a tabela INTEIRA menos a própria linha, não contra o pré-janela.
**Nenhuma assinatura realmente nova.**

---

## 3. PASSO 3 — quem falhou

### 🔴 Diego Vargas — `diegoavnunes@gmail.com` — **TRAVADO, SEGUNDO DIA**

Aluno pagante. `access_until` = **29/09 12:00Z** — **5 dias**.
Histórico completo lido (lição de 19/09: nunca chamar de travado sem ler tudo):

| quando | status | texto | elapsed |
|---|---|---|---|
| 22/09 21:41Z | ready | 97ch | — |
| 22/09 21:47Z | **ready** | **1944ch** | 255,3s |
| 22/09 21:55Z | failed | 1944ch | 128,9s |
| 23/09 11:43Z | failed | 1944ch | 158,8s |
| 23/09 11:48Z | failed | 1944ch | 158,9s |

**Sem nenhuma geração desde 23/09 11:48Z — 27 horas.** Nenhuma transação de
crédito dele depois das 12:31Z de ontem (e essa é do sistema, não dele).
O mesmo texto **passou uma vez e reprovou três**: falha *flaky* sobre entrada
idêntica, não determinística. Os três elapsed (128,9 / 158,8 / 158,9s) estão na
faixa normal de 1600ch+ (mediana 211,4s, p05 95,3s) ⇒ **reprovação de QA, não hang**.

**O indicador de dano é o RETORNO, e ele não retornou.** Estorno não repara: ele
segue sem o áudio, agora com 5 dias de acesso em vez de 6.

**Anomalia de crédito — relato, não mexo** (conferido por `ref_type`, nunca por
`kind`; o `kind` é `extra_purchase`):

| quando | ref_type | valor | ref_id | o que é |
|---|---|---|---|---|
| 22/09 21:47Z | `generation` | −1.944 | `1c761a52` | débito da geração que **DEU CERTO** |
| 22/09 21:55Z | `generation` | −1.944 | `a53e8f7b` | débito da que falhou |
| 22/09 22:00Z | `generation_refund` | +1.944 | `a53e8f7b` | ✅ estorno correto |
| **23/09 12:31Z** | `generation_refund` | **+1.944** | **`1c761a52`** | ❌ estorna a **bem-sucedida** |

As **duas falhas de 23/09 nunca foram debitadas** (não há linha `generation` para
`339d44b8` nem `9094a652`). E o estorno de ontem aponta para a geração que
funcionou. Leitura mais provável: o sistema tentou estornar **uma** das falhas de
23/09 e gravou o `ref_id` errado. No líquido ele **não ficou no prejuízo** — ficou
**+1.944 a favor**, tendo recebido um áudio de 1.944ch de graça. É vazamento de
crédito com trilha de auditoria errada, **na direção oposta** ao card #469
(que era vazamento no estorno de treino). **Não é o mesmo bug.**

### 🟢 Rodrigo Sirahata — `rsirahata@gmail.com` — resolvido, confirmado

`executionTimeout exceeded` (644,3s, hang) em 22/09 12:54Z → estornado 13:15Z
(`generation_refund`, ref correto `342e54a1`) **e voltou**: entregou 17:45Z e
19:50Z do mesmo dia. Recebeu ainda `subscription_grant` de 100.000 em 23/09
13:56Z. Acesso até 16/10. **Retornou ⇒ caso fechado.**

Incidente `d3d8d1b2` (hang) **segue fechado**: 1 ocorrência isolada em 22/09,
nenhuma desde. Não reabro.

Nenhuma conta de admin/sócio entra em nenhuma conta acima.

---

## 4. Elapsed — reciclagem de frota

| grupo | n | mediana | p90 | max |
|---|---|---|---|---|
| `ready` baseline f8586783 | 893 | 95,18s | 173,88s | 378,88s |
| `ready` régua canon | 142 | 94,07s | 174,07s | 347,89s |
| `ready` pós-reciclagem 23/09 15:41Z | 54 | **92,21s** | — | 347,89s |

n=54 já passa do mínimo de 20. Mediana **92,2s** contra 94,1s da régua e 95,2s do
baseline: **nenhuma degradação de cold start** após a terceira reciclagem.
Primeira vez na série que essa medição tem n suficiente pra dizer algo — e ela diz
que o reciclo não está custando nada no tempo de entrega.

---

## 5. Checagens que rodaram nesta ronda (regra nova do §0)

(a) presas · (b) `failed` sem mensagem · (e) numerador que encolhe ·
**(e2) denominador por dia fechado [RESTAURADA]** · piso lido no blob ·
taxonomia 7 dias + assinatura inédita · janelas com n mínimo ·
hoje × mesmo horário de ontem · mesmo dia da semana · episódios (retry colapsado) ·
**alunos como unidade** · Fisher + **poder** · elapsed pareado por faixa de texto ·
histórico inteiro de quem falhou · estorno por `ref_type`.

Script: `/tmp/perf/qacov_2409.cjs` · estatística: `/tmp/perf/_stats_0924.cjs`.

---

## 6. O que NÃO fiz

Não respondi aluno, não mexi em crédito, não fechei nem reabri incidente, não
recriei endpoint do RunPod.
