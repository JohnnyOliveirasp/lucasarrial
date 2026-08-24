# Saude do QA de audio (qa_coverage) - 2026-08-22

Ronda diaria. Dia LIMPO. Relatorio emitido mesmo sem falha, por regra da rotina.

Medido em 2026-08-22 ~15:07Z. Ultima geracao registrada: 2026-08-22T14:44:04Z
(sistema vivo e produzindo no momento da medicao - nao e um zero de sistema parado).

## PASSO 1 - Qual regua esta no ar

`gh run list --workflow=runpod-worker.yml --limit 5` - os 5 ultimos runs VERDES:

| sha | termino (updatedAt) | conclusao |
|-----|---------------------|-----------|
| 080dd74 | 2026-08-21T21:46:06Z | success |
| 9528e3d | 2026-08-21T21:38:18Z | success |
| aae3ba5 | 2026-08-20T11:41:59Z | success |
| 6e07830 | 2026-08-20T03:53:48Z | success |
| c8f8ee7 | 2026-08-20T02:44:54Z | success |

Nenhum run falhou e nenhum esta in_progress. **A correcao mais recente ESTA no ar.**

Regua vigente: **080dd74**, no ar desde **2026-08-21T21:46:06Z**.
Toca `runpod-worker/`: `handler.py`, `voice_pipeline/pacing.py` (fix de pausa/pacing da voz).

### Observacao que muda a leitura do dia

O build de ontem (080dd74) e um fix de *pacing*, nao de qa_coverage. A inflexao que
importa pro portao de qualidade e o build **aae3ba5, de 20/08 11:41:59Z**: a ultima
falha qa_coverage do historico e de **20/08 10:09:20Z**, ou seja, 1h32 ANTES daquele
build. Depois dele, nada. Entao a janela honesta pra julgar o portao nao e "hoje
depois de ontem 21:46Z" (n=67), e sim "tudo depois de 20/08 11:41Z" (n=226).
Medir so contra o build de ontem subestimaria o denominador que ja temos na mao.

## PASSO 2 - Medicao

Fonte: tabela `generations`, paginada de 1000 em 1000 (`.range`), sem corte em 1000
linhas. 500 linhas lidas desde 18/08. Status distintos na janela: `{ready: 490, failed: 10}`.

### Anti-falso-zero (feito ANTES de acreditar no zero)

Um zero so vale se o detector consegue enxergar falha. Rodei o mesmo filtro sobre o
periodo sabidamente ruim (19-20/08) e ele **achou as 10 falhas, com o erro CRU**,
incluindo as 8 de qa_coverage. Logo o filtro nao esta cego e o zero de hoje e real.

### Por dia (UTC)

| dia | total | falhas | taxa | qa_coverage |
|-----|-------|--------|------|-------------|
| 18/08 | 128 | 2 | 1.6% | 0 (foram 2 hangs) |
| 19/08 | 106 | 4 | 3.8% | 4 |
| 20/08 | 135 | 4 | 3.0% | 4 |
| 21/08 | 70 | 0 | 0.0% | 0 |
| **22/08 (hoje, parcial)** | **61** | **0** | **0.0%** | **0** |

### Antes x depois da regua nova (corte 20/08 11:41:59Z)

| janela | total | falhas | taxa | qa_coverage |
|--------|-------|--------|------|-------------|
| ANTES (18/08 -> 20/08 11:41Z) | 274 | 10 | 3.6% | 8 (2.9%) |
| **DEPOIS (20/08 11:41Z -> agora)** | **226** | **0** | **0.0%** | **0 (0.0%)** |

Recorte diario pos-build: 20/08 apos 11:41Z n=95, 0 falhas | 21/08 n=70, 0 falhas |
22/08 hoje n=61, 0 falhas.

### Regra do denominador

- **HOJE n=61**: acima do piso de ~20. Da pra concluir que hoje esta limpo.
- **Pos-build acumulado n=226 com 0 falhas**: denominador forte. Contra os 2.9% de
  qa_coverage da regua velha, 226 geracoes limpas nao e ruido - se a taxa antiga
  ainda valesse, o esperado seria ~6-7 falhas qa_coverage nessa janela. Nao houve
  nenhuma. A queda e real.
- Ressalva honesta: "0 falhas" nao e o mesmo que "taxa = 0". Com n=226 o teto
  plausivel da taxa real ainda e da ordem de ~1.3%. O certo e dizer que **caiu de
  ~2.9% pra algo abaixo de ~1%**, nao que virou zero absoluto e permanente.
- A janela "depois do build de ontem 21:46Z" isolada tem n=67, tambem 0 falhas.
  Suficiente pra dizer que o fix de pacing nao regrediu nada, insuficiente sozinha
  pra afirmar qualquer coisa sobre o portao de qualidade.

### elapsed_seconds (reprovacao x hang)

Zero falhas hoje, entao nada a classificar. No historico da janela, os unicos 2
eventos de hang (`executionTimeout exceeded`) sao de **18/08**, ambos anteriores a
qualquer coisa recente. Nenhum hang em 19, 20, 21 e 22/08.
**Incidente d3d8d1b2 (hang) permanece FECHADO** - nao houve reincidencia, nao reabri.
As falhas de 19-20/08 tinham elapsed de 64-226s, ou seja, tempo normal: eram
reprovacao legitima do QA, nao travamento.

## PASSO 3 - Quem falhou

**Ninguem.** Zero falhas em 21/08 e 22/08, logo:

- Nenhum aluno travado agora.
- Nenhuma geracao presa em estado nao-terminal (os unicos status na janela sao
  `ready` e `failed`; nao ha nada pendurado em processamento).
- Nada a conferir em `credit_transactions` - sem falha, nao ha estorno pra validar.
  (Quando houver, o filtro correto e `ref_type='generation_refund'`, nunca `kind`.)

## Conclusao

Dia limpo, e dessa vez com denominador que sustenta a afirmacao. O portao de
qualidade do audio esta estavel desde 20/08 11:41Z: 226 geracoes, nenhuma falha de
qa_coverage, contra 2.9% na regua anterior. Ultima falha de qualquer tipo foi ha mais
de 2 dias (20/08 10:09Z).

Nada exigindo acao. Nada escalado. Nenhum incidente aberto ou reaberto.
