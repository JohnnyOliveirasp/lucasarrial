# Ronda diaria — saude do QA de audio (qa_coverage) — 12/09/2026

Rodada em 2026-09-12 15:09Z. Base: `/tmp/perf/qacov.cjs` (versao do dia:
`/tmp/perf/qacov_0912.cjs`). Card do Mission Board: `01840999`.

## Resumo em uma linha

Hoje limpo (0/27), mas o dado do dia e **ontem**: a sequencia de ZERO falhas de
`qa_coverage` que durava desde 28/08 (1107 geracoes) **terminou** em 11/09 20:53Z
com 1 falha. **Nao e piora** — e o que se espera de uma taxa baixa-mas-nao-zero.
Aluno afetado foi estornado e **voltou a gerar com sucesso 5 min depois**.

---

## PASSO 1 — qual regua esta no ar

`gh run list --workflow=runpod-worker.yml`:

| conclusion | headSha | updatedAt |
|---|---|---|
| success | `2adb080` | 2026-09-08T15:22:32Z |
| cancelled | `c1db335` | 2026-09-08T14:48:33Z |
| success | `b55db263` | 2026-09-08T00:35:58Z |
| success | `51c9a8f2` | 2026-09-07T13:36:03Z |
| success | `eccc3d59` | 2026-09-05T08:28:05Z |

- **Ultimo verde segue sendo `2adb080` (08/09 15:22Z).** Nao houve build em 09,
  10, 11 nem 12/09. **A regua no ar tem QUATRO dias.**
- `git log 2adb080..origin/main -- runpod-worker/` saiu **VAZIO**: nao existe
  correcao escrita e nao deployada. Boa noticia, e vale reportar (licao 4 de 10/09).
- Nenhum run falhou nem esta em curso. Nao ha noticia ruim de build.
- **Confirmacao independente no dado** (licao 2 de 10/09): `coverage_espalhada_piso`
  = **0 jobs antes do corte** e **10 jobs depois**. A regua nova esta valendo pros
  jobs de verdade, nao so no Actions.

### Molde das janelas
Corte em 08/09 15:22Z = **quatro dias atras**. Nao existe "hoje antes do corte"
nem "ontem antes do corte". 09, 10, 11 e 12/09 sao regua NOVA por inteiro
(terceira forma do molde, licao de 28/08 ampliada em 10/09). Quem conclui e o
**acumulado**, nao o dia.

---

## PASSO 2 — medicao

### Sanidade (antes de acreditar em qualquer zero)
- (a) presas em processing/queued HOJE: **0** — o zero de hoje nao e "ainda nao deu tempo de falhar".
- (b) `failed` com `error_message` vazio HOJE: **0** — sem falha invisivel.
- (c) status crus hoje: `{"ready":27}`.
- (d) `elapsed` NULL em `ready` na regua nova: 99/396 = **25%** — dentro da faixa
  normal 13-29% (encerrada em 08/09). Sem alarme.

### Janelas

| janela | total | falhas | qa_coverage | >=1000ch | 1500-2500ch |
|---|---|---|---|---|---|
| CONTEXTO 25/08→05/09 (reguas misturadas) | 909 | 13 (1.4%) | 10 (1.1%) | n=153, 7 falhas | n=68, 5 falhas |
| REGUA ANTERIOR `eccc3d59` (05/09→08/09) | 180 | 0 (0.0%) | 0 | n=26, 0 | n=14, 0 |
| 08/09 depois do corte (rabo do dia) | 59 | 0 | 0 | n=5, 0 | n=2, 0 |
| 09/09 inteiro | 119 | 0 | 0 | n=9, 0 | n=3, 0 |
| 10/09 inteiro | 90 | 0 | 0 | n=12, 0 | n=4, 0 |
| **ONTEM 11/09 inteiro** | **102** | **1 (1.0%)** | **1 (1.0%)** | n=15, 0 | n=6, 0 |
| **HOJE 12/09** | **27** | **0 (0.0%)** | **0** | n=6, 0 | n=2, 0 |
| **ACUMULADO regua NOVA (08/09 15:22Z→agora)** | **397** | **1 (0.3%)** | **1 (0.3%)** | n=47, 0 | n=17, 0 |

**Hoje sozinho NAO conclui**: n=27 global e apenas **n=6** na faixa >=1000ch.
Quem sustenta qualquer afirmacao e o acumulado (n=397, n=47 na faixa longa).

### A conta que importa — a sequencia de zero acabou, e isso e esperado

Esta e a parte em que era facil errar pros dois lados, entao calculei antes de
escolher o verbo (licao de 10/09):

1. **A queda de 27/08 foi REAL, nao sorte.** 25-27/08 teve 10/302 = 3,3%. Depois
   vieram 1107 geracoes com zero. P(ver zero em 1107 se a taxa ainda fosse 3,3%)
   = **6,5e-17**. O indicador caiu de verdade naquela correcao.
2. **A falha de ontem NAO indica piora.** A taxa pos-28/08 e ~**0,1%** (1/1172),
   nao zero. Na regua nova (n=397) o esperado nessa taxa e 0,34 falha; observei 1.
   P(ver >=1) = **28,7%**. Completamente banal.
3. Se a taxa tivesse voltado a ser a historica (1,1%), o esperado em 397 seria
   **4,4 falhas** — observei 1. Ou seja, o dado e mais consistente com "continua
   baixa" do que com "voltou ao normal antigo".

> **Correcao ao enquadramento de ontem.** A ronda de 11/09 escreveu "0/1107, o
> indicador ja estava no chao". Hoje fica claro que o indicador nao e **zero**,
> e **raro (~0,1%)**. Ontem eu nao tinha visto a cauda ainda. Falha rara nao e
> falha extinta, e o contador vai voltar a subir de vez em quando sem que nada
> tenha quebrado. Registrar isso agora evita o susto da proxima vez.

### A faixa que quebrava continua sem concluir
Acumulado 0/17 em 1500-2500ch. Taxa historica da faixa = 7,4% →
P(ver zero por sorte) = **27,1%**. **Nao prova melhora na faixa.** Igual a 11/09.
Quem sustenta o quadro limpo e o n global, nao a faixa.

### Tempo (a regua do piso 0.65 se julga pelo tempo, licao 3 de 09/09)

| | mediana | media | p90 | max |
|---|---|---|---|---|
| ready regua ANTERIOR (n=139) | 96,5s | 99s | 169,1s | 357,2s |
| ready regua NOVA (n=297) | 98,0s | 104s | 164,6s | 378,9s |
| >=1000ch ANTERIOR (n=26) | 168,9s | 190s | 330,9s | 357,2s |
| >=1000ch NOVA (n=47) | 160,9s | 169s | 278,2s | 378,9s |

Tempo **estavel**. O custo projetado do piso (elapsed um pouco maior) nao
apareceu de forma relevante; na faixa longa ate melhorou um pouco. Sem regressao
de tempo.

### Mecanismo (coluna `qa`)

| contador | regua ANTERIOR (n=180) | regua NOVA (n=397) |
|---|---|---|
| coverage_espalhada_piso | 0 | **10** |
| coverage_espalhada_piso_terminal | 0 | **8** |
| coverage_rescued | 12 | 13 |
| coverage_rescue_nivel2 | 9 | 13 |
| coverage_exhausted | 0 | **1** |
| tail_healed | 3 | 1 |
| rate_stretched | 49 | 96 |
| regens | 118 | 254 |
| coverage_min_visto (mediana) | 0,917 | 0,923 |

**Recomposicao segue** (licao 3 de 10/09): total de resgate 12 → 13 parece
"sem efeito", mas por sub-caminho o piso soma 10 e o **organico caiu de 12 para 3**.
A populacao trocou por dentro, exatamente como em 10/09.

---

## PASSO 3 — quem falhou

**1 falha, 1 aluno.**

- **Diego Gomes Goudard** — `goudardexecutivo@gmail.com`
  (`4fbe87ff-32a1-4a87-a2a2-8672e380a592`). Nao e admin/socio.
- Geracao `67f28d0f` em 11/09 20:53:39Z, **354ch**, elapsed **234,2s**,
  erro: `qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes`.
- **Estorno confirmado** por `ref_type='generation_refund'` (+400, 20:57:55Z),
  amarrado ao `ref_id` da geracao. (Grava `kind='extra_purchase'` — filtrar por
  `kind` teria escondido.)
- **DESFECHO — a pergunta certa nao e "foi estornado?", e "o aluno conseguiu o
  que queria?"** (licao 2 de 07/09): **SIM.** Refez o MESMO texto de 354ch as
  20:58:43Z (`ready`, 109,7s) e de novo as 21:02:54Z (`ready`, 179,6s), e em
  seguida comprou um video clone (-2100 as 21:03:39Z). **Nao ha aluno pendurado.**
- Observacao lateral: `access_until` dele e **13/09 12:00Z — expira amanha ao meio-dia**.
  Nao e problema de QA, mas e o tipo de coisa que vira reclamacao se ele achar que
  perdeu acesso por causa da falha.

### O que aconteceu tecnicamente (qa da geracao)
`regens=7`, `exhausted=1`, `coverage_min_visto=0`, `coverage_best=0.095`,
`coverage_alucinado=6`, `intrusion_flagged=6`, faltantes: `["em","construcao","lancamentos"]`.
E, o mais chamativo: **`coverage_idioma_detectado="en"`** (prob 0,513,
`coverage_idioma_divergente=2`) num texto em **portugues** ("O litoral esta cheio
de boas oportunidades...").

O gate novo **funcionou e mesmo assim nao salvou**: `coverage_espalhada_piso_terminal=1`
e `coverage_rescue_nivel2=1`, com `coverage_rescue_failed=1`. Foi o **unico**
`coverage_exhausted` das 397 geracoes da regua nova. Ou seja: o piso 0.65 pegou o
caso, tentou o resgate terminal, e o caso era ruim demais. O portao agiu certo ao
reprovar em vez de entregar audio incompleto.

### Checagem de honestidade: "texto curto" NAO e assinatura nova
A tentacao era manchetar "agora quebra em texto curto tambem". Conferi as 11
falhas de `qa_coverage` desde 25/08: **5 sao <1000ch** (275, 63, 63, 621, 354) e
6 sao >=1000ch. Texto curto **sempre** quebrou. Nao ha assinatura nova.

---

## Lead para amanha (PRE-REGISTRADO, nao e achado de hoje)

Olhando o `qa` da falha reparei no `coverage_idioma_divergente`. Varri o campo:

- jobs com divergencia de idioma: **32/1182 (2,7%)**
- **falha com divergencia: 4/32 = 12,5%** | sem divergencia: 9/1150 = 0,8%
- Fisher bilateral **p = 2,7e-4** (sobrevive mesmo corrigindo pelos ~50
  contadores da coluna `qa`: 2,7e-4 x 50 = 0,013)
- `coverage_idioma_corrigido` = 9 no total, mas **0 nos 10 jobs divergentes da
  regua nova** — o caminho de correcao existe e nao esta disparando ultimamente.
- Idiomas detectados: `pt`=158, `en`=15, `es`=4, `nl`/`ru`/`ar`/`id`=1 cada.

**Isto NAO vale como achado de hoje**: escolhi a variavel **depois** de ver o `qa`
da falha — e exatamente o garimpo que a licao de 11/09 manda evitar. O efeito e
grande e sobrevive a correcao dura, o que o torna promissor, mas o teste honesto
e em **dado novo**. Fica **pre-registrado aqui, hoje, antes de medir**:

> **Hipotese H-idioma (pre-registrada 12/09):** `coverage_idioma_divergente > 0`
> associa-se a maior taxa de falha. Testar na ronda de 13/09 **apenas nas
> geracoes novas** (13/09 em diante), sem reaproveitar as 1182 ja vistas.

---

## Conclusao

- **Build:** sem novidade. Ultimo verde `2adb080` de 08/09; regua com 4 dias;
  nada escrito e nao deployado. Sem noticia ruim.
- **Hoje:** 0/27. **Nao conclui sozinho** (n=6 na faixa longa).
- **Acumulado da regua nova (o que conclui):** 1/397 = 0,3%; 0/47 em >=1000ch.
- **A sequencia de zero acabou ontem, e isso era esperado** numa taxa de ~0,1%.
  Nao e piora. P(ver >=1 em 397) = 28,7%.
- **Aluno:** estornado **e** resolvido — gerou com sucesso 5 min depois.
- **Faixa 1500-2500ch:** segue sem concluir (0/17, P=27% por sorte).
- **Tempo e elapsed NULL:** normais.
- Incidente de hang `d3d8d1b2` **nao** reapareceu (nenhuma falha com tempo alto
  anomalo; a de ontem tem 234s, que e tempo de reprovacao, nao de hang).

## Licao do dia

**"Zero" prolongado nao quer dizer "resolvido" — quer dizer "raro".** Eu escrevi
ontem que o indicador "estava no chao" com 0/1107. Bastou um dia pra aparecer a
cauda. A leitura certa de uma sequencia de zeros nao e "acabou", e "a taxa caiu
para algo abaixo do que esse n consegue medir". Quando a cauda aparece, ela nao e
noticia ruim — ela e a confirmacao de que a taxa era baixa, nao nula. O erro de
19-20/08 foi medir a regua errada; este seria o oposto no tempo: tratar ausencia
de evidencia como evidencia de ausencia, e depois me assustar com o retorno normal
do indicador.
