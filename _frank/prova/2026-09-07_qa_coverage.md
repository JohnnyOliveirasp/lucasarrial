# Ronda diaria qa_coverage - 2026-09-07 (15:08Z)

## Resumo

Dia limpo. **Zero falhas** ontem e hoje, zero qa_coverage. **Nenhum aluno travado.**
O achado do dia nao e a taxa (que segue em zero) - e que **o build de hoje NAO mexeu na regua**:
e telemetria pura. Entao o corte de hoje nao divide reguas, e o denominador honesto e o
acumulado, nao o n=2 de depois do corte.

## Passo 1 - qual regua esta no ar

`gh run list --workflow=runpod-worker.yml` -> ultimo run **VERDE**:

| sha | conclusion | termino (updatedAt) |
|---|---|---|
| `51c9a8f2` | success | **2026-09-07T13:36:03Z** (hoje) |
| `eccc3d59` | success | 2026-09-05T08:28:05Z |

Nenhum run falhado ou preso. Build de hoje levou 46 min (28-52 min e a faixa normal).

**PORÉM - e isto muda o recorte do dia:** `51c9a8f2` e o merge do PR #197
("telemetria nas 5 saidas silenciosas da cura do fim abrupto", #234). O diff contra o
primeiro pai:

```
46   0   runpod-worker/jobs/inference.py
365  0   runpod-worker/test_cura_fim_telemetria.py
```

**Zero remocoes.** As 46 linhas sao: 6 contadores inicializados em 0 no `__init__`, o metodo
`_contar_cura` (que so soma em dict, com `.get(chave, 0)` defensivo) e as chamadas dele.
Nao ha mudanca de fluxo, nao ha mudanca de limiar, nao ha mudanca no portao de qualidade.

=> **A regua de comportamento nao mudou hoje.** Ela continua sendo a de `eccc3d59` (05/09).
Tratar "antes/depois de 13:36Z" como duas reguas seria fabricar uma divisao que nao existe -
e cairia direto no erro de 19-20/08 (medir a regua errada), so que ao contrario.

## Passo 2 - medicao

Sanidade primeiro (licao de 29/08 - sem isso o zero nao esta conferido):

- (a) presas em processing/queued hoje: **0** -> o zero nao e "ainda nao deu tempo de falhar"
- (b) failed com error_message vazio hoje: **0** -> nao ha falha invisivel
- (c) status crus hoje: `{"ready": 32}` - todas concluidas

### Janelas

| janela | n | falhas | qa_coverage | conclui? |
|---|---|---|---|---|
| ONTEM 06/09 inteiro | 50 | 0 (0,0%) | 0 | sim (n>=20) |
| HOJE 00:00 -> 13:36Z (antes do corte) | 30 | 0 (0,0%) | 0 | so global |
| HOJE depois de 13:36Z | **2** | 0 | 0 | **NAO - n=2** |

**O n=2 de depois do corte nao conclui nada sozinho, e nao vou fingir que conclui.**
Ritmo de hoje: 32 geracoes em 15h, concentradas de madrugada (00-02h = 23 delas). Depois das
13:36Z passaram 1h32 e vieram 2 geracoes. Isso e ritmo normal, nao e sinal de nada.

### O denominador que vale (a regua nao mudou desde 28/08)

Como o build de hoje e telemetria, o acumulado limpo e o que conclui - e a faixa que vale
e a que **quebrava** (1500-2500ch), nunca o global:

| janela | global | >=1000ch | **1500-2500ch** |
|---|---|---|---|
| ANTES (25-27/08, regua velha) | 10/312 = 3,2% | 6/50 = 12,0% | **5/25 = 20,0%** |
| POOL desde 28/08 -> agora | **0/723** | **0/128** | **0/51** |
| POOL desde corte de 05/09 -> agora | 0/103 | 0/18 | 0/8 |

**Isto conclui.** Na faixa que quebrava: 5/25 (20%) -> 0/51. Se a taxa real ainda fosse 20%,
a chance de ver 0 em 51 seria ~1e-5. Teto de 95% (regra de tres) com 0/51 = **5,9%** - ou
seja, a taxa verdadeira hoje esta abaixo de ~6%, contra 20% antes.
Global: 0/723, teto 95% = 0,41%. Sao **11 dias seguidos sem uma unica falha de qa_coverage**
(a ultima foi em 27/08).

O pool de 8 dias (desde 05/09) tem n=8 na faixa ruim - **pequeno demais isolado**. Quem
conclui e o pool de 28/08 (n=51), nao ele. Digo as duas coisas, como manda a licao de 05/09.

## Passo 3 - quem falhou

**Ninguem, ontem nem hoje.** Ultimas falhas foram em 04/09 (fora da janela do relatorio) e
**nenhuma delas era qa_coverage** - as duas foram `executionTimeout` (familia hang, d3d8d1b2).

Fechei o ciclo delas mesmo estando fora da janela, porque estorno nao e caso resolvido:

| aluno | falha 04/09 | estorno (`ref_type='generation_refund'`) | **voltou a gerar?** |
|---|---|---|---|
| Debora Oliveira (debbie994@gmail.com) | 1307ch, 579s | sim, 21:04Z, 1307 cred | **sim** - 1287ch OK em 05/09 02:17Z |
| Renan Juste (renanjuste.business@gmail.com) | 749ch, 485s | sim, 20:56Z, 749 cred | **sim** - 3 geracoes OK hoje 01:16-01:26Z |

Os dois foram estornados **e** destravados de verdade (entregaram o texto que queriam).
Nenhum aluno pendurado.

## Vigiar (nao e alarme, mas nao pode passar em branco)

**1. `elapsed_seconds` nulo esta subindo.** A licao de 05/09 mandou checar isso todo dia,
porque elapsed e o UNICO discriminador entre reprovacao do QA (40-230s) e hang (>400s):

| dia | 01/09 | 02/09 | 03/09 | 04/09 | 05/09 | 06/09 | 07/09 |
|---|---|---|---|---|---|---|---|
| % sem tempo | 14% | 27% | 16% | 18% | 16% | **30%** | **28%** |

Base 01-05/09 = 54/295 (18,3%); ultimos 2 dias = 24/82 (29,3%). z~2,17 (p~0,03) - **borderline
com n=82 em dois dias, pode ser ruido**. Nao concluo que piorou; registro pra comparar amanha.
Se passar de ~30% de forma sustentada, a classificacao desta ronda comeca a ficar cega.

**2. Hang (d3d8d1b2) NAO voltou** - nao reabrir. Em 06/09 houve 4 geracoes lentas (312-357s),
todas do MESMO usuario (`739f6916`), todas com texto de 1944-2000ch e **todas `ready`** - ou
seja, demoraram mas entregaram. Nenhuma passou de 400s. Os ultimos `executionTimeout` de
verdade foram os dois de 04/09. Tempos gerais desde 01/09 (n=299): p50=99s, p90=224s, p99=373s.

## Veredito

Taxa de hoje: **0%**, igual a ontem (0%). Nao subiu nem desceu.
Com o n de hoje isolado (2 geracoes depois do corte) **nao da pra concluir nada** - mas o
acumulado da regua atual **conclui**: a faixa 1500-2500ch saiu de 20% pra 0/51, e o sistema
esta em 11 dias sem qa_coverage. O build de hoje foi telemetria, entao nao havia regua nova
pra validar.
