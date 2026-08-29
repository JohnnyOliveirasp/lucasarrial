# Ronda diaria — saude do QA de audio (qa_coverage)

**Data:** 2026-08-29 · medido as 15:11 UTC (12:11 BRT)
**Veredito:** **dia limpo em qa_coverage** — 0 falhas em 39 geracoes na regua atual, e
**2 dias corridos sem nenhuma reprovacao de cobertura** (a ultima foi 27/08).
Tres ressalvas, e a segunda vale mais que o zero:

1. o zero **nao prova cura** — a faixa que quebra foi exercitada **3 vezes** (86% de chance de ser sorte);
2. a **regressao de tempo continua subindo**, e agora anda em direcao ao teto de execucao (~491s);
3. a unica falha desde ontem **nao foi qa_coverage** — foi o **hang** (incidente d3d8d1b2, fechado como aceite de risco). **Voltou uma vez.** Decisao de reabrir e do Johnny.

---

## 1. Qual regua esta no ar

| item | valor |
|---|---|
| ultimo run VERDE do `runpod-worker.yml` | `467cc7f1` |
| terminou (updatedAt) | **2026-08-28T23:13:21Z** |
| conclusao | success (deploy real: GHCR + saveTemplate + reciclagem dos workers) |
| o que era | PR #97 — `fix/esticador-global-0-85` |
| commits em `runpod-worker/` depois disso? | **nenhum** (`git log 467cc7f1..origin/main -- runpod-worker/` saiu vazio) |

**Build NAO falhou.** Os 5 ultimos runs sairam verdes. A correcao mais recente esta no ar.

⚠️ **Duas observacoes de molde, pra nao medir a regua errada (o erro de 19-20/08):**

- O corte caiu **ontem 23:13Z**, nao hoje. Entao **nao existe** janela "hoje antes do corte":
  **hoje inteiro ja e regua nova**. A janela que vale e a **acumulada** (corte → agora).
- **Ontem houve CINCO builds verdes** (18:45, 20:21, 21:26, 21:45, 23:13Z). Logo
  "ontem antes do corte" **nao e uma regua unica** — e mistura de quatro. Aquele numero
  serve de contexto, **nao** de baseline limpo. Registro isso porque tabelar essa janela
  como "a regua anterior" seria exatamente o erro que originou esta rotina.

### O que o PR #97 mudou (importa pra leitura do tempo)

`rate_qa_max_stretch` **0,90 → 0,85**: o esticador global agora pode deixar o audio ate
**18% mais longo** (antes 11%). Foi feito porque 0,90 nao alcancava desvios de ritmo de
30-35% medidos em **Victor** e **Ellen**.

**Isso PREVE tempo igual ou MAIOR, nao menor.** Nao e bug — e o preco escolhido. A pergunta
da ronda de hoje e quanto esse preco esta custando.

---

## 2. Numeros (denominador na mao)

| janela | total | falhas | qa_coverage | taxa |
|---|---:|---:|---:|---:|
| Baseline 17/08 → 28/08 (historico) | 1207 | 32 | 27 | **2.2%** |
| ONTEM 28/08 **antes** do corte 23:13Z (mistura de 4 reguas) | 119 | 1 | 0 | 0.0% |
| ONTEM 28/08 **depois** do corte (so ~47min) | 6 | 0 | 0 | — *n pequeno demais pra concluir* |
| HOJE 29/08 inteiro (regua atual) | 33 | 0 | 0 | 0.0% |
| **REGUA #97 ACUMULADA (28/08 23:13Z → agora)** | **39** | **0** | **0** | **0.0%** |

**Sequencia sem qa_coverage:** 158 geracoes (28/08 + 29/08), ultima reprovacao em **27/08**.

### O zero e real? Sim — conferido antes de acreditar

| checagem | resultado |
|---|---|
| geracoes da regua #97 presas em `processing`/`queued` | **0** (as 39 estao `ready`) |
| `status=failed` com `error_message` vazio (falha silenciosa) | **0** |
| `error_message` ainda grava? | sim — 33 no historico, a ultima 28/08 18:16Z |

Ou seja: o zero **nao** e "ainda nao deu tempo de falhar" nem instrumento morto.

---

## 3. O zero autoriza dizer que melhorou? **Nao.** E o motivo mudou

Diferente de ontem, hoje o problema **nao e a taxa — e a amostra**:

| recorte | taxa historica | regua #97 | P(ver 0 mesmo se NADA mudou) | teto 95% | conclusivo? |
|---|---:|---:|---:|---:|---|
| todas as geracoes | 2.03% (27/1327) | 0/39 | **45%** | 7.4% | **nao** |
| curto <1000ch | 1.25% (13/1039) | 0/36 | 64% | 8.0% | **nao** |
| **LONGO ≥1000ch (o caso que quebrava)** | 4.86% (14/288) | **0/3** | **86%** | 63.2% | **nao** |
| **PIOR 1500-2500ch** | 8.04% (9/112) | **0/2** | **85%** | 77.6% | **nao** |

**A regua #97 quase nao viu o caso que quebra.** Das 39 geracoes, **36 sao texto curto**.
Foram **3** geracoes longas e **2** na faixa pior. Um teto de 63% na faixa longa nao e
medicao, e ausencia de medicao.

O `0/39` global parece robusto e nao e: como as falhas se concentram em texto longo, o
denominador que importa e 3, nao 39. **Anunciar melhora com isso seria errar pra mais** —
e o enunciado da rotina diz que isso custa tanto quanto errar pra menos.

---

## 4. O tempo — o achado que continua vivo

### A regressao de ontem esta CONFIRMADA e nao voltou

Mediana de `elapsed_seconds`, so geracoes bem sucedidas:

| faixa | A: pre-965557a8 | B: regua 965557a8 | C: regua #97 (0,85) | A vs B | B vs C |
|---|---:|---:|---:|---:|---:|
| todas | 78.8s (n=888) | 102.7s (n=108) | 88.2s (n=32) | **p=9.7e-9** | p=0.11 |
| curto <1000ch | 68.4s (n=645) | 86.9s (n=78) | 79.3s (n=29) | **p=1.1e-5** | p=0.69 |
| **LONGO ≥1000ch** | **115.8s** (n=243) | **218.6s** (n=30) | **307.9s** (n=3) | **p=8.8e-11** | p=0.60 |
| PIOR 1500-2500ch | 133.4s (n=87) | 260.8s (n=15) | 315.4s (n=2) | **p=4.7e-8** | n pequeno demais |

A → B (texto longo quase dobrando) segue **solidissima**. B → C **nao e conclusiva** (n=3),
mas a direcao e a que o PR #97 previa.

### O que me preocupa: a cauda esta andando pra parede

Texto longo (≥1000ch), so sucesso:

| era | p50 | p75 | p90 | MAX | **>300s** | >400s |
|---|---:|---:|---:|---:|---:|---:|
| A pre-965557a8 | 116s | 143s | 181s | 461s | **1%** (2/243) | 1 |
| B regua 965557a8 | 222s | 278s | 365s | 411s | **23%** (7/30) | 1 |
| C regua #97 | 308s | 323s | 323s | 323s | **67%** (2/3) | 0 |

O teto de execucao observado e **~491s** (foi onde a falha de ontem estourou). A fatia de
texto longo acima de 300s saiu de **1% → 23%**, com n solido nos dois. O 67% de C tem n=3 e
**nao conta como medida** — mas a serie 1% → 23% ja sozinha diz que a folga ate a parede
encolheu muito.

**Nao estou afirmando que #97 causou timeout.** Estou dizendo que a margem esta menor e que
essa e a coisa a vigiar amanha, com denominador maior.

### Um experimento natural (n=1, mas limpo)

Victor, **mesmo texto de 207ch**, mesma conta:

| quando | regua | elapsed |
|---|---|---:|
| 28/08 18:25Z | anterior | 89.6s |
| 28/08 21:42Z | anterior | 81.7s |
| **28/08 23:14Z** | **#97** | **167.7s** |

~2x pro mesmo tamanho de texto, 1min depois do deploy. **E n=1, nao concluo nada com isso** —
registro porque e a observacao mais controlada disponivel e porque a ironia importa: o #97 foi
feito por causa do desvio de ritmo **do proprio Victor**, e o custo apareceu na geracao dele.

---

## 5. Quem falhou (unica falha desde ontem)

**Nao foi qa_coverage.**

| campo | valor |
|---|---|
| aluno | **VICTOR ARAUJO** — viktoraraujo@icloud.com (aluno de verdade, nao admin) |
| acesso ate | 2026-09-03 |
| geracao | `086970cd` · 28/08 18:16:10Z |
| erro CRU | `"executionTimeout exceeded"` |
| tempo | **491.6s** · texto de **206ch** |
| estorno | **SIM** — 400 cr, `ref_type=generation_refund`, 18:24Z (`kind=extra_purchase`, como esperado) |
| destravou? | **SIM** — regerou com sucesso 9min depois (18:25Z, 207ch, 89.6s) e mais 3x depois |

**206ch levando 491s e a assinatura do HANG, nao da regressao do esticador** (206ch deveria
sair em ~70s; texto curto na regua nova esta em 79s). Isso e o incidente **d3d8d1b2**, que o
Johnny fechou como aceite de risco — e o criterio registrado era "reabrir SO se voltar".
**Voltou uma vez, em 28/08.** Nao reabri: **a decisao e do Johnny.**

**Nenhum aluno esta travado agora.** Victor foi estornado e voltou a gerar.

---

## 6. Ritmo diario (pra dimensionar o n esperado)

| dia | total | falhas | qa_coverage |
|---|---:|---:|---:|
| 22/08 | 96 | 0 | 0 |
| 23/08 | 100 | 5 | 4 |
| 24/08 | 144 | 7 | 5 |
| 25/08 | 133 | 1 | 1 |
| 26/08 | 117 | 3 | 3 |
| 27/08 | 82 | 6 | 6 |
| 28/08 | 125 | 1 | **0** |
| **29/08 (parcial, ate 15:11Z)** | **33** | 0 | **0** |

**Hoje esta lento:** 33 geracoes as 15:11Z contra 51 ontem no mesmo horario (-35%). E sabado,
entao provavelmente e so o fim de semana — mas significa que **o n da regua #97 vai acumular
devagar**, e a faixa longa (3 casos ate agora) pode levar **3-4 dias** pra ficar conclusiva.

---

## 7. O que fica pra amanha

1. **Acumular texto longo na regua #97.** Hoje sao 3. Sem ~25-30 casos, nao existe declaracao
   de cura possivel — e o zero global de 39 nao substitui isso.
2. **Vigiar a cauda do tempo contra o teto de ~491s.** Se a fatia de texto longo acima de 400s
   crescer, timeout deixa de ser evento isolado e vira taxa. Essa e a metrica de amanha.
3. **Levar o retorno do hang ao Johnny** (d3d8d1b2 voltou 1x em 28/08). Reabrir ou manter o
   aceite de risco e decisao dele, nao minha.
4. O trade do #97 (mais esticamento = mais tempo) foi **escolhido**. Vale confirmar com o Johnny
   se o tempo de texto longo em ~300s e aceitavel, porque hoje ja e ~2,6x o de 10 dias atras.

## Como reproduzir

```
node /tmp/perf/qacov-2026-08-29.cjs       # janelas + falhas cruas + ritmo
node /tmp/perf/stats-2026-08-29.cjs       # conclusividade por faixa + Mann-Whitney do tempo
node /tmp/perf/cauda-2026-08-29.cjs       # cauda do tempo vs teto de execucao
node /tmp/perf/quem-falhou-2026-08-29.cjs # perfil, estorno por ref_type, destravou?
node /tmp/perf/sanidade-2026-08-29.cjs    # o zero e real? presas / falha silenciosa
```

Paginacao de 1000 em 1000 (`.range`), erro impresso CRU antes de acreditar em qualquer zero.
Colunas usadas em `generations`: `id, user_id, status, error_message, created_at, text_raw,
elapsed_seconds` (**nao existe** `user_email`). `profiles`: `id, email, display_name,
access_until` (**nao existe** `full_name`). Estorno **so** por `ref_type='generation_refund'` —
filtrar por `kind` mente (o estorno grava `kind='extra_purchase'`, visivel na secao 5).
