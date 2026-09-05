# Ronda diaria de qa_coverage — 05/09/2026

Medido as 15:09Z. Scripts: `_Bugs/qacov-2026-09-05.cjs`, `_Bugs/qacov-passo3-2026-09-05.cjs`.

## Resumo

**Dia limpo no qa_coverage. Zero falhas hoje, e agora com n suficiente pra dizer isso de verdade.**
Nenhum aluno travado. Duas falhas ontem, ambas de HANG (bicho diferente), ambas
estornadas e ambas com geracao bem-sucedida depois.

---

## Passo 1 — qual regua esta no ar

`runpod-worker.yml` tem caminho completo de deploy (build -> GHCR com tag do sha ->
saveTemplate -> recicla workers), entao Action verde aqui e deploy de verdade.

| run | sha | conclusion | termino (updatedAt) |
|---|---|---|---|
| chunk_max sobrescrivivel por job | `eccc3d59` | **success** | **2026-09-05T08:28:05Z** <- CORTE |
| registrar QUAIS palavras sumiram | `f8586783` | cancelled | 2026-09-05T08:04:11Z |
| instrumenta setup da inferencia (#15) | `2bd3c3f8` | success | 2026-09-05T00:41:43Z |
| resgate do ULTIMO chunk | `3bc1535d` | success | 2026-09-03T12:23:08Z |

**A regua no ar e `eccc3d59`, desde hoje 08:28:05Z.** Build verde, nada travado,
nada pendente.

O run de `f8586783` aparece como *cancelled*, mas **isso nao significa que a
mudanca ficou de fora**: `eccc3d59` e descendente dele (conferido com
`git merge-base --is-ancestor`), entao o "registrar QUAIS palavras sumiram por
chunk" **esta no ar**. O run foi cancelado por ter sido superado pelo push
seguinte 2 minutos depois, nao por falha.

**Cuidado com o molde do dia:** hoje teve DOIS builds verdes (00:41Z e 08:28Z).
Entao "hoje antes do corte" e MISTURA de duas reguas e nao serve de baseline.
O baseline limpo de uma regua so e ONTEM (09-04), que rodou inteiro sob `3bc1535d`.

## Passo 2 — medicao

Sanidade antes de acreditar em qualquer zero (licao de 29/08):
- (a) presas em `processing`/`queued` hoje: **0** — o zero nao e "ainda nao deu tempo de falhar"
- (b) `failed` com `error_message` vazio hoje: **0** — nao ha falha invisivel
- (c) status crus hoje: `{"ready": 17}` — nada alem de sucesso

| janela | total | falhas | qa_coverage | taxa qacov |
|---|---|---|---|---|
| Contexto 25/08 -> 03/09 | 882 | 11 | 10 | 1.1% |
| **ONTEM 09-04 inteiro** (regua `3bc1535d`, baseline limpo) | 51 | 2 | **0** | 0.0% |
| Hoje 00:00 -> 00:41Z (regua de ontem) | 4 | 0 | 0 | n pequeno demais |
| Hoje 00:41Z -> 08:28Z (regua `2bd3c3f8`) | 6 | 0 | 0 | n pequeno demais |
| **Hoje DEPOIS de 08:28Z (regua ATUAL `eccc3d59`)** | 7 | 0 | 0 | **n=7, pequeno demais pra concluir sozinho** |

### O denominador (a parte que mais custa errar)

A janela de hoje na regua atual tem **n=7**. Isolada, ela **nao conclui nada** —
e exatamente o erro de 29/08 (anunciar melhora em cima de faixa com n=3).

O que sustenta a conclusao **nao e o dia**, e o **acumulado desde 28/08**, que ja
cobre varias reguas seguidas sem nenhuma reprovacao:

| recorte acumulado 28/08 -> 05/09 | n | qa_coverage |
|---|---|---|
| global | **638** | **0** |
| faixa >=1000ch | **114** | **0** |
| faixa 1500-2500ch (a que mais quebrava) | **47** | **0** |

Isso e n de verdade **na faixa que quebrava**, nao so no global. Com 47 casos na
faixa 1500-2500ch e zero reprovacao, contra 5 falhas em 68 casos dessa mesma
faixa no periodo anterior, da pra dizer com seguranca: **o portao de qa_coverage
parou de reprovar, e nao e sorte de amostra pequena.** Sao 9 dias corridos sem
um unico caso (ultimo: 27/08).

### elapsed_seconds

As duas falhas de ontem tem tempo MUITO alto (579s e 484s) = **hang**, nao
reprovacao do QA. Nenhuma falha com tempo normal (40-230s), que seria a
assinatura de reprovacao do portao.

## Passo 3 — quem falhou

Duas falhas ontem, nenhuma hoje. Nenhuma das duas e admin/socio: sao alunos de verdade.

**Debora Oliveira** (`debbie994@gmail.com`, acesso ate 22/09)
- geracao `a07e9278`, 04/09 20:36Z, 1307ch, elapsed 579s -> hang
- estorno **confirmado** por `ref_type='generation_refund'` (1307 creditos, 20:56Z, casa com a geracao)
- **destravada**: gerou com sucesso 2x em 05/09 02:17Z e 02:29Z (125s cada, tempo normal)

**Renan Juste** (`renanjuste.business@gmail.com`, acesso ate 09/09)
- geracao `86254b30`, 04/09 20:47Z, 749ch, elapsed 485s -> hang
- estorno **confirmado** por `ref_type='generation_refund'` (749 creditos, 21:04Z, casa com a geracao)
- **destravado**: gerou com sucesso em 04/09 21:03Z (155s, tempo normal)

**Nenhum aluno travado agora.** Os dois tiveram o credito de volta E conseguiram o
audio depois — resolvido de fato, nao so estornado.

---

## Duas coisas pro Johnny decidir (nao mexi em nenhuma)

### 1. O hang (d3d8d1b2) reapareceu ontem — mas dentro do padrao ja aceito

Historico completo de hang desde 10/08 (`executionTimeout`):

| dia | casos |
|---|---|
| 18/08 | 2 |
| 23/08 | 1 |
| 24/08 | 2 |
| 28/08 | 1 |
| **04/09** | **2** |

Sao 8 casos em 2609 geracoes (0.3%), aparecendo em pares mais ou menos uma vez por
semana. **Os 2 casos de ontem sao o mesmo padrao de sempre, nao uma escalada** —
ja houve 2-num-dia em 18/08 e 24/08, e passaram 7 dias desde o ultimo (28/08).

A ordem diz pra reabrir o incidente **so se voltar**. Ele voltou, mas no mesmo
ritmo que o Johnny ja aceitou como risco. **Nao reabri** — e chamada dele. Registro
aqui pra decisao consciente, nao pra passar batido.

Nota util: a falha da Debora ja veio com fase instrumentada
(`[fase: inference.chunk.generate running_s=5]`), a do Renan nao
(`[fase: (sem fase instrumentada)]`). Quando o instrumento do #15 pegar, ele
aponta o ponto exato do travamento.

### 2. ACHADO NOVO: 18% das geracoes de sucesso estao sem `elapsed_seconds`

Desde 01/09, **52 de ~286 geracoes `ready` gravaram `elapsed_seconds = NULL`**.

Isso importa pra esta ronda especificamente: **o tempo e o unico jeito de separar
"reprovacao do QA" (40-230s) de "hang" (>400s)**. Com quase 1 em cada 5 sem tempo,
a proxima falha pode cair num ponto cego e ser classificada errado — que e
exatamente o tipo de erro de medicao que fez esta rotina existir.

Bate com o que a ronda das 11hZ de hoje anotou (migration 82 nunca aplicada, o
instrumento do #15 cego ha 37 dias). Nao investiguei a causa nem corrigi — fora do
escopo desta ronda. Fica registrado.

---

## Veredito

- **Deploy:** verde e no ar (`eccc3d59`, 08:28Z hoje). Nada travado.
- **qa_coverage hoje:** 0 falhas. n=7 na regua atual — **nao concluiria sozinho**.
- **qa_coverage acumulado:** 0 em 638 geracoes, 0 em 47 casos da faixa 1500-2500ch,
  9 dias corridos. **Isso sim conclui: o portao parou de reprovar.**
- **Direcao:** desceu e ficou embaixo. Nao subiu.
- **Aluno travado:** nenhum.
- **Pendente de decisao do Johnny:** reabrir ou nao o d3d8d1b2 (voltou, mas no ritmo
  ja aceito); e o buraco de `elapsed_seconds` que cega o discriminador desta ronda.
