# Rotina das falhas — 20/08, 02:0x UTC

Fila: **4 incidentes**, todos `investigating`, todos já com nota da rodada anterior.
Fechei **zero** — nenhum estava resolvido. Nada de novo entrou na fila.
**Nenhum aluno travado e nenhum aluno cobrado** (conferido conta a conta).

---

## O achado da rodada: a falha de qa_coverage é VARIÂNCIA, não texto longo

A nota anterior dizia que a falha sobrevivente "mora no texto de 2000 chars" e propunha
**reproduzir o texto 3x na GPU** pra confirmar. Não rodei, por dois motivos: a ordem da
rodada proíbe gastar GPU sem o aluno pedir, e **a produção já tinha feito o experimento**:

| geração | hora | chars | texto | resultado |
|---|---|---|---|---|
| d6e61502 | 00:24:55 | 2000 | idêntico | READY |
| f4c3878d | 00:29:11 | 2000 | idêntico | READY |
| a6c2b9b8 | 00:35:47 | 2000 | idêntico | **FAILED** |

Mesma voz (75dd875c), mesmo texto byte a byte (`text_raw` conferido), mesmo worker,
6 minutos de diferença. Passa duas vezes, falha na terceira. **Não é determinismo.**

### Mecanismo (código: `runpod-worker/handler.py:1294` e `1392-1425`)

`TTS_CHUNK_MAX_CHARS=160` pica o texto em N chunks. O portão de QA é **por chunk**
(1 tentativa + `TTS_COVERAGE_QA_RETRIES`=3). Se **um** chunk esgota as 4 tentativas, o
handler faz `break` e mata o **job inteiro** — os outros 13 chunks perfeitos vão junto.
Como a síntese é estocástica, o risco **compõe** com o número de chunks:

    P(job morre) = 1 - (1-p)^N

Medido na janela do worker d9a14c0 (59 jobs, 275 chunks, 1 morte): **p ≈ 0,36%**.

| texto | chunks | risco previsto | observado |
|---|---|---|---|
| 100 chars | 1 | 0,36% | 0 / 34 jobs (1-3 chunks) |
| 660 chars | 5 | 1,8% | 0 / 15 (4-7) |
| 1500 chars | 10 | 3,6% | 0 / 2 (8-12) |
| 2000 chars | 13 | 4,6% | **1 / 8 (13+)** |

Toda a mortalidade está na faixa de 13+ chunks. O modelo bate, e explica por que texto
curto zerou depois de `d9a14c0` **sem o bug ter sumido**: texto curto sempre teve risco baixo.

### Correção candidata (NÃO aplicada — depende do Johnny)

Subir `TTS_COVERAGE_QA_RETRIES` de 3 → 5-6 **no env do endpoint RunPod**. É variável de
ambiente: sem build de worker, sem deploy. O custo extra só ocorre no chunk que já está
falhando, não no job inteiro. **Não** baixar `TTS_COVERAGE_QA_MIN` (0.85) — o portão
existe pra não repetir o caso Kátia; o problema é o orçamento de tentativas, não o limiar.

---

## Alarme falso que eu derrubei antes de virar estorno indevido

Achei 46 cobranças `ref_type=generation` cuja linha em `generations` não existe mais —
**48.441 créditos** de 15 alunos, sem estorno. Parecia dinheiro pendurado.

**Não é.** Existe `DELETE /api/v1/generations`
(`frontend/src/app/api/v1/generations/route.ts:149`) que **hard-deleta** a linha quando o
aluno apaga o áudio da biblioteca. O aluno recebeu o áudio e depois limpou a biblioteca —
cobrança legítima. Se eu tivesse estornado, teria devolvido crédito por trabalho entregue.

> Lição registrada: ausência da linha em `generations` **não** prova não-entrega. A prova
> tem que vir de `status=failed` + ausência de estorno.

---

## Estado dos 4 incidentes

| id | o quê | estado | por que não fechei |
|---|---|---|---|
| `d3d8d1b2` | executionTimeout | investigating | 158/470 no contador, 0 novos, 29,4h quieto. Mas só 6 das 158 tinham texto ≥1900 — o contador é mais fraco do que parece |
| `37bacb68` | qa_coverage mata o job | investigating | causa caracterizada, **nada corrigido ainda** |
| `fb8d29b7` | QA não media inserção | investigating | fix `6af76ae` **ficou vivo às 01:23 UTC** (build 52m05s, sucesso), mas só 2 gerações desde então, ambas de 103 chars — janela vazia |
| `43f37482` | Luciano (lucvila@) | investigating | diagnóstico fechado, saldo 13.409 bate com o print, acesso ativo até 30/08, uso diário. **Só falta o OK pra responder.** Prazo das 24h: 20/08 23:30 UTC |

## Correções de método desta rodada

- Consultei o contador do `d3d8d1b2` com `>=` e li "1 timeout novo" — era a própria
  ocorrência de 20:46. Refiz com `>`. Confira o operador antes de acreditar no número.
- Pedi `profiles.credits` (coluna inexistente): o PostgREST devolveu **vazio em silêncio**
  e 4 alunos apareceram como "SEM PERFIL". As colunas são `credits_subscription` +
  `credits_extra`.
- `62b1b863`, `ca27bd96`, `b85f2840`, `8aee49c0` citados nas notas são **job ids do
  RunPod**, não `generations.id` — não procure em `generations`.

## Fila de PRs (nada meu ficou fora do processo)

8 PRs abertos, **todos com base `main`** (conferido um a um). `f9c1818` está no PR #14.
Os mais velhos são **#4 e #5, de 18/08** — mexem em crédito/estorno e migration 82,
esperando aval.
