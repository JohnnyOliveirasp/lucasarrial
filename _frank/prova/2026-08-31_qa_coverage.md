# Ronda diaria — saude do QA de audio (qa_coverage)

**Data:** 2026-08-31 · medido as 15:09 UTC (12:09 BRT)
**Veredito:** **dia limpo** — 0 falhas em 46 geracoes hoje, e **4 dias corridos sem
nenhuma reprovacao de cobertura** (a ultima foi 27/08). O zero passou nas duas
checagens de sanidade, entao e **real**. Mas:

1. **nao houve deploy hoje nem ontem** — a regua e a mesma de anteontem. Nada mudou
   no que estou medindo; o que mudou foi so o acumulo de evidencia;
2. o zero **ainda nao e conclusivo pela janela da regua atual**: mesmo no global
   (0/133) o teto de 95% e **2,23%**, ou seja *acima* da taxa historica de 2,0%.
   Formalmente eu **nao posso anunciar cura** por esta janela;
3. o que **e** forte e a **serie de 4 dias**: 298 geracoes, 0 qa_coverage,
   P ≈ **0,27%** de acontecer por sorte. Ficou ~4x mais forte que ontem (era 1,1%);
4. **nenhum aluno travado.** Zero falhas de qualquer tipo desde 28/08;
5. ⚠️ **ponto de atencao novo:** a geracao mais lenta de hoje bateu **479,6s**, a
   **12 segundos** do teto de 491s que ja derrubou uma geracao em 28/08. Concluiu
   `ready`, entao **nao e hang** — mas e a mais proxima do teto desde entao, e a
   faixa longa teve **n=1**. Registro como vigilancia, nao como problema.

---

## 1. Qual regua esta no ar

| item | valor |
|---|---|
| ultimo run VERDE do `runpod-worker.yml` | `8648927a` |
| terminou (updatedAt) | **2026-08-29T18:32:56Z** — **anteontem** |
| conclusao | success |
| builds novos desde entao | **nenhum** (os 5 ultimos runs sao todos ≤ 29/08) |
| commits em `runpod-worker/` depois disso? | **nenhum** (`git log 8648927..origin/main -- runpod-worker/` vazio) |

**Build NAO falhou e nao ha nada pendente de subir.** A correcao mais recente
segue no ar, exatamente a mesma que foi medida ontem.

### Molde das janelas — caso NOVO, registrado como licao

Os moldes ja documentados cobriam *corte caiu HOJE* e *corte caiu ONTEM*. Hoje
apareceu o terceiro caso: **dia sem deploy nenhum, corte caiu ANTEONTEM**.
Consequencias:

- **nao existe** "hoje antes do corte" (sairia vazia);
- **nao existe** split de ontem — ontem inteiro ja e regua nova;
- **ontem e hoje sao a MESMA regua** → pela primeira vez da pra comparar
  ontem-vs-hoje **limpo**, sem mistura. Nas rondas anteriores essa comparacao
  era proibida porque as janelas atravessavam deploys;
- a **acumulada** (corte → agora) segue sendo a de melhor n.

Anoto porque copiar o molde de ontem teria produzido janelas vazias — que e
exatamente a familia de erro que originou esta rotina.

---

## 2. Os numeros

| janela | total | falhas | qa_coverage | taxa |
|---|---|---|---|---|
| BASELINE 17/08 → corte (regua VELHA, contexto) | 1371 | 33 | 27 | **2,0%** |
| ONTEM 30/08 inteiro (regua atual) | 66 | 0 | 0 | 0,0% |
| HOJE 31/08 ate agora (regua atual) | 46 | 0 | 0 | 0,0% |
| **REGUA ATUAL ACUMULADA (corte → agora)** ⬅ **a que vale** | **133** | **0** | **0** | **0,0%** |

Ritmo por dia: 27/08 = 82 · 28/08 = 119 · 29/08 = 67 · 30/08 = 66 · 31/08 = 46 ate agora.
**Ultima reprovacao de cobertura: 27/08.** Ultima falha de *qualquer* tipo: 28/08.

**Ontem vs hoje:** 0/66 → 0/46. Mesma regua, os dois zerados. Nao subiu nem desceu;
nao ha movimento a explicar.

### O zero e real? (as duas checagens de sanidade)

| checagem | resultado |
|---|---|
| (a) presas em `processing`/`queued` | **2**, com **1,5 e 3,0 minutos** de idade — em voo, nao presas. O zero nao e "ainda nao deu tempo de falhar" |
| (b) `status=failed` com `error_message` vazio (falha invisivel) | **0** no periodo inteiro (1505 geracoes) |

**O zero passou.** Nao e artefato de medicao.

### Mas o zero e CONCLUSIVO? Nao — nem no global

Aplicando a regra do denominador na faixa que quebra, e tambem no global:

| faixa | historico | regua atual | P(ver 0 sem mudanca) | teto 95% | veredito |
|---|---|---|---|---|---|
| <1000ch | 1,2% (13/1082) | 0/106 | 28% | 2,8% | **nao conclusivo** |
| 1000-1500ch | 2,8% (5/179) | 0/14 | 67% | 19,3% | **nao conclusivo** |
| **1500-2500ch** ⬅ a que quebra | **8,1% (9/111)** | **0/13** | **33%** | **20,6%** | **nao conclusivo** |
| GLOBAL | 2,0% (27/1371) | 0/133 | 7% | **2,23%** | **nao conclusivo** |

Leitura honesta: o teto global de 95% e **2,23%**, que ainda e **maior** que a taxa
historica de 2,0%. Ou seja, pela janela da regua atual sozinha, a taxa verdadeira
**pode nao ter mudado nada**. Falta pouco — mais uns 2 dias de volume levam o teto
abaixo de 2,0% — mas hoje ainda **nao da pra anunciar melhora por esta janela**.

### O que E forte: a serie de 4 dias

Atravessa varias reguas, entao **nao da pra creditar a nenhum deploy especifico** —
mas e dificil de explicar por sorte:

- desde 28/08 00:00: **298 geracoes, 0 qa_coverage**
- esperado sob a taxa historica de 2,0%: **~5,9** reprovacoes
- P(ver 0 em 298 se nada tivesse mudado) ≈ **0,27%**

Ontem essa mesma conta dava 1,1% com n=223. Com mais um dia limpo ela ficou ~4x
mais forte. **A cobertura melhorou de verdade em algum ponto entre 27 e 28/08.**
O que ainda nao da pra dizer e *qual* mudanca fez isso, nem se a faixa
1500-2500ch especificamente esta curada (n=13 na regua atual).

---

## 3. Quem falhou

**Ninguem.** Zero falhas de qualquer tipo desde 28/08. Nao ha aluno travado, nao
ha estorno a conferir (`ref_type='generation_refund'`), nao ha ninguem esperando audio.
As 2 geracoes em `pending` no momento da medicao tinham 1,5 e 3,0 minutos — estao
em voo, dentro do tempo normal (p50 de hoje = 64s).

---

## 4. Tempo — o ponto de atencao do dia

| dia | n | p50 | p90 | max | >400s | >491s (teto) | LONGO ≥1500ch (n / p50) |
|---|---|---|---|---|---|---|---|
| 27/08 | 66 | 107s | 198s | 365s | 0 | 0 | 7 / 195s |
| 28/08 | 93 | 101s | 226s | **492s** | 2 | **1** | 11 / 256s |
| 29/08 | 52 | 79s | 175s | 410s | 1 | 0 | 4 / 308s |
| 30/08 | 55 | 71s | 171s | 369s | 0 | 0 | 9 / 122s |
| **31/08** | **33** | **64s** | **159s** | **480s** | **2** | **0** | **1 / 480s** |

**O p50 continua caindo** (107 → 101 → 79 → 71 → 64s). Essa parte esta boa.

⚠️ **Mas a cauda subiu:** hoje teve **2 geracoes acima de 400s**, e a maior bateu
**479,64s** — a **12 segundos** do teto. Contexto de todas as >350s desde 26/08:

```
28/08 491,6s | 206ch  | FAILED "executionTimeout exceeded"   <- o unico estouro
31/08 479,6s | 1794ch | ready                                <- hoje, quase la
26/08 461,2s | 2000ch | ready
28/08 411,1s | 1611ch | ready
29/08 410,2s | 1329ch | ready
31/08 400,3s | 1391ch | ready                                <- hoje
```

Leitura: **nao e hang.** A assinatura de hang (incidente `d3d8d1b2`, fechado como
aceite de risco) e **falha** com tempo muito alto; a de hoje **concluiu `ready`**.
**Nao ha motivo pra reabrir o incidente.** Mas o teto de 491s ja derrubou uma
geracao em 28/08, e hoje passamos a 12s dele — com **n=1 na faixa longa**, o que e
pequeno demais pra chamar de tendencia. Fica em **vigilancia explicita** pra amanha.

(Nota de medicao: 11 geracoes de hoje tem `elapsed_seconds` nulo, todas `ready` e
todas de 103ch — nao sao falhas, so nao entram nas estatisticas de tempo.)

---

## 5. O que fica pra amanha

- **Teto global:** faltam ~2 dias de volume pra o teto de 95% cair abaixo de 2,0% e
  a melhora virar conclusiva **pela propria regua atual**, sem depender da serie.
  Se seguir limpo, amanha ou depois da pra afirmar com a janela limpa.
- **Faixa 1500-2500ch:** n=13 na regua atual, teto 20,6%. **Nao anunciar cura.**
- **Cauda de tempo:** hoje 479,6s (12s do teto) com n=1 na faixa longa. Se amanha
  aparecer outra encostando em 491s, isso vira o achado principal e merece chamado.
- Se voltar reprovacao de cobertura, comparar contra a serie limpa 28-31/08, nao
  contra o baseline de 17/08.

**Medido com:** `/tmp/perf/qacov-2026-08-31.cjs` e `/tmp/perf/tempo-2026-08-31.cjs`
(paginacao de 1000 em 1000; colunas reais de `generations`; erro cru impresso antes
de acreditar em qualquer zero).
