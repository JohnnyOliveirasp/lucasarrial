# Ronda diaria qa_coverage — 2026-09-11

Rodada 15:08Z. Dia LIMPO. Nenhum aluno travado, nenhuma falha desde 04/09.

## PASSO 1 — qual regua esta no ar

`gh run list --workflow=runpod-worker.yml` — ultimo run VERDE: **2adb080**, terminou
**2026-09-08T15:22:32Z**. Nao houve build em 09, 10 nem 11/09. Nenhum run em curso.

- **Molde de hoje = "corte mais velho" (quarta licao de 10/09).** O corte caiu ha 3 dias,
  entao ONTEM (10/09) e HOJE (11/09) sao regua NOVA por inteiro. Nao existe janela
  "antes do corte" em nenhum dos dois — criar uma produziria janela vazia.
- `git log 2adb080..origin/main -- runpod-worker/` = **VAZIO**. Nao ha correcao escrita
  e nao deployada. Boa noticia que vale reportar (licao de 10/09).
- O que 2adb080 levou ao ar (PR #213: 243aa73 + 80872f5): piso
  `coverage_espalhada_min=0.65` + gate TERMINAL do resgate. Mudanca de DECISAO, ja
  apurada em 09/09 — nao reauditei o merge hoje porque o corte nao mudou.

**Confirmacao INDEPENDENTE no dado (segunda licao de 10/09):** o contador
`coverage_espalhada_piso` aparece em **10 jobs depois do corte e 0 antes**, e
`coverage_espalhada_piso_terminal` em 6 jobs (0 antes). A regua nova esta valendo pros
jobs de verdade — nao dependo so do `gh run list`.

## PASSO 2 — medicao (n paginado, 1414 linhas desde 25/08)

| Janela | total | falhas | qa_coverage | taxa |
|---|---|---|---|---|
| CONTEXTO 25/08→05/09 (reguas MISTURADAS) | 915 | 13 | 10 | 1,4% |
| REGUA ANTERIOR eccc3d59 (05/09 08:28Z→08/09 15:22Z) | 180 | 0 | 0 | 0,0% |
| 08/09 depois do corte (rabo do dia) | 179 | 0 | 0 | 0,0% |
| ONTEM 10/09 inteiro | 90 | 0 | 0 | 0,0% |
| HOJE 11/09 ate 15:08Z | 50 | 0 | 0 | 0,0% |
| **ACUMULADO REGUA NOVA (08/09 15:22Z→agora)** | **319** | **0** | **0** | **0,0%** |

**Denominador (a regra que mais importa).** Hoje isolado: n=50, mas a faixa que quebra
tem **n=9 (>=1000ch) e n=3 (1500-2500ch)** — **o dia sozinho NAO conclui nada**. Quem
conclui e o acumulado da regua: **0/319 global, 0/35 em >=1000ch, 0/12 em 1500-2500ch**.
Mesmo o acumulado: 0/12 na faixa pior, contra taxa historica de 7,4% naquela faixa,
da P(ver zero por sorte) ~ 40%. Entao **"0 na faixa pior" segue sem provar melhora**;
o que sustenta o dia limpo e o volume global, nao a faixa.

**Sanidade (terceira licao de 29/08), antes de acreditar no zero:**
- (a) presas em processing/queued hoje: **0** — o zero nao e "ainda nao deu tempo de falhar".
- (b) `failed` com `error_message` vazio hoje: **0** — nao ha falha invisivel.
- (c) status crus hoje: `{"ready":50}`.
- (d) `elapsed` NULL em ready desde a regua nova: 79/319 = **25%**, dentro da faixa normal
  13-29% encerrada em 08/09. **Sem alarme** — alarme falso gasta a credibilidade.

**Serie de qa_coverage:** ultima falha de qa_coverage foi **27/08**. De 28/08 ate agora sao
**1107 geracoes com ZERO qa_coverage**. Esse silencio PREDA a regua nova — logo a regua
nova **nao pode ser creditada** por ele. Nao havia mais o que derrubar nesse indicador.

## O indicador certo pra ESTA regua (terceira licao de 09/09)

O piso 0,65 nunca foi feito pra baixar falha; foi feito pra converter entrega
silenciosamente ruim em RESGATE. Julgar pela taxa de falha e medir a regua certa com o
indicador errado. Entao:

**Recomposicao (terceira licao de 10/09) — se confirma pela segunda ronda:**
total `coverage_rescued` ficou **12 → 12 jobs**, o que sozinho pareceria "sem efeito".
Mas o piso respondeu por **10** e o caminho organico caiu de **12 → 2**. A populacao
trocou por dentro; o total plano esconde isso.

**Qualidade de cobertura:** `coverage_min_visto` mediana 0,917 → **0,931**;
`coverage_medio` 0,977 → **0,984**. Melhora pequena e na direcao esperada.

**Entrega silenciosamente ruim** (`coverage_min_visto` < 0,65, que e o limiar que o
proprio build define): **8/139 (5,8%) → 6/240 (2,5%)**, Fisher unilateral **p = 0,093**.
**NAO conclui.** Sugestivo, na direcao certa, e so.

> ⚠️ **ARMADILHA QUE EU CAI HOJE — registrada de proposito.** Eu varri tres limiares
> (0,65 / 0,50 / 0,40). Em 0,50 deu 7/139 vs 3/240, **p = 0,032**, "significante" — e foi
> o unico dos tres. Em 0,40 volta a p=0,23. Isso e **garimpo de limiar**, nao achado:
> testando 3 limiares, Bonferroni joga o 0,032 pra ~0,096, e um efeito real nao
> apareceria so na fatia do meio e sumiria nas vizinhas. **O resultado que vale e o do
> limiar pre-registrado (0,65): p=0,09, nao conclui.** Reportar o 0,50 como vitoria seria
> a quinta licao de 10/09 se repetindo numa roupa nova.

**Custo projetado em tempo NAO apareceu:** mediana ready 96,46s → 97,24s (media 99→103s).
Em >=1000ch a mediana ate CAIU (168,87 → 160,9s; p90 330,9 → 280,8s). Com esse n nao
afirmo melhora de tempo — afirmo que **a piora projetada nao se materializou**.

## PASSO 3 — quem falhou

**Ninguem.** Zero falhas desde 10/09 (janela do relatorio) e zero na regua nova inteira.
A ultima falha foi 04/09 (2 casos, `executionTimeout`, NAO qa_coverage), ja verificados
em 07/09: ambos os alunos voltaram a gerar com sucesso (Debora 05/09, Renan 07/09) —
desfecho de verdade, nao so estorno. Nada pendurado.

## Vigilancia aberta pra amanha

- Hang (incidente d3d8d1b2, aceite de risco do Johnny): `max` de elapsed na regua nova =
  378,9s, dentro do normal. **Nao reabrir.**
- O acumulado de 319 e o que conclui hoje. Se entrar build REAL em runpod-worker/, ele
  **zera** e volto a ter n pequeno — anotar na hora pra nao estranhar o contador baixo
  (habito que salvou a leitura de 09/09).
