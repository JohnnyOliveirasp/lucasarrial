# Ronda diaria — saude do qa_coverage (audio) — 2026-08-23

Medido em 2026-08-23T15:09Z. Card Mission Board: `ff0af5bb`.
Todos os horarios em UTC (a coluna `created_at` e UTC; a maquina roda America/New_York).

## Veredito

Dia limpo. **Zero falhas de qa_coverage** desde o deploy de 21/08.
Nenhum aluno travado. Nenhum build quebrado. Incidente de hang segue sem reincidencia.

## PASSO 1 — qual regua esta no ar

Ultimo run VERDE do `runpod-worker.yml` que tocou `runpod-worker/`:

| campo | valor |
|---|---|
| sha | `080dd74caa14dbcb22cc4c8600eb6f8723cc632e` |
| commit | `fix(voz): a voz nasce com a PAUSA de quem gravou (749 de 750 tinham zero)` |
| arquivos | `runpod-worker/handler.py`, `runpod-worker/voice_pipeline/pacing.py`, `frontend/src/lib/voices/finalize-training.ts` |
| conclusion | success |
| **TERMINO (updatedAt)** | **2026-08-21T21:46:06Z** |

Os 5 runs mais recentes estao todos verdes. Nenhum failed, nenhum in_progress.

**Nao houve build em 22/08 nem em 23/08.** A regua no ar tem ~41h e nao mudou
durante toda a janela observada. Consequencia direta: a divisao que a rotina pede
("hoje ate o build / hoje depois do build") **nao se aplica hoje** — nao existe corte
dentro de hoje. Ontem e hoje estao INTEIROS na mesma regua. Isso e bom para a
medicao: a comparacao ontem-vs-hoje esta livre de confusao por troca de regua.

## PASSO 2 — medicao por janela

Fonte: `generations`, paginado de 1000 em 1000 (`_frank/ferramentas/` + `/tmp/perf/qacov-0823.cjs`).
Total puxado desde 2026-08-20T00:00:00Z: **335 linhas** (uma pagina, sem truncamento).

| janela | total | falhas | qa_coverage | taxa | conclui? |
|---|---|---|---|---|---|
| REGUA VELHA 20/08 00:00Z → 21/08 21:46Z | 199 | 4 | 4 | **2.0%** | sim |
| regua nova, resto do 21/08 (21:46Z → 00:00Z) | 6 | 0 | 0 | 0.0% | **NAO — n=6 pequeno demais** |
| ONTEM 22/08 (dia inteiro, regua nova) | 96 | 0 | 0 | **0.0%** | sim |
| HOJE 23/08 00:00Z → 15:09Z (regua nova) | 34 | 0 | 0 | **0.0%** | sim, com ressalva |
| **ACUMULADO regua nova** (21/08 21:46Z → agora) | **136** | **0** | **0** | **0.0%** | sim |

### Leitura honesta do denominador

- **Hoje (n=34)** passa do minimo de ~20, entao 0% e reportavel. Mas com n=34 uma
  unica falha ja valeria 2.9%. Nao da pra afirmar precisao fina em cima de um dia.
- **A afirmacao mais forte e a acumulada**: 136 geracoes na regua nova, zero falhas,
  contra 4/199 (2.0%) na regua velha.
- **Isso ainda NAO e prova de que a correcao resolveu.** Se a taxa real continuasse
  em 2.0%, a chance de ver zero falha em 136 geracoes e de ~6% (`0.98^136 ≈ 0.063`).
  Improvavel, mas nao descartavel. E sugestivo, nao conclusivo. Precisa de mais
  alguns dias de n acumulando pra virar conclusao.
- Ritmo real observado: ~4 a 6 geracoes/hora nos horarios ativos. O n cresce devagar,
  entao a paciencia aqui e obrigatoria — nao adianta querer veredito em 1 dia.

### Verificacao de que o zero e real (nao detector cego)

Um zero merece desconfianca antes de virar boa noticia. Conferido:

- Distribuicao de `status` na regua VELHA: `ready`=195, `failed`=4 — o detector
  enxerga falha nesse mesmo dataset, entao ele funciona.
- Distribuicao na regua NOVA: `ready`=135, `pending`=1, `failed`=0.
- `error_message` preenchido na regua nova: **0 de 136**. Nenhuma falha silenciosa
  escondida atras de status ok.

## PASSO 2b — hang vs reprovacao

`elapsed_seconds > 400s` (assinatura de hang): **0 ocorrencias** nas duas janelas.

| | regua velha | regua nova |
|---|---|---|
| min | 2.61s | 9.15s |
| p50 | 97.54s | 84.79s |
| max | 226.19s | 190.94s |

As 4 falhas da regua velha tinham tempo normal (64s a 226s) — todas reprovacao de
QA, nenhuma hang. **Incidente d3d8d1b2 (hang) permanece fechado como aceite de
risco. Nada aqui justifica reabrir.**

## PASSO 3 — quem falhou

**Ninguem, na regua nova.** Zero falhas desde 2026-08-21T21:46:06Z, portanto zero
alunos afetados e zero estornos a conferir.

Para registro, as 4 falhas da regua VELHA (todas em 20/08, ja cobertas na ronda
daquele dia) foram 3 alunos distintos, sendo `d26a2f1f` duas vezes com o mesmo
texto de 1080ch.

### O unico `pending` — falso alarme, checado

`5e361fd5` / Gustavo San Martin (`gustavo@cdd.org.br`), criado 2026-08-23T15:08:59Z.
Tinha **17 segundos de idade** no instante da medicao (15:09:16Z) — geracao em voo
normal, nao travamento. Credito debitado normalmente (`ref_type='generation'`,
-1900). `access_until` 2026-08-30, ativo. **Nao e aluno travado, nao requer acao.**

## Ponto de atencao (nao e falha, mas vigiar)

Proporcao de `elapsed_seconds` nulo subiu: **20% na regua velha (39/199) → 46% na
regua nova (62/136)**. Isso nao afeta aluno nenhum, mas afeta ESTA ronda: `elapsed`
e justamente como eu separo hang de reprovacao de QA. Se a telemetria de tempo
continuar sumindo, o detector de hang fica cego sem avisar. Vale olhar na proxima
ronda se a tendencia se mantem — se passar de ~60%, virar card pro `coder`.

Nao abri card hoje: e uma tendencia de 1 dia e pode ser variacao normal de como o
worker reporta. Registrando pra comparar amanha em vez de reagir a um ponto so.

## Metodo (pra proxima ronda repetir igual)

- Script: `/tmp/perf/qacov-0823.cjs` (base: `/tmp/perf/qacov.cjs`, com as janelas
  ajustadas porque o corte de deploy nao caiu dentro de hoje).
- Colunas de `generations`: `id, user_id, status, error_message, created_at,
  text_raw, elapsed_seconds`. Nao existe `user_email`.
- `profiles`: `id, email, display_name, access_until`. Nao existe `full_name`.
- Estorno so por `ref_type='generation_refund'`. Filtrar por `kind` engana (o estorno
  grava `kind='extra_purchase'`).
- Status de sucesso e **`ready`**, nao `completed`. (Errei isso no meio da apuracao:
  um filtro meu de "nao-terminais" marcou 136 linhas saudaveis como suspeitas. Era
  bug do meu filtro, nao do sistema. Fica anotado pra nao repetir.)
- Admin/socio (johnny.oliveirasp@gmail.com, Lucas) ficam fora da conta de aluno.
