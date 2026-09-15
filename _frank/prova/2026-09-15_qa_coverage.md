# Ronda diária qa_coverage — 2026-09-15 (terça)

Medição às 15:14Z. Script: `/tmp/perf/qacov-2026-09-15.cjs` (saída completa em
`/tmp/perf/out-0915.txt`, 343 linhas, exit=0).

**Resumo:** dia limpo (0/56). Dois builds verdes hoje, mas **nenhum dos dois é
corte de régua** pro qa_coverage — o acumulado NÃO reinicia. Nenhum aluno
travado. Um achado que muda pendência: o alvo do pré-registro H-idioma (600
gerações, 20/09) **não entrega poder** e precisa ser recalculado.

---

## PASSO 1 — Qual régua está no ar

`gh run list --workflow=runpod-worker.yml` mostrou **dois verdes hoje**, os
primeiros desde 08/09:

| SHA | Fim (updatedAt) | Conclusão |
|---|---|---|
| `7b673a7` | 2026-09-15T02:44:36Z | success |
| `b2d9f47` | 2026-09-15T03:49:41Z | success |

Nenhum falhou, nenhum está `in_progress`. **Mas verde não é corte** (lições de
07/09 e 08/09). Os dois são commits únicos (squash), não merges — checado via
`git log -1 --format='%P'`, então o buraco de 09/09 (`--stat` de merge esconde o
ramo) não se aplica. O numstat em `runpod-worker/`:

- **`b2d9f47`** — "telemetria: por qual caminho a referência da voz foi cortada":
  `jobs/train.py` 4+/0-, `jobs/train_reference.py` 28+/4-,
  `voice_pipeline/reference.py` 65+/14-, `voice_pipeline/__init__.py` 10+/0-,
  testes 234+/6-. As 14 remoções em `reference.py` são refactor do ranking
  (type hints, `_rank_pass` reestruturado) mais telemetria do caminho do corte.
  Caminho de **treino de voz**.
- **`7b673a7`** — "amostra pós-treino: texto neutro entre PT-BR e PT-PT":
  `sample_gen.py` 22+/2-, teste 86+/1-. Amostra **pós-treino**.

A checagem que decide:

```
git log 2adb080..origin/main -- runpod-worker/inference.py runpod-worker/tts_settings.py
(vazio)
```

**`inference.py` e `tts_settings.py` estão intocados desde 08/09.** O portão de
qa_coverage não foi mexido. Os dois builds tocam treino de voz e amostra
pós-treino, que são outro caminho.

> **Régua no ar: `2adb080` (08/09 15:22:32Z) — SETE dias.**
> `git log b2d9f47..origin/main -- runpod-worker/` saiu **vazio**: não existe
> correção escrita e não deployada.

### Contradição com a prova de ontem, e por que ontem estava errado

Em 14/09 eu deixei escrito: *"se aparecer build verde novo em `runpod-worker/`, o
acumulado de 539 reinicia — anotar na hora"*. Hoje apareceram dois verdes e eu
**não** reiniciei o acumulado. O atalho que eu mesmo escrevi é falso: ele pula
exatamente a etapa que as lições de 07/09 e 08/09 mandam fazer (ler o diff antes
de chamar de corte). Se eu tivesse obedecido o meu próprio bilhete, teria partido
a janela em 03:49Z, ficado com **n=27** do lado "novo" e concluído nada — contra
os 648 do pool real. Seria medir a régua errada pela quarta vez, agora por
obediência a uma nota minha em vez de ao commit ou ao build.

**Confirmação independente no dado** (regra de 10/09): `coverage_espalhada_piso`
= 0 jobs na régua anterior e **16** na régua nova, e
`coverage_espalhada_piso_terminal` = 0 → **11**. Os contadores do `2adb080`
aparecem só depois do corte de 08/09, e nada novo aparece depois de 03:49Z hoje.
A régua vigente está confirmada pelos jobs, não só pelo `gh run list`.

---

## PASSO 2 — Medição

### Sanidade (antes de acreditar em qualquer zero)

| Checagem | Resultado |
|---|---|
| (a) presas em processing/queued HOJE | **0** — o zero não é "ainda não deu tempo de falhar" |
| (b) `failed` com `error_message` vazio HOJE | **0** — sem falha invisível |
| (c) status crus HOJE | `{"ready": 56}` |
| (d) `elapsed` NULL em `ready` na régua nova | 168/647 (**26%**) — dentro da faixa normal 13-29%, encerrada em 08/09. Sem alarme. |

### (e) Denominador que encolhe — checagem fixa (lição 2 de 13/09)

| Filtro (desde 25/08) | Hoje | 14/09 registrou | Δ |
|---|---|---|---|
| `qa_coverage` | 11 | 11 | **0** |
| Falhas totais | 14 | 14 | **0** |

Nenhuma linha de falha de período fechado sumiu. A taxa não melhorou por
apagamento. (O rótulo impresso pelo script diz "13/09 registrou" — texto
desatualizado no script; os valores 11/14 são os que **14/09** deixou, e batem.)

### Janelas

Molde: corte em 08/09, **sete dias atrás** → terceira forma da lição de 28/08.
Não existe "hoje antes do corte" nem "ontem antes do corte". Quem conclui é o
acumulado.

| Janela | Total | Falhas | qa_cov | Taxa | ≥1000ch | 1500-2500ch |
|---|---|---|---|---|---|---|
| Contexto 25/08→05/09 (réguas misturadas) | 902 | 13 | 10 | 1,4% | 7/153 | 5/68 |
| Régua anterior `eccc3d59` (baseline limpo) | 180 | 0 | 0 | 0,0% | 0/26 | 0/14 |
| 09/09 | 118 | 0 | 0 | 0,0% | 0/9 | 0/3 |
| 10/09 | 90 | 0 | 0 | 0,0% | 0/12 | 0/4 |
| 11/09 | 100 | 1 | 1 | 1,0% | 0/14 | 0/5 |
| 12/09 | 74 | 0 | 0 | 0,0% | 0/22 | 0/5 |
| 13/09 | 50 | 0 | 0 | 0,0% | 0/14 | 0/4 |
| 14/09 (ontem) | 101 | 0 | 0 | 0,0% | 0/23 | 0/3 |
| **15/09 até 15:14Z (hoje)** | **56** | **0** | **0** | **0,0%** | 0/12 | **0/0** |
| — hoje antes do build 03:49Z (contexto) | 29 | 0 | 0 | 0,0% | 0/5 | 0/0 |
| — hoje depois do build 03:49Z (contexto) | 27 | 0 | 0 | 0,0% | 0/7 | 0/0 |
| **ACUMULADO régua nova (08/09 15:22Z →)** | **648** | **1** | **1** | **0,2%** | **0/111** | **0/26** |

As duas linhas "antes/depois do build" estão aí **como contexto rotulado**, não
como divisor de régua — é a forma que a lição de 07/09 manda usar pra build que
não muda decisão.

### O que dá e o que não dá pra concluir

- **Hoje não conclui sozinho.** n=56 é acima do piso de 20, mas a faixa que
  quebra tem **n=0** em 1500-2500ch e n=12 em ≥1000ch. Hoje literalmente não
  testou a faixa que historicamente falha. "0% hoje" é verdade e é irrelevante
  isolado.
- **O acumulado sustenta a leitura, com a mesma ressalva de sempre.** 0/111 em
  ≥1000ch é o número que segura. Mas em 1500-2500ch são **0/26**, e
  P(ver zero por sorte na taxa histórica de 7,4%) = **13,5%** — ou seja, nem o
  acumulado prova melhora *naquela faixa*. Quem sustenta é o n global.
- **Não credite a régua nova pelo zero de qa_coverage.** A última falha de
  qa_coverage foi **11/09 20:53Z**, 292 gerações atrás, e ela é *posterior* ao
  corte. Taxa pós-28/08 = 1/1428 = **0,07%**. Na régua nova, 1/648.
  P(ver ≥1 se a taxa for a baixa) = 36,5% → a falha de 11/09 era **esperada**,
  não piora. Se a taxa tivesse voltado à histórica de 1,1%, o esperado em 648
  seria **7,1 falhas**, não 1. Segue consistente com "continua baixa" — e
  "baixa" não é "zero" (lição de 12/09).

### Elapsed e mecanismo

Sem hang. Máximo **378,9s** na régua nova, dentro do normal pra texto longo. O
incidente `d3d8d1b2` continua fechado como aceite de risco; nada aqui pede
reabertura.

| | Régua anterior | Régua nova |
|---|---|---|
| `ready` geral | n=139, mediana 96,5s, p90 169,1s | n=479, mediana 98,8s, p90 173,8s |
| ≥1000ch | n=26, mediana 168,9s, p90 330,9s | n=111, mediana 148,4s, p90 251,7s |

Observação com ressalva: em ≥1000ch a régua nova está **mais rápida** (148s vs
169s), o oposto do custo projetado do piso 0.65. Não vou chamar isso de achado:
n=26 do lado antigo, a comparação não é pré-registrada, e o piso deveria empurrar
o tempo pra cima, não pra baixo. Fica anotado como coisa a observar, não como
resultado.

**Recomposição (lição 3 de 10/09):** `coverage_rescued` foi 12 → 23, mas o
sub-caminho conta a história: piso 0→16 e orgânico 12→7. A população trocou por
dentro, como esperado. `coverage_exhausted` = 1 em 648 (é a falha de 11/09, o
portão funcionando).

---

## PASSO 3 — Quem falhou

**Ninguém.** Zero falhas em 14/09 e zero em 15/09 até agora. `user_id` com falha
desde ontem: `[]`.

A única falha da régua nova continua sendo a de **11/09 20:53Z**
(`67f28d0f-2049-4ee6-aed4-cb46773c2198`, user `4fbe87ff-…`, 354ch, 234s), já
tratada nas rondas de 12 e 13/09 — incluindo a checagem de "pagante trancado"
(216 suspeitos → 0 trancados), que naquele dia evitou um alarme falso. Não há
caso novo, então não rodei a ferramenta de novo e não há estorno novo a conferir.

Sem aluno travado agora.

---

## PASSO 4 — Volume (lição de 14/09: compare o mesmo horário)

Hoje é **terça**. Comparando sempre até 15:14Z, nunca contra o total fechado dos
outros dias:

| Dia | Até 15:14Z | Dia fechado |
|---|---|---|
| 08/09 (ter) | 26 | 86 |
| 09/09 (qua) | 36 | 118 |
| 10/09 (qui) | 43 | 90 |
| 11/09 (sex) | 49 | 100 |
| 12/09 (sáb) | 27 | 74 |
| 13/09 (dom) | 13 | 50 |
| 14/09 (seg) | 49 | 101 |
| **15/09 (ter)** | **56** | — (parcial) |

56 é a **maior leitura de mesmo horário de toda a série**, e mais que o dobro da
terça anterior (26). Volume saudável, sem sinal de queda. Sem essa comparação, o
"56" pareceria abaixo dos 101 de ontem.

---

## Pendência que MUDA hoje: o alvo do pré-registro H-idioma não entrega poder

Estado: **207/600** gerações novas desde 13/09, alvo ~20/09. À primeira vista
está no rumo. Não está — e o motivo é a lição de 13/09 batendo de volta.

O n=600 foi calculado supondo divergência em **2,14%** das gerações (~47 gerações
por caso divergente). No dado novo o observado é:

- 207 gerações, 148 com coluna `qa` (71,5%)
- **2 divergentes** → 0,97% por geração, ou **~104 gerações por divergente**

Ou seja, a taxa real de divergência é **metade** da premissa. Projetando:

| Cenário | Divergentes esperados | Conclui? (mínimo 8) |
|---|---|---|
| n=600 (alvo atual, ~20/09) | **~5,8** | **Não** |
| n=828 | ~8,0 | No limite |

Chegar em 20/09 com 600 gerações significa chegar com ~6 divergentes e o veredito
"SEM PODER — não conclui". Seria repetir 13/09 exatamente: o dia marcado chega
com resultado vazio, e junto vem a tentação de alargar a janela pra trás até o
número aparecer.

**Recalculando:** pra 8 divergentes são ~**828** gerações desde 13/09. Faltam
621. A 79/dia (média que inclui o domingo) = 7,9 dias; a ~100/dia em dia útil =
6,2 dias. **Alvo revisado: ~22-23/09**, não 20/09.

Ressalva honesta, e ela é grande: essa reestimativa está apoiada em **2 casos**.
Uma taxa estimada com n=2 é ruído puro — o intervalo vai de "muito mais raro" a
"igual à premissa original". Não estou afirmando que a taxa é 0,97%; estou
afirmando que **600 não é mais um alvo defensável** e que manter a data de 20/09
é marcar encontro com um resultado vazio. A hipótese continua **ABERTA**, a
janela continua sendo "13/09 em diante, sem reaproveitar as 1182 já vistas", e o
alvo passa a ser por **número de divergentes (8)**, não por data — data é
consequência, e foi justamente tratar data como meta que quebrou em 13/09.

Idiomas detectados no dado novo: `{"pt":23, "de":1, "en":1}`.

---

## Pendências registradas para amanhã

- **Números para a checagem de denominador**: `qa_coverage` desde 25/08 = **11**;
  falhas totais desde 25/08 = **14**.
- **Régua no ar**: `2adb080` (08/09 15:22Z), **sete dias**, nada pendente de
  deploy. Os verdes de hoje (`7b673a7`, `b2d9f47`) são treino de voz / amostra
  pós-treino e **não** reiniciam o acumulado de 648.
  **Não repetir o atalho "build verde novo ⇒ acumulado reinicia"** que eu deixei
  escrito em 14/09: o critério é o diff em `inference.py`/`tts_settings.py`, nunca
  a existência do build.
- **H-idioma**: 207/828 (alvo recalculado hoje). Meta é **8 divergentes**, não uma
  data. Se em ~22/09 os divergentes ainda forem <8, o resultado certo segue sendo
  continuar sem resultado.
- **A observar, sem status de achado**: ≥1000ch mais rápido na régua nova (148s vs
  169s), contra a direção projetada do piso 0.65. Se persistir com n maior do lado
  novo, vale entender; hoje não é conclusão.
- Incidente `d3d8d1b2` (hang) segue fechado como aceite de risco. Nenhum elapsed
  suspeito hoje.

## Lição do dia (para o cabeçalho da base)

**LIÇÃO DE 15/09 — a nota da véspera não é árbitro.** Em 14/09 escrevi o atalho
"build verde novo em `runpod-worker/` ⇒ o acumulado reinicia". Hoje apareceram
dois verdes e o atalho mandava partir a janela em 03:49Z: daria n=27 contra o
pool real de 648 e concluiria nada. O atalho estava errado porque comprime a
regra ("o corte está no diff") num gatilho barato ("apareceu build"). As lições
de 07, 08 e 09/09 já diziam que verde não é corte — eu tinha acabado de
reescrever isso e mesmo assim deixei um bilhete que contradizia. Isso fecha o
par com a lição de 14/09: lá o viés veio de **código meu** (a conta de ritmo),
aqui vem de **nota minha**. Nenhum dos dois é árbitro. O árbitro é o diff, e a
pergunta é sempre a mesma: *este build muda DECISÃO no caminho que eu estou
medindo?* Hoje a resposta foi não, por isso o acumulado sobreviveu.

**Corolário:** quando eu deixar pendência pra ronda seguinte, escrever o
**critério**, não o gatilho. "Se aparecer verde, cheque o diff de
`inference.py`/`tts_settings.py`" teria funcionado; "se aparecer verde,
reinicie" quase me fez errar a régua de novo.

## O que eu não fiz

Não respondi aluno, não mexi em crédito, não abri nem fechei incidente, não
toquei no endpoint do RunPod.
