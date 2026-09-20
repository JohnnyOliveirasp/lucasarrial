# Ronda diária — saúde do qa_coverage — 20/09/2026 (leitura 15:10Z, domingo)

Script: `/tmp/perf/qacov-2026-09-20.cjs` (saída `/tmp/perf/out-0920.txt`, 574 linhas,
exit=0). Apoio: `_aluno_0920.cjs`, `_poder_0920.cjs`, `_frota_0920.cjs`,
`_frank/ferramentas/pagante_trancado.cjs`.

## 0. O que conclui hoje

**Build novo hoje — o primeiro em cinco dias — e ele está VERDE.** `d49837f`
terminou 00:20:17Z. **Não é corte de régua** (telemetria; ver §1). Nenhum run
falhou, nenhum `in_progress`. Sem notícia ruim de deploy.

**Nenhum aluno travado.** 17 falhas na régua nova, **17/17 estornadas**, e os 6
alunos receberam entrega. `pagante_trancado.cjs`: **0 pagantes trancados**, 0 na
fronteira, 1 sem prova.

**ONTEM (19/09) fechou LIMPO: 0 falhas em 57 gerações.** Dia fechado, é a janela
que conclui. **Três dias fechados seguidos sem falha nenhuma** (18, 19/09 = 140
gerações), mais as 18 de hoje.

**HOJE não diz nada** — 0/18 às 15:10Z, e o corte das 15:10Z nunca viu uma única
falha em 12 de 12 dias. Ver §3.

> **O achado é o teste pré-registrado: ele BATEU o critério de parada e o
> critério era fraco.** H-idioma fechou em 8 divergentes com "não confirma" —
> **com 26% de poder.** Ver §5. É a única coisa desta ronda que muda o que eu
> faço amanhã.

> **Registro que não é de QA e não é meu para agir:** Tania Regina
> (`taniaregina.espadaro@gmail.com`) tem `access_until = 2026-09-21T12:00Z` —
> **morre em menos de 24h.** Está parada há 3,8 dias e **a última coisa que ela
> viu na plataforma foram duas falhas seguidas**. Ela não está travada (recebeu
> o áudio, §4), mas a sequência é feia. Decisão do Johnny.

---

## 1. Qual régua está no ar (PASSO 1)

`gh run list --workflow=runpod-worker.yml --limit 8`:

| run | conclusion | sha | terminou |
|-----|-----------|-----|----------|
| **último** | **success** | `d49837f` | **2026-09-20T00:20:17Z** |
| anterior | success | `b2d9f47` | 2026-09-15T03:49:41Z |
| anterior | success | `7b673a7` | 2026-09-15T02:44:36Z |
| anterior | success | `2adb080` | 2026-09-08T15:22:32Z |

Apareceu build depois de cinco dias parado. **Critério, não gatilho** (lição de
15/09) — e o critério é o diff dos commits que o build realmente levou ao ar
(lição de 09/09, o `--stat` de merge mente):

```
git log d49837f^1..d49837f          -> UM commit: 1be32f56
git diff --numstat 1be32f56^1 1be32f56 -- runpod-worker/
    22  1  runpod-worker/jobs/inference.py
   227  1  runpod-worker/test_fase_telemetria.py
    88  0  runpod-worker/worker_log.py
grep -i "qa_cov|coverage|threshold|piso" no diff completo -> VAZIO
```

A **única** remoção em `inference.py` é a linha de import virando multilinha. O que
o commit faz: o heartbeat passa a levar o contador `regens` **acumulado** junto da
fase, pra que job morto no teto do `executionTimeout` deixe registrado quantas
tentativas queimou (hoje esse número só é persistido no FIM e morre com o SIGKILL —
19 de 19 timeouts medidos com `regens` nulo). Está dentro de `try/except` que nunca
derruba geração de aluno.

> **Telemetria pura. Não muda limiar nem fluxo. Régua vigente segue `2adb080`
> (08/09 15:22Z) — DOZE dias no ar. O acumulado NÃO reinicia.**

**Confirmação independente no dado** (regra de 10/09, não confio só no diff):
`coverage_espalhada_piso` = **0** na régua anterior e **24** na nova;
`..._piso_terminal` = 0 → 20. Os contadores do build de 08/09 só existem do lado
de lá. Régua confirmada no dado.

`git log d49837f..origin/main -- runpod-worker/` → **VAZIO**: não existe correção
escrita e não deployada.

### 1.1 O que este build de telemetria FAZ de real — e que eu quase deixei passar

`saveTemplate` recicla os workers 0→N. **Houve troca de frota às 00:20Z de hoje.**
Cold start é consequência REAL de um build de telemetria — o build não muda a
régua, mas muda a máquina. Medi em vez de supor (`_frota_0920.cjs`):

```
ready régua nova ATÉ 00:20Z : n=712 | mediana= 95,4s | p90=180,5s
ready DEPOIS da reciclagem  : n= 11 | mediana= 98,9s | p90=192,4s
primeira geração pós-frota  : 00:27:20 | 2000ch | 218,3s  (dentro do p90 de >=1000ch, 258,6s)
```

**n=11. NÃO CONCLUI nada sobre cold start, nem pra melhor nem pra pior.** Fica o
registro de que não houve estouro visível na primeira geração da frota nova.
Reconferir amanhã com o dia fechado.

---

## 2. Os números (PASSO 2)

Acumulado da régua nova (08/09 15:22Z → agora): **17/988 = 1,72%** de falha,
**2/988 = 0,20%** de `qa_coverage`.

| janela | total | falhas | taxa | qa_cov | conclui? |
|--------|-------|--------|------|--------|----------|
| 15/09 | 94 | 0 | 0,0% | 0 | sim |
| 16/09 | 77 | 4 | 5,2% | 0 | sim |
| 17/09 | 76 | 12 | 15,8% | 1 | sim — pior da série |
| 18/09 | **83** (era 84) | 0 | 0,0% | 0 | sim |
| **19/09 (ONTEM)** | **57** | **0** | **0,0%** | **0** | **sim** |
| 20/09 até 15:10Z | 18 | 0 | 0,0% | 0 | **não — n=18, e ver §3** |

Por episódio (lição 2 de 19/09 — retry do mesmo aluno/mesmo texto em 45 min não é
evento novo do sistema):

| janela | falhas | episódios | maior retry | alunos |
|--------|--------|-----------|-------------|--------|
| 16/09 | 4 | 2 | 3x | 2 |
| 17/09 | 12 | 7 | 5x | 4 |
| 18, 19, 20/09 | 0 | 0 | — | 0 |
| régua nova inteira | 17 | **10** | 5x | 6 |

**Régua nova por linha 1,72% · por episódio 1,01%.** As duas leituras respondem
perguntas diferentes e vão as duas.

### 2.1 A sequência limpa — o que ela é e o que ela não é

Última falha de qualquer tipo: **17/09 22:08:27Z**. De lá pra cá, **158 gerações
sem nenhuma falha** (83 + 57 + 18), ~65 horas.

Antes de chamar isso de melhora, a conta das duas direções (lição de 12/09):

- Na taxa **global** da régua nova (1,72%), o esperado em 158 seria 2,7 falhas.
  P(ver zero) = **6,4%**. Sozinho pareceria notável.
- Mas tirando o cluster de 16-17/09, a régua nova é **1/835 = 0,12%**. Nessa taxa
  o esperado em 158 é 0,19 falha e P(ver zero) = **83%**.

> **A sequência limpa é exatamente o que se espera se 16-17/09 foi um episódio e
> a linha de base continua sendo a de antes dele.** Não é evidência de correção —
> e não houve correção: nada foi ao ar entre 15/09 e hoje 00:20Z, e o que foi
> hoje é telemetria. Creditar o deploy pelo dia limpo seria inventar efeito.

### 2.2 Volume: o 57 de ontem parece queda e NÃO é

19/09 fechou em 57, contra 83, 76, 77, 94 dos dias anteriores. Parece despencar.
**19/09 foi SÁBADO** (lição de 14/09: imprima o dia da semana antes de traçar reta):

```
sábados : 29/08=57 · 05/09=28 · 12/09=72 · 19/09=57   -> mediana 57
domingos: 30/08=57 · 06/09=49 · 13/09=50 · 20/09=parcial
```

**57 é a mediana exata dos sábados.** Nada aconteceu com o volume. E hoje, domingo,
18 às 15:10Z contra **12** no mesmo horário do domingo passado (13/09, que fechou
em 50): hoje está **acima** do domingo comparável. Sem alarme de volume.

### 2.3 Integridade da base

- **(e) numerador:** falhas desde 25/08 hoje=**30**, véspera registrou=30. qa_cov
  12=12. Delta 0. **Nenhuma falha de período fechado sumiu.**
- **(e2) denominador:** `2026-09-18: véspera=84, vivo=83, delta=-1`. **Uma linha
  sumiu de um dia fechado.** Conferido contra (e): as falhas totais continuam 30 e
  18/09 continua com 0 falhas ⇒ **a linha apagada era um SUCESSO**. A taxa de 18/09
  segue 0/83 = 0,0% (numerador zero, então nem a direção perigosa se aplica aqui).
  Terceiro dia consecutivo em que uma linha some de dia fechado. Não promover
  nenhum dia a "estável" (quinta lição de 17/09).
- (a) presas hoje: **0**. (b) `failed` com error vazio: **0**. (c) status crus hoje:
  `{"ready":18}`. (d) elapsed NULL em `ready`: **26%** (faixa normal 13-29%).
- **Assinaturas de erro inéditas desde 19/09: 0** — não houve falha nenhuma.

### 2.4 Taxonomia completa de `error_message` (lição 6 de 17/09)

O indicador da rotina é uma pergunta, não atestado de saúde. Régua nova inteira:

```
  9x | 17/09 20:01 -> 17/09 22:08 | "RunPod COMPLETED"
  2x | 11/09 20:53 -> 17/09 20:18 | "qa_coverage: audio ... apos esgotar regeneracoes"
  2x | 16/09 19:24 -> 16/09 19:51 | "RunPod FAILED: System error."
  2x | 16/09 19:28 -> 16/09 19:47 | "System error."
  1x | 17/09 16:00                | "SubprocException: ... torch/_inductor ... triton"
  1x | 17/09 21:25                | "unknown"
```

**O indicador que esta rotina existe pra vigiar (`qa_coverage`) responde por 2 de
17 falhas.** As outras 15 são infra (`System error.`, `RunPod COMPLETED`,
`SubprocException`), e 12 delas estão em dois dias. Continua valendo o que 18/09
escreveu: o achado mora fora do indicador.

---

## 3. A ronda continua cega para a noite — e hoje ela não foi testada

O achado de 19/09 reconferido com o dado de hoje:

```
régua nova, 00:00-14:59Z : 0/396 = 0,00%
régua nova, 15:00-23:59Z : 17/592 = 2,87%     Fisher p = 0,000202
TIRANDO 16 e 17/09       : dia 0/340 vs noite 1/495 | Fisher p = 1,0000
```

> **O p de 2e-4 é inteiramente carregado por dois dias.** Tirando 16 e 17/09 não
> sobra nada. **Não existe evidência de mecanismo "falha acontece à noite"** e eu
> não vou escrever que existe.

O que não precisa de significância nenhuma: **das 17 falhas da régua nova, zero
aconteceram antes das 15:10Z do dia.** O corte em que esta ronda roda devolve 0
em 12 de 12 dias — inclusive na véspera de 17/09 fechar em 15,8%.

**Cobrança da previsão que a ronda de ontem deixou escrita:**

```
19/09 FECHADO                     : 0/57
a ronda de ontem viu (até 15:21Z) : 0/29 = 51% do dia
veio DEPOIS dela                  : 0/28
```

A previsão **não foi testada** — o dia fechou sem falha nenhuma, então o
instrumento não foi exercitado. **Isso não é ponto a favor da ronda.** Um dia
limpo não distingue "a ronda enxerga" de "a ronda é cega"; só um dia sujo
distingue, e esse não veio. A recomendação de 19/09 (segunda passada ~23:30Z)
segue **de pé e não executada** — depende do Johnny.

---

## 4. Quem falhou (PASSO 3)

**Nenhuma falha nova desde 17/09 22:08Z.** Então a pergunta não é "quem falhou
hoje", é "algum dos que falharam segue sem o que pediu?". Sequência crua lida
linha a linha (lição 2 de 17/09: veredito de ferramenta não é árbitro).

Estorno conferido por `ref_type='generation_refund'` (nunca por `kind` — o estorno
grava `kind='extra_purchase'`). Admin/sócio fora da conta.

| aluno | ger | falhas | estorno | recebeu? | parado há |
|-------|-----|--------|---------|----------|-----------|
| Mariana Macedo Leme | 58 | 8 | 8/8 | **sim** — 11 prontas depois | 1,6d |
| Tania Regina Espadaro | 5 | 3 | 3/3 | **sim** — ver abaixo | **3,8d** |
| Flavio Gabbriel | 7 | 1 | 1/1 | **sim** — 5 prontas depois | 2,9d |
| Semear Riquezas | 9 | 2 | 2/2 | **sim** — 7 prontas, uma HOJE 14:04 | 0,0d |
| Roseni M. Pimentel | 6 | 2 | 2/2 | **sim** — 4 prontas, 1999ch em 19/09 | 0,8d |
| Diego Gomes Goudard | 9 | 1 | 1/1 | **sim** — 2 prontas depois | 8,8d |

**17/17 estornadas. Zero falhas sem estorno. Nenhum aluno travado.**

**Tania Regina — reconferido, NÃO está travada.** A sequência crua:

```
16/09 17:40 ok      97ch
16/09 19:28 FALHOU  1350ch
16/09 19:40 ok      1350ch   <<< ela RECEBEU o áudio que pediu
16/09 19:47 FALHOU  1350ch   (retry de texto que ela já tinha)
16/09 19:51 FALHOU  1350ch   (idem)
```

Confirma o que 19/09 achou. A linha "0 gerações prontas depois da última falha"
que a ferramenta imprime **mente aqui**, porque sucesso e falha se intercalam —
exatamente a armadilha de 17/09.

**Mas há um fato novo, e ele não é de QA:** `access_until = 2026-09-21T12:00Z`,
**menos de 24h**. Parada há 3,8 dias. A última coisa que ela viu foram duas falhas
seguidas. Roseni (que em 18/09 eu marquei como prioridade) **voltou e gerou 1999ch
com sucesso em 19/09** — essa fechou bem. A Tania não voltou. **Registro pro
Johnny decidir; não é minha para agir.**

**Diego Gomes Goudard:** `access_until` NULL, parado há 8,8 dias. NULL sozinho não
prova nada (lição 3 de 13/09) — `pagante_trancado.cjs` rodado hoje: **0 pagantes
trancados**, 0 na fronteira, **1 sem prova** (`drfabiovilhena29@gmail.com`, sem
subscriber code no payload da Hotmart). Diego não está entre os trancados.

---

## 5. ACHADO DA RONDA — o teste pré-registrado bateu o alvo, e o alvo era fraco

H-idioma (pré-registrado 12/09, n calculado 13/09, alvo recalculado 15/09).
**Critério de parada: 8 divergentes. Hoje bateu: 8.**

```
ACUMULO: 551 gerações novas (alvo projetado era 828)
COM divergência : 0/8   = 0,0%
SEM divergência : 7/393 = 1,8%
Fisher bilateral p = 1,0000
>>> VEREDITO PRÉ-REGISTRADO: NÃO CONFIRMA no dado novo
```

A hipótese que nasceu de garimpo em 12/09 (divergência de idioma associada a mais
falha, 12,5% vs 0,8%, p=2,7e-4) **não se sustentou em dado que não existia quando
ela nasceu.** Esse era o teste, e ele foi honrado: janela fechada, sem alargar
para trás, sem reaproveitar as 1182 linhas já vistas.

**E agora a parte que me obriga a segurar a manchete.** Calculei o poder
(`_poder_0920.cjs`) — *depois* de fixar o critério, não antes de escolher o verbo:

```
com 8 divergentes, quantas falhas seriam precisas pra p<0,05?
  a=0/8 -> p=1,00000
  a=1/8 -> p=0,15011
  a=2/8 -> p=0,01171   <<< só a partir de 2

PODER REAL = P(a>=2 | efeito de 12,5% REAL, n=8) = 26,4%
P(ver ZERO falhas mesmo com o efeito 100% real)   = 34,4%
esperado sob H1: 1,00 falha. Observado: 0.
```

> **"Não confirma" com 26% de poder não é refutação — é um teste que quase não
> podia dar outra coisa.** Ver zero falhas entre 8 divergentes acontece **34% das
> vezes mesmo se o efeito for inteiramente real.** O alvo de 8 divergentes
> **nunca foi defensável**, e isso não é culpa do resultado: era calculável em
> 15/09, quando o alvo foi fixado.

Quantos divergentes seriam precisos de verdade:

| divergentes | precisa a>= | poder |
|---|---|---|
| 8 (o alvo usado) | 2 | **26%** |
| 16 | 2 | 61% |
| 30 | 3 | 74% |
| **50** | 4 | **89%** |

A 1,45% de divergência por geração, 50 divergentes ≈ **3.450 gerações** ≈ **45
dias** no ritmo honesto de 76/dia. Ordem de grandeza completamente diferente de
"~22-23/09".

**O que eu NÃO vou fazer:** estender a janela em silêncio até o número aparecer.
Decidir isso depois de ver o resultado é escolher a janela pelo resultado — a
doença das lições de 10, 11 e 13/09, e seria pior aqui porque eu já sei o que o
dado atual diz.

> **Veredito: teste pré-registrado ENCERRADO como pré-registrado, resultado "não
> confirma", com a ressalva de que ele não tinha poder para refutar. A hipótese
> fica INDECIDIDA.** Reabrir exige **novo** pré-registro, com n calculado para
> poder (≈50 divergentes, ≈45 dias) — e essa é uma decisão de prioridade do
> Johnny, não minha. Se ninguém reabrir, ela morre aqui, e morrer assim é um
> desfecho honesto.

Idiomas no dado novo: `pt=66, en=2, de=1, es=1, tr=1, zh=1`.

**Contaminação registrada em 17/09, cobrada agora que o teste fechou:** as 4
falhas de `System error.` de 16/09 caem no braço "SEM divergência" e nada têm a
ver com H-idioma. Tirando-as, o braço de controle vai a 3/389 = 0,77% — e o
Fisher continua 1,0000 (numerador do braço de teste é zero). **Não muda o
veredito**, e registro porque prometi registrar, não porque ajuda.

---

## 6. Para a ronda de 21/09

No `/tmp/perf/qacov.cjs` (base) — concatenar cabeçalho + corpo e `node --check`,
nunca `cp` o script do dia por cima:

```js
ONTEM_QACOV_DESDE_2508  = 12    // inalterado: nenhuma qa_cov em 19 nem 20/09
ONTEM_FALHAS_DESDE_2508 = 30    // inalterado: nenhuma falha em 19 nem 20/09
ONTEM_ROTULO            = "20/09"
HOJE = "2026-09-21"; ONTEM = "2026-09-20"
```

`TOTAIS_FECHADOS_VESPERA`:
- **trocar** `"2026-09-18": 84` → **83** (valor vivo; a linha apagada não pode ser
  reportada de novo amanhã como se fosse nova);
- **acrescentar** `"2026-09-19": 57` (primeira leitura de 19/09 fechado);
- **20/09 NÃO entra** — hoje ele é o dia parcial, e parcial como linha de base cria
  delta positivo falso.

Promover 19/09 a janela de dia fechado com data ABSOLUTA nos dois lados; ONTEM
passa a `2026-09-20T00:00:00Z -> 2026-09-21T00:00:00Z`.

**Critério, não gatilho, para o build `d49837f` (00:20Z de hoje):** ele já está
classificado como telemetria e **não** é corte. Se aparecer build novo amanhã,
rodar de novo `git log <sha>^1..<sha>` + `numstat` por commit + grep de
`qa_cov|coverage|piso|threshold`, e só partir a janela se houver mudança de
DECISÃO. Verde não é corte.

**Pendências abertas (nenhuma é minha para executar):**
1. Segunda passada da ronda ~23:30Z — recomendada em 19/09, **não executada**,
   depende do Johnny. Hoje ela não foi testada porque o dia fechou limpo.
2. H-idioma: encerrado sem poder. Reabrir exige novo pré-registro (§5).
3. Tania Regina: acesso vence 21/09 12:00Z (§4).
4. Reconferir elapsed da frota reciclada às 00:20Z com o dia 20/09 fechado (§1.1,
   hoje n=11).

---

## 7. Lições desta ronda

1. **Bater o critério de parada não é o mesmo que o critério ter sido bom.** Eu
   pré-registrei (12/09), calculei o n (13/09), recalculei quando a premissa
   envelheceu (15/09) e honrei a janela (hoje) — e mesmo assim o teste fechou com
   26% de poder, porque as três checagens perguntavam *"o n ainda alcança 8
   divergentes?"* e nenhuma perguntava *"8 divergentes conseguem produzir
   p<0,05?"*. A série 10/09 → 13/09 ("calcule o p antes do verbo", "o limiar antes
   do p", "o n antes da data") ganha o elo que faltava: **calcule o PODER antes do
   critério de parada** — e o poder se calcula no tamanho da célula RARA, não no n
   total. Um pré-registro disciplinado em tudo menos no poder produz um "não
   confirma" que não significa nada, e o perigo é ele *parecer* um resultado.
2. **"A previsão não foi testada" é um desfecho, e não é neutro.** A ronda de
   ontem previu que 0/29 não valia nada. Hoje 19/09 fechou limpo, então a previsão
   não foi exercitada. A tentação é ler isso como a ronda tendo acertado. Não é:
   um dia limpo devolve a mesma leitura num instrumento bom e num instrumento
   cego. **Checagem só se valida em dia sujo** — e continuar sem dia sujo é sorte,
   não validação.
3. **Build de telemetria não muda a régua, mas troca a máquina.** `saveTemplate`
   recicla a frota 0→N: o diff é inofensivo e o deploy não é. Quase arquivei
   `d49837f` como "telemetria, ignorar" pelo reflexo certo das lições de 07-09/09.
   O reflexo está certo para a *régua* e errado para o *ambiente*. Classificar um
   build tem duas perguntas, não uma: muda decisão? e troca o que está rodando?
4. **Queda de volume que respeita o calendário não é queda.** 19/09 caiu de 83
   para 57 e a leitura parecia óbvia — até imprimir o dia da semana: 57 é a
   mediana exata dos sábados da série. Lição de 14/09 valendo pela terceira vez.
   Construa a linha de base do MESMO dia da semana antes de dar nome ao desvio.
5. **Sequência limpa longa se julga contra a taxa CERTA.** 158 gerações sem falha
   dão P=6,4% na taxa global (parece notável) e P=83% na taxa sem o cluster de
   16-17/09 (é o esperado). A escolha do denominador decide se a notícia é "algo
   melhorou" ou "voltou ao normal" — e a segunda é a verdadeira, porque nada foi
   corrigido no meio.
