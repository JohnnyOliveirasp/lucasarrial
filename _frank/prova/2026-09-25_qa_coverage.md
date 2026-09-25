# Ronda diaria de qa_coverage — 25/09/2026 (15:10Z)

## Resumo

Ontem e hoje **limpos**: 0 falhas em 76 (24/09) e 0 em 62 (25/09 parcial).
**51,4h sem nenhuma falha de cobertura** (a ultima foi 23/09 11:48Z).

O numero que parece alarmante — qa_coverage saltou de 0,29% para 1,05% na regua
atual — **nao e interpretavel**, e a razao esta no PASSO 2 abaixo. Nao ha
regressao demonstrada e nao ha melhora demonstrada.

O que exige acao humana nao e um numero: e **um aluno (Diego Vargas) que falhou
3x, nunca voltou, e perde o acesso em 3,9 dias**.

---

## PASSO 1 — qual regua esta no ar (conferida no git, nao herdada)

`gh run list --workflow=runpod-worker.yml`: os 5 ultimos runs **VERDES**. Nenhum
build falhado, nenhum travado. Mas verde nao e corte — o criterio e "este build
muda DECISAO no caminho que estou medindo?". Conferido commit a commit:

| deploy (updatedAt) | sha | o que faz | e regua? |
|---|---|---|---|
| 21/09 19:27:52Z | `94c2a825` | `metrics.py` 196+/39-, `canon.py` NOVO (203), `text.py`, `loop.py`: o comparador de cobertura passa a canonizar variantes ("pra"/"para", "to"/"estou", "ce"/"voce") | **SIM — e a regua atual** |
| 23/09 14:16:11Z | `7dc53d7a` | telemetria #234: posicao da fronteira interna reprovada | nao |
| 23/09 15:41:38Z | `a77c90c9` | heartbeat setup_s + since_t0_s | nao |
| 24/09 20:08:54Z | `66a82ff4` | `worker_watchdog.py` NOVO (201): mata worker pendurado em ~105s em vez de esperar 640s | decisao, mas sobre **HANG**, nao sobre cobertura |
| 25/09 12:34:33Z | `f6dc4f5d` | `inference.py` 29+/4-: carimba `rate_clamp_mordeu` / `rate_fora_da_tolerancia` no qa | **NAO — telemetria pura** |

**O build de HOJE nao e regua.** A propria docstring dele declara: "SO
telemetria: nao muda o audio, o fator, o status nem a cobranca de ninguem", e o
diff confirma (so escreve chaves em `qa_stats`). Logo a comparacao
"hoje antes x hoje depois do build" **nao testa nada** — e so o mesmo portao dos
dois lados. Registro os numeros por disciplina, nao porque significam algo.

Regua de cobertura no ar: `94c2a825`, **4 dias**.

---

## PASSO 2 — medicao (denominador na mao)

Paginado em blocos de 1000. Erro CRU impresso antes de acreditar em qualquer zero.
Detector cobre os **dois** caminhos: `qa_coverage:` (worker) e "O audio saiu
incompleto" (reescrito pelo frontend em `webhooks/runpod/route.ts:230`).

| janela | n | falhas | qa_cov | taxa |
|---|---|---|---|---|
| Ontem (24/09 inteiro) | 76 | 0 | 0 | 0,00% |
| Hoje ate o build (00:00→12:34Z) | 33 | 0 | 0 | 0,00% |
| Hoje depois do build (12:34→15:10Z) | 29 | 0 | 0 | 0,00% |
| Hoje inteiro (parcial) | 62 | 0 | 0 | 0,00% |
| Desde o watchdog (24/09 20:08Z) | 77 | 0 | 0 | 0,00% |

Acumulado por regua:

| regua | n | falhas | qa_cov | taxa |
|---|---|---|---|---|
| pre-08/09 | 1073 | 13 | 10 | 0,93% |
| `2adb080` (08/09 → 21/09) | 1039 | 18 | 3 | 0,29% |
| `94c2a825` ATUAL (21/09 → agora) | 286 | 4 | 3 | **1,05%** |

### Por que o 1,05% NAO vale como piora

Fisher 2x2 (3/286 vs 3/1039): **p = 0,1188**. Ja nao cruza 0,05. Mas o problema
real e pior e nao aparece no p:

**As 3 falhas de qa_coverage da regua atual sao do MESMO aluno** (Diego Vargas,
`91014e6e`), e **duas delas estao a 5 minutos uma da outra** (23/09 11:43 e
11:48) — retentativa do mesmo texto. O numero de **eventos independentes e 1**,
nao 3. Tratar 3 linhas correlacionadas como 3 observacoes independentes e
exatamente o erro de denominador que esta ronda existe pra evitar; aqui ele
apareceu na forma de **independencia**, nao de tamanho.

=> Com 1 incidente independente, **nao da pra concluir nem melhora nem piora**
da regua `94c2a825`. O teste correto pede acumular mais dias. Anotado hoje, antes
de ver mais dado, pra nao escolher a leitura depois do numero.

### elapsed (hang x reprovacao)

As falhas da regua atual: 128,9s / 158,8s / 158,9s — faixa **normal de
reprovacao do QA**, nao hang. A unica de tempo alto e `executionTimeout` de
644,3s em 22/09 (incidente d3d8d1b2, fechado como aceite de risco pelo Johnny)
— **anterior ao watchdog** de 24/09 e nao reaberto, porque nao repetiu.
Nota vigiada: Mariana teve hoje 14:38Z um **sucesso** de 352,6s, acima da faixa
usual. Nao e falha e nao e incidente; fica no radar do elapsed.

### denominador que encolhe

Contra a tabela da ronda de 21/09: **16/09 caiu 77 → 74** (-3) e **17/09 caiu
76 → 71** (-5). Dois dias FECHADOS perderam linha (hard delete de aluno, sem
tombstone). Em 16/09 as falhas seguem 4, entao **as 3 que sumiram eram sucesso —
a taxa do dia PIOROU sozinha**, nao melhorou. Nao e a direcao perigosa, mas
confirma pela enesima vez que dia fechado nao e dia estavel.

---

## PASSO 3 — quem falhou

Estorno conferido **por `ref_type='generation_refund'`**, nunca por `kind` (o
estorno grava `kind='extra_purchase'`). Admin/socio fora da conta.

### 🔴 Diego Vargas <diegoavnunes@gmail.com> — PRIORIDADE
- `access_until` **29/09** → **3,9 dias**
- 5 geracoes na vida: 2 ok (22/09), depois **3 falhas seguidas** (22/09 21:55, 23/09 11:43, 23/09 11:48)
- **NAO VOLTOU** desde 23/09. Zero geracoes depois da ultima falha.
- Pagou (`payment_event` 100.000 em 22/09), clonou voz (-10.000), fez imagem e video.
- Creditos: a falha de 22/09 foi debitada e **estornada corretamente**. As duas
  de 23/09 **nao tem debito casado** — ou seja, nao foi cobrado por elas (nao e
  caso de aluno lesado). **Anomalia a conferir, sem agir:** o estorno de 23/09
  12:31 (`1c761a52`) aponta para a geracao de 22/09 21:47 que esta
  **`ready`** — estorno contra geracao bem-sucedida. Registrado, nao tocado.
- Leitura: financeiramente inteiro; **o dano e de experiencia e de calendario**.
  Aluno novo, primeira sessao seria, bateu 3 falhas e sumiu, com acesso vencendo.
  Estorno nao e reparacao — o indicador de dano e o **retorno**, e ele e zero.

### 🟡 Larissa Fonseca <larissaoviana@yahoo.com.br>
- `access_until` **18/10** → 22,9 dias. **A urgencia registrada na ronda de
  21/09 caducou**: aquele registro dizia acesso ate 25/09, e o acesso foi
  estendido desde entao. Corrigido aqui pra nao arrastar alarme falso.
- Ainda assim: 2 geracoes na vida (14/09 ok, 20/09 falhou), estorno de 400 ok,
  e **NAO VOLTOU** ha 5 dias. Dano em aberto, sem pressa de calendario.

### 🟢 Mariana Macedo Leme <mariana@excellerconsultoria.com.br>
- Recuperada. 67 geracoes, **20 depois da ultima falha (17/09), todas ok**,
  incluindo 4 hoje. 14 estornos, todos do cluster de 17/09. Caso encerrado.

---

## Conclusao

1. **Nenhum build falhado** — a correcao mais recente esta no ar.
2. **Ontem e hoje limpos**, 51,4h sem falha de cobertura. Com n=76 e n=62 da pra
   afirmar que foram dias limpos de verdade.
3. **A taxa da regua atual (1,05%) nao conclui nada** — 1 incidente independente
   disfarcado de 3. Nao anunciar melhora nem piora; acumular.
4. **Acao humana pendente: Diego Vargas**, 3,9 dias de acesso, nunca voltou.
   Nao respondi, nao mexi em credito, nao abri incidente (fora do meu escopo).

Script da ronda: `/tmp/perf/qacov_2509.cjs` (reescrito hoje — o
`/tmp/perf/qacov.cjs` de 21/09 tinha constantes vencidas e apontava a regua errada).
