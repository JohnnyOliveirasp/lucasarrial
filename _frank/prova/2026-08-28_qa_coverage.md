# Ronda diaria — saude do QA de audio (qa_coverage)

**Data:** 2026-08-28 · medido as 15:09 UTC (12:09 BRT)
**Veredito:** **dia limpo** — 0 falhas em 72 geracoes na regua atual. Mas duas ressalvas
que valem mais que o zero:
1. o zero **ainda nao prova cura** (47% de chance de ser sorte na faixa que quebrava);
2. apareceu uma **piora real e mensuravel de tempo** — texto longo quase dobrou de duracao,
   e essa e estatisticamente solida (p < 0.0001).

---

## 1. Qual regua esta no ar

| item | valor |
|---|---|
| ultimo run VERDE do `runpod-worker.yml` | `965557a8` |
| terminou (updatedAt) | **2026-08-27T19:22:21Z** |
| conclusao | success (deploy real: GHCR + saveTemplate + reciclagem dos workers) |
| o que era | PR #70 — `fix/inc52-resgate-nivel-2` |
| commits em `runpod-worker/` depois disso? | **nenhum** (`git log 965557a8..origin/main -- runpod-worker/` saiu vazio) |

**Build NAO falhou.** A correcao mais recente esta no ar.

⚠️ **O molde das janelas muda hoje.** O build verde terminou **ontem as 19:22Z**, nao hoje.
Entao **nao existe** janela "hoje antes do build" — **hoje inteiro ja e regua nova**. Copiar o
molde de ontem (ontem / hoje-antes / hoje-depois) produziria uma janela vazia e um recorte errado.
As janelas abaixo foram refeitas para a realidade de hoje.

Isto e exatamente o erro de 19-20/08 que originou esta rotina: **medir a regua errada**. A data do
corte vem do `updatedAt` do build, e o molde vem de onde esse corte cai — nao de habito.

---

## 2. Numeros (denominador na mao)

| janela | total | falhas | qa_coverage | taxa |
|---|---:|---:|---:|---:|
| Baseline 17/08 → 27/08 (historico) | 1127 | 26 | 21 | **2.3%** |
| ONTEM 27/08 **antes** do build 19:22Z (regua anterior, PR #63) | 61 | 6 | 6 | **9.8%** |
| ONTEM 27/08 **depois** do build 19:22Z (regua atual, so a noite) | 21 | 0 | 0 | 0.0% |
| **HOJE 28/08 inteiro (regua atual)** | **51** | **0** | **0** | **0.0%** |
| **REGUA ATUAL ACUMULADA (27/08 19:22Z → agora)** | **72** | **0** | **0** | **0.0%** |

A janela que vale e a **acumulada** (n=72), nao "hoje" sozinho (n=51). O corte caiu no meio de
ontem; separar os dois lados do mesmo deploy so encolheria o denominador sem ganhar nada.

### Sobre os 9.8% de ontem: e um numero enganoso

As **6 falhas de ontem foram todas do mesmo aluno**, em **29 minutos** (17:01→17:30Z). Nao foi uma
taxa distribuida de 9.8% batendo em varias pessoas — foi **uma pessoa** tentando repetidamente com
textos longos e apanhando 6 vezes seguidas. Ler "9.8% de falha ontem" como saude geral da
plataforma seria errado.

---

## 3. O zero de hoje autoriza dizer que melhorou? **Nao.**

Este e o ponto central. Testei contra a taxa historica de cada faixa:

| recorte | taxa historica | regua nova | P(ver 0 falhas mesmo se NADA mudou) | teto real (95%) | conclusivo? |
|---|---:|---:|---:|---:|---|
| todas as geracoes | 2.69% (32/1189) | 0/72 | **14%** | 4.1% | **nao** |
| texto ≥1000ch (o caso que quebrava) | 5.81% (15/258) | 0/17 | **36%** | 16.2% | **nao** |
| texto 1500-2500ch (a faixa pior) | 10.31% (10/97) | 0/7 | **47%** | 34.8% | **nao** |

Em todos os tres, a taxa historica **cabe dentro** do intervalo compativel com o que observei.
Nao da pra distinguir cura de acaso.

### A amostra e menor do que o n=72 sugere

O n=72 parece confortavel, mas **as falhas nunca foram uniformes**: elas se concentram em texto
longo. E texto longo foi exercitado pouco desde o deploy:

| faixa de texto | n ANTES | falhas ANTES | n DEPOIS | falhas DEPOIS |
|---|---:|---:|---:|---:|
| 0-200ch | 489 | 5 (1.0%) | 26 | 0 |
| 200-600ch | 227 | 8 (3.5%) | 22 | 0 |
| 600-1000ch | 215 | 4 (1.9%) | 7 | 0 |
| 1000-1500ch | 161 | 5 (3.1%) | 10 | 0 |
| **1500-2500ch** | **97** | **10 (10.3%)** | **7** | **0** |

**Traducao:** a faixa que realmente quebrava (1500-2500ch) rodou **7 vezes** desde a correcao.
Jogar uma moeda 7 vezes e nao tirar coroa nao prova que a moeda nao tem coroa. Precisa de mais
2-3 dias de acumulo. **Errar pra mais custa tanto quanto errar pra menos.**

---

## 4. O que NAO estava sendo olhado: o tempo piorou, e esse achado e solido

A correcao passa regerando o audio ate a cobertura fechar. Isso tem preco, e o preco apareceu:

| recorte (so `status=ready`) | mediana ANTES | mediana DEPOIS | p90 ANTES | p90 DEPOIS |
|---|---:|---:|---:|---:|
| todas | 79s (n=889) | **100s** (n=54) | 145s | 242s |
| texto ≥1000ch | 116s (n=243) | **215s** (n=17) | 181s | 368s |
| texto 1500-2500ch | 133s (n=87) | **261s** (n=7) | 226s | 411s |

Ao contrario da taxa de falha, **aqui da pra concluir**:

- a mediana de depois (215s) e o **percentil 95** da distribuicao de antes — ou seja, o caso
  tipico de hoje era caso extremo ontem;
- **Mann-Whitney U: z=4.24, p<0.0001.** A lentidao **nao e acaso**, mesmo com n=17.

O efeito e grande o bastante para superar o n pequeno. Isso e o oposto do caso da taxa de falha,
e por isso os dois recebem vereditos diferentes neste relatorio.

**Leitura honesta:** a correcao aparentemente **trocou falha por espera**. Em vez de reprovar o
audio, ela regenera ate passar. Para o aluno isso e melhor que receber erro — mas texto longo
que levava ~2min agora leva ~3.5-4min, e ninguem decidiu conscientemente pagar esse preco.

### Um caso passou de 400s

`2026-08-28T03:26:28Z` · 1611ch · **411.09s** · `status=ready`.

Cruza o limiar de 400s do incidente **d3d8d1b2** (hang), mas **nao e hang**: completou com
sucesso. Hang nao termina. E uma geracao lenta, coerente com a piora de tempo acima — nao com o
bicho do d3d8d1b2. Antes do build: 4 casos >400s em 1189 (0.34%). Depois: 1 em 72 (1.4%), n
pequeno demais pra chamar de tendencia por si so.

**Nao reabri o incidente** (fora do meu escopo, e a evidencia aponta pra outra coisa). Fica
registrado pro Johnny decidir.

---

## 5. Quem falhou

Nenhum aluno falhou na regua atual. As 6 falhas de ontem (regua anterior):

| item | valor |
|---|---|
| aluno | **RONALD LENZ** — `ronald.lenz@lenzcontabilidade.com.br` |
| acesso ate | 2026-09-03 |
| falhas | 6, todas `qa_coverage`, entre 17:01 e 17:30Z |
| tamanho dos textos | 1169, 1598, 1773, 1826, 1921, 1999 ch — **todos na faixa pior** |
| tempos | 145-241s — **todos normais**, entao e reprovacao do QA, nao hang |
| estorno | **6 de 6 estornadas**, conferido por `ref_type='generation_refund'` (10.286 cr) |

Nao e conta de admin/socio, entao entra na conta normalmente.

### Ele esta destravado? Parcialmente — e a ressalva importa

Ronald voltou a gerar as 22:03 e 22:07Z de ontem, **duas geracoes com sucesso**. Entao ele **nao
esta travado agora** e nao precisa de atendimento.

**Mas:** as duas geracoes de sucesso tinham **59 caracteres**. As que falharam tinham **1169-1999**.
Ele nao repetiu o trabalho que perdeu — testou algo curto. Ou seja:

- ele foi estornado e nao esta bloqueado; **e**
- **o caso dele especificamente continua sem prova de que funciona**, e ele ainda nao tem o audio
  longo que veio buscar.

Estorno devolve credito, nao devolve o trabalho. Registro isso porque "6 de 6 estornadas" sozinho
faz o caso parecer mais fechado do que esta.

---

## 6. Ritmo diario (pra dimensionar o n esperado)

| dia | total | falhas | qa_coverage |
|---|---:|---:|---:|
| 17/08 | 102 | 0 | 0 |
| 18/08 | 127 | 2 | 0 |
| 19/08 | 105 | 4 | 4 |
| 20/08 | 135 | 4 | 4 |
| 21/08 | 67 | 0 | 0 |
| 22/08 | 96 | 0 | 0 |
| 23/08 | 100 | 5 | 4 |
| 24/08 | 144 | 7 | 5 |
| 25/08 | 134 | 1 | 1 |
| 26/08 | 118 | 3 | 3 |
| 27/08 | 82 | 6 | 6 |
| **28/08 (parcial, ate 15:09Z)** | **51** | **0** | **0** |

~100-140 geracoes/dia, das quais so ~20-25% sao texto ≥1000ch. Por isso a faixa critica acumula
devagar: **espera-se ~25-30 geracoes longas por dia**, e so ~7-8 na faixa 1500-2500ch.
Para ter n conclusivo na faixa pior, sao precisos **~3-4 dias** de regua estavel.

---

## 7. O que fica pra amanha

1. **Continuar acumulando** na regua `965557a8`. A faixa 1500-2500ch precisa chegar em ~30 casos
   antes de qualquer declaracao de cura. Hoje tem 7.
2. **Vigiar o tempo.** Se a mediana de texto longo ficar em ~215s, isso e uma regressao de
   experiencia que ninguem aprovou, e merece decisao do Johnny (aceitar ou limitar regeneracoes).
3. **Ronald Lenz** — se ele repetir um texto longo, essa geracao e o teste mais informativo
   disponivel. Vale olhar.

## Como reproduzir

```
node /tmp/perf/qacov-2026-08-28.cjs        # janelas + falhas cruas
node /tmp/perf/quem-falhou-2026-08-28.cjs  # perfil, estorno por ref_type, destravou?
node /tmp/perf/faixa-texto-2026-08-28.cjs  # distribuicao por tamanho de texto
node /tmp/perf/stats-2026-08-28.cjs        # conclusividade + Mann-Whitney do tempo
```

Paginacao de 1000 em 1000 (`.range`), erro impresso CRU antes de acreditar em qualquer zero.
Colunas usadas em `generations`: `id, user_id, status, error_message, created_at, text_raw,
elapsed_seconds`. Estorno **so** por `ref_type='generation_refund'` — filtrar por `kind` mente
(o estorno grava `kind='extra_purchase'`, visivel na tabela da secao 5).
