# Ronda diaria qa_coverage — 2026-09-10

Medido as 15:08Z. Dia LIMPO em falha, mas o achado do dia nao esta na taxa de
falha: esta na telemetria de resgate, que hoje eu consegui ler pela primeira vez.

## 1. Qual regua esta no ar

`gh run list --workflow=runpod-worker.yml`:

| run | sha | conclusao | termino |
|---|---|---|---|
| PR #213 | 2adb080 | **success** | 2026-09-08T15:22:32Z |
| PR #176 | c1db335 | cancelled (ancestral de 2adb080) | 08/09 14:48Z |
| #15 heartbeat | b55db26 | success (telemetria) | 08/09 00:35Z |

**CORTE = 2026-09-08T15:22:32Z (2adb080)** — o MESMO de ontem. Nao houve build
novo em 09/09 nem em 10/09, e `git log 2adb080..origin/main -- runpod-worker/`
saiu **vazio**: nao existe correcao de worker esperando deploy. Nada pendente.

Consequencia no MOLDE (licao de 28/08): o corte caiu **anteontem**. Entao NAO
existe "hoje antes do corte" nem "ontem antes do corte" — ontem e hoje ja sao
regua nova por inteiro. Copiar o molde de ontem (que tinha o corte no dia
anterior) teria produzido uma janela vazia.

2adb080 ja foi confirmado ontem como mudanca de DECISAO (carrega 243aa73 +
80872f5: piso `coverage_espalhada_min=0.65` + gate TERMINAL do resgate), entao
segue valendo como corte. Nao reauditei o diff: o sha nao mudou.

## 2. Sanidade (antes de acreditar em qualquer zero)

- (a) presas em processing/queued hoje: **0** — o zero nao e "ainda nao deu tempo de falhar".
- (b) `failed` com `error_message` vazio hoje: **0** — sem falha invisivel.
- (c) status crus hoje: `{"ready": 43}`.
- (d) `elapsed` NULL em ready desde o corte: 59/225 = **26%** — dentro da faixa
  normal 13-29% encerrada em 08/09. Nao e alarme.

## 3. Janelas

| janela | n | falhas | qa_coverage | >=1000ch | 1500-2500ch |
|---|---|---|---|---|---|
| CONTEXTO 25/08→05/09 (reguas misturadas) | 916 | 13 (1.4%) | 10 | 153 / 7 falhas | 68 / 5 falhas |
| REGUA ANTERIOR eccc3d59 (05/09→08/09) — baseline limpo | 181 | 0 | 0 | 26 / 0 | 14 / 0 |
| dia do corte 08/09 depois do corte | 62 | 0 | 0 | 7 / 0 | 4 / 0 |
| ONTEM 09/09 inteiro (regua nova) | 120 | 0 | 0 | 9 / 0 | 3 / 0 |
| HOJE 10/09 inteiro (regua nova) | 43 | 0 | 0 | 5 / 0 | 2 / 0 |
| **ACUMULADO regua nova (08/09 15:22Z→agora)** | **225** | **0** | **0** | **21 / 0** | **9 / 0** |

**Taxa de falha hoje: 0,0% (0/43).** Ontem: 0,0% (0/120).

### O que conclui e o que NAO conclui

- **Hoje sozinho NAO conclui.** n=43 passa do minimo global, mas a faixa que
  quebra tem **n=5** (>=1000ch). Zero em 5 nao prova nada.
- **A regua nova sozinha ainda NAO conclui.** 0/21 em >=1000ch da teto 95% de
  **14,3%** — larga demais. P(ver 0 mesmo se a taxa fosse a da era ruim, 13,3%)
  = 5%. Ou seja: no limiar, nao confortavel.
- **O que conclui e a serie sem qa_coverage.** Ultima falha de qa_coverage:
  **2026-08-27T17:30Z**. De la pra ca: **1044 geracoes, 0 qa_coverage**, sendo
  **158 na faixa >=1000ch** → teto 95% de **1,9%**. P(ver isso na taxa da era
  ruim) ≈ 0,00%. As 3 falhas do periodo nao foram qa_coverage (1 em 28/08, 2 em
  04/09 = executionTimeout, ja com desfecho confirmado em 07/09).
- Era estavel (05/09→agora): **406 geracoes, 0 falhas de qualquer tipo.**

## 4. O achado do dia: o piso de 0,65 esta funcionando (e da pra provar)

A licao 3 de 09/09 dizia que esta regua **nao se julga pela taxa de falha** — o
piso converte entrega silenciosamente ruim em resgate. Ate hoje eu so conseguia
inferir isso pelo `elapsed`. Hoje descobri que a tabela `generations` tem uma
coluna **`qa`** (JSON com o `qa_stats` do worker) que a lista de colunas da
rotina nao mencionava. Com ela da pra medir o mecanismo direto.

Contadores por regua (jobs com `qa` preenchido: 140 anterior / 166 nova):

| contador | regua ANTERIOR | regua NOVA |
|---|---|---|
| `coverage_espalhada_piso` | 0 jobs (0%) | **10 jobs (6,0%)** |
| `coverage_espalhada_piso_terminal` | 0 jobs (0%) | 6 jobs (3,6%) |
| `coverage_espalhada` (gatilho) | 27 jobs (19,3%) | 30 jobs (18,1%) |
| `coverage_rescued` (total) | 12 jobs (8,6%) | 12 jobs (7,2%) |
| `coverage_exhausted` | 0 | 0 |

**O contador do piso vai de 0 para 10 exatamente no corte.** Isso e confirmacao
INDEPENDENTE de que 2adb080 subiu de verdade em 08/09 15:22Z — nao dependo mais
so do log do Actions pra afirmar qual regua esta no ar.

Dos **10 jobs que bateram no piso: 10 foram resgatados, 0 falharam.** O
`coverage_min_visto` deles tem mediana **0,6** contra **0,938** no resto da
regua nova — ou seja, o piso esta pegando exatamente a cauda baixa que foi
desenhado pra pegar, e nao esta reprovando job bom.

### O teste que importa: entrega silenciosamente ruim

| | jobs com `coverage_min_visto` < 0,65 | resgatados | **entregues SEM resgate** |
|---|---|---|---|
| regua ANTERIOR | 8 (5,7%) | 4 | **4** |
| regua NOVA | 6 (3,6%) | 6 | **0** |

Na regua anterior, **metade** dos jobs de cobertura baixa ia pro aluno sem
resgate (ex.: 6a100d56 e f9280354, ambos 103ch com cobertura 0,455 e 0,435,
entregues `ready` em 08/09 de manha). Na regua nova, **nenhum**.

**Honestidade sobre o n:** 4/8 contra 0/6 e o resultado esperado, mas Fisher
unilateral da **p ≈ 0,07** — sugestivo, NAO provado. Direcao certa, amostra
ainda curta. Preciso de mais uns dias antes de cravar. Nao vou anunciar isso
como vitoria fechada.

### Custo projetado que NAO apareceu

A projecao de 08/09 era "elapsed um pouco maior". Nao aconteceu:

| | mediana | media | p90 |
|---|---|---|---|
| ready regua ANTERIOR (n=140) | 98,4s | 100s | 169,1s |
| ready regua NOVA (n=166) | 96,7s | 99s | 161,5s |
| >=1000ch ANTERIOR (n=26) | 168,9s | 190s | 330,9s |
| >=1000ch NOVA (n=21) | 161,3s | 174s | 278,2s |

Plano-a-plano ou levemente **menor**. O piso saiu de graca ate agora. Com n=21
do lado novo em >=1000ch isso tambem nao e conclusivo, mas afasta a hipotese de
regressao de tempo.

### Ponto em aberto (nao e alarme, e pra olhar amanha)

O total de resgates ficou **plano** (12 jobs → 12 jobs) mesmo com o piso
somando 10. Isso quer dizer que o caminho "organico" de resgate caiu de 12 pra
2 jobs. Duas leituras possiveis: (a) o piso apenas **re-rotula** casos que o
caminho antigo ja pegava, ou (b) mudou a composicao. A tabela de entrega
silenciosamente ruim acima favorece (b) — os 4 casos que vazavam pararam de
vazar — mas com esse n eu **nao sei** dizer qual domina. Fica pra proxima ronda.

Anomalia menor: `f88b149f` (08/09 22:26) tem `text_raw` de **1 caractere**,
cobertura 0, 4 chunks flagados, e saiu `ready`. Nao e falha e nao tem aluno
travado, mas 1ch gerando 4 chunks e estranho. So anotando; nao abri incidente.

## 5. Aluno travado

**Nenhum.** 0 geracoes presas, 0 falhas desde 04/09, 0 falhas de qa_coverage
desde 27/08. Nada a estornar, ninguem esperando. Nao houve caso pra checar em
`credit_transactions` (`ref_type='generation_refund'`) hoje.

## 6. Veredito

- Build: **nao ha nada pendente de deploy**; a regua no ar e a de 08/09.
- Falha: **0% hoje**, e a serie de 1044 geracoes sem qa_coverage e conclusiva
  (teto 1,9% na faixa que quebra).
- Mecanismo: o piso de 0,65 **esta ativo e faz o que prometeu**, com evidencia
  direta de telemetria — sugestivo (p≈0,07), ainda nao provado.
- Nao mexi em credito, nao respondi aluno, nao toquei em incidente, nao
  recriei endpoint.

## Metodo

Scripts: `/tmp/perf/qacov_2026-09-10.cjs` (base + molde do dia),
`/tmp/perf/streak_1009.cjs` (serie e poder estatistico),
`/tmp/perf/resgate_1009.cjs` e `/tmp/perf/piso_1009.cjs` (telemetria `qa`),
`/tmp/perf/silenc_1009.cjs` (entrega silenciosamente ruim).
Supabase paginado de 1000 em 1000; 1322 geracoes lidas desde 25/08.
