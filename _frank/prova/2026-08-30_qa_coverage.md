# Ronda diaria — saude do QA de audio (qa_coverage)

**Data:** 2026-08-30 · medido as 15:09 UTC (12:09 BRT)
**Veredito:** **dia limpo em qa_coverage** — 0 falhas em 53 geracoes na regua atual,
e **3 dias corridos sem nenhuma reprovacao de cobertura** (a ultima foi 27/08).
O zero passou nas duas checagens de sanidade, entao ele e **real**. Mas:

1. o zero **nao prova cura na regua de ontem** — a faixa que quebra (1500-2500ch) foi
   exercitada **6 vezes**: 60% de chance de ver zero mesmo sem mudanca nenhuma;
2. o que **e** forte e a **serie de 3 dias**: 223 geracoes sem um unico qa_coverage.
   Sob a taxa historica de 2,0% isso teria ~1% de chance de acontecer por sorte;
3. **nenhum aluno travado.** Zero falhas desde 27/08 — nao ha caso a estornar nem a destravar;
4. a **regressao de tempo** que era a manchete de ontem **nao continuou subindo** hoje,
   mas com n=3 na faixa longa **nao dou por resolvida**.

---

## 1. Qual regua esta no ar

| item | valor |
|---|---|
| ultimo run VERDE do `runpod-worker.yml` | `8648927a` |
| terminou (updatedAt) | **2026-08-29T18:32:56Z** |
| conclusao | success — **deploy real** |
| o que era | PR #125 — `feat/ritmo-opcao-do-aluno` |
| commits em `runpod-worker/` depois disso? | **nenhum** (`git log 8648927..origin/main -- runpod-worker/` saiu vazio) |

**Build NAO falhou.** Os 5 ultimos runs sairam verdes. A correcao mais recente esta no ar.

⚠️ **O run durou 8,7 min (18:24 → 18:32), bem abaixo dos 28-52 min normais.** Isso e
suspeito o bastante pra eu nao aceitar de cara, entao conferi os steps um a um:

```
JOB build          [success]  ... Build and push [success]
JOB deploy-runpod  [success]  ... Point template to new image + recycle workers [success]
JOB deploy-runpod-teste [skipped]
```

O caminho completo rodou (GHCR + saveTemplate + reciclagem). O tempo curto e **cache de
layer**: o unico arquivo alterado foi `runpod-worker/jobs/tts_settings.py`, que cai numa
camada tardia do Dockerfile. **Nao foi build pulado.** Registro porque "verde e rapido"
seria facil de confundir com "nao fez nada".

### Molde das janelas

O corte caiu **ontem 18:32Z**, nao hoje. Entao **nao existe** janela "hoje antes do corte"
(sairia vazia): **hoje inteiro ja e regua nova**, e a janela que vale e a **acumulada**
(corte → agora), que tem o melhor n.

⚠️ **Ontem houve DOIS builds verdes** (18:18:09Z e 18:32:56Z), os dois mexendo em
`runpod-worker/`. Logo "ontem antes do corte" **e mistura de reguas** — serve de contexto,
**nao** de baseline limpo. Anoto isso todo dia porque tabelar essa janela como "a regua
anterior" e exatamente o erro que originou esta rotina.

### O que os deploys de ontem mudaram — e por que NAO explicam o zero

Os dois PRs (#124 e #125) mexeram no **QA de RITMO** (`rate_qa`), que agora nasce
**desligado** e virou escolha do aluno na tela:

```python
rate_qa_enabled = bool(inp["rate_qa"]) if inp.get("rate_qa") is not None
                  else _ligado("TTS_RATE_QA", "0")     # <- default DESLIGADO
coverage_qa_enabled = _ligado("TTS_COVERAGE_QA")       # <- default "1", CONTINUA LIGADO
```

**Sao gates diferentes.** O gate que esta rotina mede (cobertura) **segue ligado por
padrao**. Ou seja: a queda de `qa_coverage` **nao** se explica por "desligaram o gate" —
o gate esta la, so nao esta reprovando. Confirmei lendo `tts_settings.py` na main.

---

## 2. Os numeros

| janela | total | falhas | qa_coverage | taxa |
|---|---|---|---|---|
| BASELINE 17/08 → corte (contexto historico) | 1325 | 33 | 27 | **2,0%** |
| ONTEM 29/08 antes do corte (*mistura, so contexto*) | 51 | 0 | 0 | 0,0% |
| ONTEM 29/08 depois do corte (regua atual, so a noite) | 21 | 0 | 0 | 0,0% |
| HOJE 30/08 inteiro (regua atual) | 32 | 0 | 0 | 0,0% |
| **REGUA ATUAL ACUMULADA (corte → agora)** ⬅ **a que vale** | **53** | **0** | **0** | **0,0%** |

Ritmo por dia (pra dimensionar o n): 28/08 = 119 · 29/08 = 72 · 30/08 = 32 ate agora.
Ultima reprovacao de cobertura: **27/08**.

### O zero e real? (as duas checagens de sanidade)

| checagem | resultado |
|---|---|
| (a) geracoes presas em `processing`/`queued` | **0** — os 53 estao `ready`. O zero nao e "ainda nao deu tempo de falhar" |
| (b) `status=failed` com `error_message` vazio (falha invisivel) | **0** no periodo inteiro |

**O zero passou.** Nao e artefato de medicao.

### Mas o zero e CONCLUSIVO? Nao — o n da faixa que quebra e 6

A regra do denominador diz pra olhar o n **da faixa que quebra**, nao o n global:

| faixa | historico | agora | P(ver 0 sem mudanca) | teto 95% | veredito |
|---|---|---|---|---|---|
| <1000ch | 1,2% (13/1087) | 0/38 | 63% | 7,6% | **nao conclusivo** |
| 1000-1500ch | 2,8% (5/179) | 0/9 | 77% | 28,3% | **nao conclusivo** |
| **1500-2500ch** ⬅ a que quebra | **8,1% (9/111)** | **0/6** | **60%** | **39,3%** | **nao conclusivo** |
| GLOBAL | 2,0% | 0/53 | 35% | **5,5%** | **nao conclusivo** |

Leitura honesta: mesmo no global, o teto de 95% e **5,5%** — ou seja, a taxa verdadeira
ainda pode ser **maior** que a historica de 2,0%. Com 0/53 eu **nao posso anunciar melhora**
pela regua de ontem. Errar pra mais custa tanto quanto errar pra menos.

### O que E forte: a serie de 3 dias

Isso atravessa varias reguas, entao **nao da pra creditar ao deploy de ontem** — mas o
conjunto e dificil de explicar por sorte:

- desde 28/08 00:00: **223 geracoes, 0 qa_coverage**
- sob a taxa historica de 2,0%, esperava-se ~4,5 reprovacoes
- P(ver 0 em 223 se nada tivesse mudado) ≈ **1,1%**

**A cobertura melhorou de verdade em algum ponto entre 27 e 28/08.** O que ainda nao da
pra dizer e *qual* mudanca fez isso, nem se a faixa 1500-2500ch especificamente esta curada.

---

## 3. Quem falhou

**Ninguem.** Zero falhas de qualquer tipo desde 27/08. Nao ha aluno travado, nao ha
estorno a conferir (`ref_type='generation_refund'`), nao ha ninguem esperando audio.

---

## 4. Tempo (a manchete de ontem)

Ontem o achado principal nao foi a taxa, foi o **tempo subindo em direcao ao teto (~491s)**.
Hoje:

| dia | n | p50 | p90 | max | >400s | >491s (teto) |
|---|---|---|---|---|---|---|
| 27/08 | 66 | 107s | 198s | 365s | 0 | 0 |
| 28/08 | 93 | 101s | 226s | 492s | 2 | **1** |
| 29/08 | 57 | 79s | 175s | 410s | 1 | 0 |
| **30/08** | **27** | **71s** | **178s** | **369s** | **0** | **0** |

So texto longo (>=1500ch), onde o esticador pesa: p50 **256s** (28/08) → **308s** (29/08)
→ **120s** (30/08).

**Nao subiu hoje, e nada encostou no teto.** Mas a faixa longa teve **n=3** hoje — isso e
pequeno demais pra declarar a regressao de tempo resolvida. Fica em observacao.

Sobre **hang** (incidente `d3d8d1b2`, fechado como aceite de risco): a assinatura do hang e
**falha com tempo muito alto**. Hoje **nao houve nenhuma falha**, e a geracao mais lenta
(369s) **concluiu normalmente**. **Nao ha motivo pra reabrir.** (A de 410s de ontem tambem
concluiu — `ready`.)

---

## 5. O que fica pra amanha

- A faixa **1500-2500ch** segue com n baixo (6 na regua atual). So o acumulo de dias vai
  responder se ela esta curada. **Nao anunciar cura antes disso.**
- **Tempo na faixa longa** continua em observacao — hoje caiu, mas com n=3.
- Se voltar reprovacao de cobertura, comparar contra a serie limpa 28-30/08, nao contra
  o baseline de 17/08.

**Medido com:** `/tmp/perf/qacov-2026-08-30.cjs`, `/tmp/perf/sanidade-faixa-2026-08-30.cjs`,
`/tmp/perf/tempo-2026-08-30.cjs` (paginacao de 1000 em 1000; colunas reais de `generations`;
erro cru impresso antes de acreditar em qualquer zero).
