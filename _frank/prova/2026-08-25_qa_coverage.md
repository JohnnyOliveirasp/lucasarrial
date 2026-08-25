# Saude do QA de audio (qa_coverage) — ronda de 2026-08-25

Medido em 2026-08-25 15:08Z. Dia ainda PARCIAL (~63% do dia UTC decorrido).

## Passo 1 — qual regua esta no ar

`gh run list --workflow=runpod-worker.yml --limit 5`:

| conclusion | headSha | terminou (updatedAt) |
|---|---|---|
| success | `7411536` | 2026-08-25T13:00:56Z |
| cancelled | `bf15829` | 2026-08-25T12:47:01Z |
| success | `67cfcbb` | 2026-08-25T11:25:50Z |
| cancelled | `5383c41` | 2026-08-25T11:05:52Z |
| success | `79a56a8` | 2026-08-25T04:10:15Z |

**Ultimo run VERDE que tocou `runpod-worker/`: `7411536`, terminou 13:00:56Z.**
Confirmado por `git show --stat 7411536` — mexe em `runpod-worker/jobs/inference.py`
e `runpod-worker/jobs/tts_settings.py`. **CORTE = 2026-08-25T13:00:56Z.**

Nenhum run falhou e nenhum esta in_progress. Os dois `cancelled` sao os
superseded normais de push em cima de push, nao sao falha.

Ressalva de leitura: `7411536` e a feature de **ritmo** (aluno escolhe "mais
calmo / normal / mais rapido"), NAO uma correcao do portao de qualidade. Entao
qualquer variacao de taxa depois de 13:00Z nao deve ser lida como "a correcao
do qa_coverage pegou" — nao houve correcao de qa_coverage neste build.

## Passo 2 — medicao (com denominador na mao)

Fonte: `generations`, paginado, 945 linhas desde 2026-08-17 (uma pagina, <1000).

| Janela | Total | Falhas | qa_coverage | Taxa falha | Taxa qacov |
|---|---:|---:|---:|---:|---:|
| Baseline 17/08 -> 23/08 | 732 | 15 | 12 | 2,0% | 1,6% |
| ONTEM 24/08 (dia inteiro) | 148 | 7 | 5 | 4,7% | 3,4% |
| HOJE ate o build verde (regua velha) | 44 | 0 | 0 | 0,0% | 0,0% |
| HOJE depois do build verde (regua nova) | 20 | 0 | 0 | 0,0% | 0,0% |
| HOJE dia todo (parcial) | 64 | 0 | 0 | 0,0% | 0,0% |

### Regra do denominador — o que DA e o que NAO DA pra concluir

- **Janela pos-build (n=20): n pequeno demais pra concluir.** Zero falha em 20
  geracoes e compativel com uma taxa real de ate ~14% (limite superior de 95%).
  Nao anuncio melhora com este n.
- **Dia inteiro (n=64): sinal bom, mas ainda nao e prova.** Se a taxa de
  qa_coverage de ontem (3,4%) tivesse continuado igual hoje, a chance de dar
  zero em 64 geracoes seria ~11% — ou seja, 1 em 9. Improvavel, mas longe de
  descartavel. **Nao declaro melhora confirmada.** Precisa de mais um ou dois
  dias limpos.
- O que DA pra dizer com seguranca: **hoje nao teve nenhuma falha ate agora, de
  nenhum tipo**, e ontem foi o pior dia da serie (4,7%).

### Ritmo por dia (dimensiona o n esperado)

```
17/08 | total=103 | falhas=0 | qacov=0
18/08 | total=127 | falhas=2 | qacov=0
19/08 | total=105 | falhas=4 | qacov=4
20/08 | total=135 | falhas=4 | qacov=4
21/08 | total=67  | falhas=0 | qacov=0
22/08 | total=96  | falhas=0 | qacov=0
23/08 | total=100 | falhas=5 | qacov=4
24/08 | total=148 | falhas=7 | qacov=5
25/08 | total=64  | falhas=0 | qacov=0   (parcial, ate 15:08Z)
```

### elapsed_seconds — reprovacao de QA vs hang

As 5 falhas de qa_coverage de ontem tiveram tempo normal (23s a 203s): sao
reprovacao do portao, comportamento esperado do gate.

As outras 2 de ontem foram **hang** (`executionTimeout exceeded`, 492s e 483s).
Historico completo de nao-qa_coverage desde 17/08:

```
18/08 18:05 | elapsed=null   | executionTimeout exceeded
18/08 20:46 | elapsed=null   | executionTimeout exceeded
23/08 23:41 | elapsed=1812s  | RunPod FAILED: executionTimeout exceeded
24/08 15:49 | elapsed=492s   | executionTimeout exceeded
24/08 20:05 | elapsed=483s   | executionTimeout exceeded
```

Leitura honesta: o hang **nao "voltou"** — ele nunca parou. Sao 5 ocorrencias em
8 dias, e as 3 ultimas em 2 dias seguidos (23 e 24/08). O incidente `d3d8d1b2`
esta fechado como aceite de risco pelo Johnny. **Nao reabri** (fora do meu
escopo) — fica registrado aqui como material pra ele decidir se o aceite ainda
vale com essa frequencia. Hoje: zero hangs ate agora.

## Passo 3 — quem falhou

Hoje (25/08): **ninguem**. Nenhuma falha, nenhum aluno travado hoje.

Herdado de ontem (24/08), cruzando `profiles` (id/email/display_name) com
`credit_transactions` por `ref_type='generation_refund'` (nunca por `kind`):

| Quando | Aluno | Tipo | Estorno | Gerou com sucesso depois? |
|---|---|---|---|---|
| 24/08 00:27 | Rene Lopes / renelopes170@gmail.com | qa_coverage | ESTORNADO | sim, 00:28 |
| 24/08 01:35 | drelvislandi@gmail.com | qa_coverage | ESTORNADO | **NAO** |
| 24/08 03:41 | Jonatan Silveira / j2sproducoes@gmail.com | qa_coverage | ESTORNADO | sim, 03:48 |
| 24/08 15:49 | Braulio Marcos / brauliomarcos3@hotmail.com | hang 492s | ESTORNADO | **NAO** |
| 24/08 18:47 | Kessuly Lopes / kessulyl@gmail.com | qa_coverage | **SEM ESTORNO** | sim, 19:00 |
| 24/08 18:53 | Kessuly Lopes / kessulyl@gmail.com | qa_coverage | **SEM ESTORNO** | sim, 19:00 |
| 24/08 20:05 | Gustavo Sperandio / gusperandio2@gmail.com | hang 483s | ESTORNADO | sim, 20:17 |

Nenhuma conta de admin/socio na lista (nao entram na conta de qualquer forma).

**Dois pontos que estorno nao resolve:**

1. **Elvis (drelvislandi@gmail.com) e Braulio (brauliomarcos3@hotmail.com)** nao
   geraram nada com sucesso depois da falha — ~37h e ~23h atras. Foram
   estornados, mas continuam sem o audio que pediram. Estorno nao e caso
   resolvido. Nao falei com nenhum dos dois (fora do escopo da ronda).
2. **Kessuly Lopes falhou 2x e NAO tem estorno** por `ref_type='generation_refund'`
   em nenhuma das duas. Ela conseguiu gerar depois, entao nao esta travada, mas
   pelo que aparece na escrituracao pagou por 2 geracoes que falharam. Nao mexi
   em credito (fora do escopo) — fica pro Johnny decidir.

Total de estornos `generation_refund` desde 24/08: 6.

## Passo 4 — registro

Este arquivo, commitado direto na `main`.

Observacao: a `main` local estava 4 commits a frente da origin quando a ronda
comecou — `c109f4f`, `c80b1c5`, `9954ce4`, `8ee94a6`, todos tocando apenas
`_frank/ferramentas/` (ferramental interno, nada de produção). Sobra de ronda
anterior que nao empurrou. Vao junto neste push.

## Veredito

Dia limpo ate agora: 0 falhas em 64 geracoes. Ontem foi 4,7%. **Mas o n de hoje
ainda nao sustenta "melhorou"** — e principalmente, o build que entrou hoje nao
mexeu no qa_coverage, entao nao existe causa nova pra atribuir a queda. Trato
como dia bom, nao como problema resolvido.

O que fica no radar: os 2 alunos sem audio desde ontem, o credito da Kessuly, e
a frequencia do hang subindo (3 em 2 dias) sob um aceite de risco antigo.
