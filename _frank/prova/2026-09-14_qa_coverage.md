# 14/09 — Saúde do QA de áudio (qa_coverage)

Script do dia: `/tmp/perf/qacov-2026-09-14.cjs` (cabeçalho de lições + corpo novo,
`node --check` antes de rodar). Saída crua: `/tmp/perf/out-0914.txt`.
Base lida: 1628 gerações desde 25/08. Medição às 15:09Z.

## Resumo em uma linha

Dia limpo: **0 falhas em 46 gerações hoje**, zero `qa_coverage`. A régua no ar
tem **seis dias** e não há correção escrita esperando deploy. Nada urgente.
Nenhum aluno travado.

---

## PASSO 1 — Qual régua está no ar

`gh run list --workflow=runpod-worker.yml`: o último verde continua sendo
**2adb080, 08/09 15:22:32Z**. Não houve build em 09, 10, 11, 12, 13 nem 14/09.
**Nenhum run falhou** — não há correção que tenha ficado de fora.

`git log 2adb080..origin/main -- runpod-worker/` saiu **vazio** de novo: não
existe correção escrita e não deployada. O que está no código é o que está no ar.

**Confirmação independente no dado** (lição 2 de 10/09, para não depender só do
`gh run list` — que é onde errei em 19-20/08, 07/09 e 08/09):
`coverage_espalhada_piso` = **0 jobs na régua anterior** → **13 jobs na régua
nova**, exatamente no corte. O contador novo do build só aparece depois de
08/09 15:22Z. Régua nova **confirmada valendo para os jobs**.

Molde das janelas: o corte caiu há seis dias, então não existe "hoje antes do
corte" nem "ontem antes do corte". De 09/09 a 14/09 é régua nova por inteiro, e
**quem conclui é o acumulado**, não o dia.

---

## PASSO 2 — Os números

### Sanidade antes de acreditar em qualquer zero

| Checagem | Resultado |
|---|---|
| (a) Gerações presas hoje (`processing`/`queued`) | **0** — o zero não é "ainda não deu tempo de falhar" |
| (b) `failed` com `error_message` vazio hoje | **0** — nenhuma falha invisível |
| (c) Status crus hoje | `{"ready": 46}` — nada além de sucesso |
| (d) `elapsed` NULL em `ready` na régua nova | 136/538 = **25%** (faixa normal 13-29%, encerrada em 08/09 — sem alarme) |

### (e) Checagem fixa do denominador que encolhe — lição 2 de 13/09

Primeira vez rodando isso como checagem fixa. Recontei o **período inteiro**
contra o que a ronda de 13/09 registrou:

| Filtro (desde 25/08) | 13/09 registrou | Hoje lê | Δ |
|---|---|---|---|
| Falhas de `qa_coverage` | 11 | **11** | 0 |
| Falhas totais | 14 | **14** | 0 |

**Bate exato.** Nenhuma linha de falha de dia já fechado sumiu. Sem isso, uma
linha de falha apagada por um aluno melhoraria a taxa sozinha e eu nunca ficaria
sabendo.

### Janelas

| Janela | n | Falhas | `qa_coverage` | Taxa | ≥1000ch | 1500-2500ch |
|---|---|---|---|---|---|---|
| Régua ANTERIOR eccc3d59 (baseline limpo) | 180 | 0 | 0 | 0,0% | 0/26 | 0/14 |
| 09/09 | 118 | 0 | 0 | 0,0% | 0/9 | 0/3 |
| 10/09 | 90 | 0 | 0 | 0,0% | 0/12 | 0/4 |
| 11/09 | 100 | 1 | 1 | 1,0% | 0/14 | 0/5 |
| 12/09 (sáb) | 75 | 0 | 0 | 0,0% | 0/22 | 0/5 |
| **ONTEM 13/09 (dom)** | 51 | 0 | 0 | **0,0%** | 0/14 | 0/4 |
| **HOJE 14/09 até 15:09Z** | 46 | 0 | 0 | **0,0%** | 0/10 | 0/2 |
| **ACUMULADO régua nova (08/09 15:22Z →)** | **539** | **1** | **1** | **0,2%** | **0/86** | **0/25** |

### O que dá e o que não dá pra concluir com esse n

- **Hoje isolado não conclui.** n=46 passa do piso global de 20, mas o
  denominador que vale é o da **faixa que quebra**: ≥1000ch tem n=10 e
  1500-2500ch tem **n=2**. Zero em n=2 não é informação.
- **O acumulado da régua nova sustenta o dia, com ressalva.** 0/86 em ≥1000ch é
  o número que segura a leitura. Mas **na faixa 1500-2500ch nem o acumulado
  prova**: 0/25, e P(ver zero por sorte na taxa histórica de 7,4%) = **14,6%**.
  Sugestivo, não provado. Digo as duas coisas separadas, como manda 11/09.
- **A única falha da régua nova (11/09) era esperada, não é piora.** Taxa
  pós-28/08 = 1/1326 = **0,08%**. Com n=539, P(ver ≥1) = **33,4%**. Contra-prova
  pelo outro lado: se a taxa tivesse voltado à histórica de 1,1%, o esperado
  seriam **5,9 falhas**, não 1. O dado segue consistente com "continua baixa".
- **Não credito a régua nova pelo dia limpo.** O indicador já estava no chão
  antes dela (lição de 11/09). Dia limpo aqui é continuidade, não resultado.

### Elapsed — custo projetado do piso 0,65

| Recorte | Régua anterior | Régua nova |
|---|---|---|
| `ready` geral | n=139, mediana 96,5s, p90 169s | n=402, mediana **100,1s**, p90 179s |
| ≥1000ch | n=26, mediana 168,9s, p90 331s | n=86, mediana **157,3s**, p90 259s |

Mediana geral sobe 3,6s; em texto longo **cai** 11,6s (com n bem maior do lado
novo). Ou seja: o custo projetado do piso não apareceu como regressão de tempo.
Nada aqui pede ação.

### Mecanismo (coluna `qa`) — recomposição, não estagnação

`coverage_rescued` foi de 12 → 20 jobs. Quebrando por sub-caminho:
**piso 0 → 13**, **orgânico 12 → 7**. A população trocou por dentro, exatamente
o padrão de 10/09. `coverage_exhausted` = 1 em 539 (é a falha de 11/09).

---

## PASSO 3 — Quem falhou

**Nenhuma falha nova desde ontem.** A única falha da régua nova continua sendo a
de 11/09 20:53Z, e hoje fechei o desfecho dela em vez de parar no estorno:

- Aluno: **Diego Gomes Goudard** (`goudardexecutivo@gmail.com`), texto de 354ch.
- Estorno conferido por **`ref_type='generation_refund'`** (nunca por `kind`):
  400 créditos em 11/09 20:57Z. Confirmando a armadilha da ordem — a linha grava
  `kind='extra_purchase'`; filtrar por `kind` faria parecer que ninguém foi
  estornado.
- **Mas estorno não é desfecho.** A pergunta certa é se o aluno conseguiu o que
  pediu: ele refez o **mesmo texto de 354ch** 5 minutos depois e saiu
  `ready` (109,7s), e de novo às 21:02 (179,6s). **Conseguiu. Caso fechado.**
- `access_until` = NULL. É a armadilha 3 (virada das 12:00 UTC) e **não** marco
  como pagante travado: a ronda diária de hoje já rodou `pagante_trancado.cjs`
  e deu **0 pagantes sem acesso**, e ele está gerando normalmente.

**Zero alunos travados agora.**

---

## PASSO 4 — Pré-registro H-idioma: o que mudou e o que eu quase errei

Pré-registrado em 12/09, com n calculado em 13/09. Janela: gerações de 13/09 em
diante, **acumulando** — sem reaproveitar as 1182 já vistas.

Hoje: **97/600 gerações novas**, e **0 casos divergentes** entre as 71 com
coluna `qa` (idiomas detectados: `{"pt": 15}`). Esperado ~2 divergentes em 97
pela taxa de preenchimento conhecida, então 0 está dentro do ruído.
**Veredito: ainda acumulando. Não conclui, e não deve.** Hipótese segue aberta.

**Erro que o próprio script cometeu e eu corrigi antes de reportar:** a conta de
ritmo dele deu "59/dia → faltam 8,5 dias → ~23/09", e eu ia escrever que o alvo
de 20/09 tinha escorregado. Está errado: essa média engole um **domingo** e uma
segunda **pela metade**. Comparando o mesmo horário de cada dia:

| Dia | até 15:09Z | dia todo |
|---|---|---|
| 10/09 (qui) | 43 | 90 |
| 11/09 (sex) | 48 | 100 |
| 12/09 (sáb) | 27 | 75 |
| 13/09 (dom) | 13 | 51 |
| **14/09 (seg)** | **46** | — |

Em dia útil o ritmo é 90-100/dia. Projetando assim, as ~600 chegam por volta de
**20-21/09**, que é o alvo original. **O alvo não escorregou.**

Isso também mata a segunda leitura errada que eu ia dar: a série 118 → 90 → 100
→ 75 → 51 → 46 **não é queda de volume**. 12 e 13/09 foram sábado e domingo, e
hoje (segunda) às 15:09Z está em 46 — a **maior leitura de mesma hora** de
qualquer segunda da série (07/09 tinha 26). Volume saudável.

**Lição nova (14/09), na série de 10, 11 e 13/09:** "calcule o p antes do verbo",
"o limiar antes do p", "o n antes da data" — e agora **compare o mesmo horário
antes de chamar de tendência**. Média de janela que mistura fim de semana com dia
parcial fabrica tendência dos dois lados: ia me fazer anunciar atraso do
pré-registro *e* queda de volume, e nenhum dos dois existia. Quando a série tiver
dia da semana, olhe o dia da semana antes de traçar a reta.

---

## Pendências registradas

- **H-idioma**: 97/600, alvo ~20-21/09. Não alargar a janela pra trás para achar
  poder. Se em 20/09 o n de divergentes ainda for < 8, o resultado certo é
  continuar sem resultado.
- **Números para a checagem de denominador de amanhã**: `qa_coverage` desde
  25/08 = **11**; falhas totais desde 25/08 = **14**.
- **Régua no ar**: 2adb080 (08/09 15:22Z), seis dias, nada pendente de deploy.
  Se aparecer build verde novo em `runpod-worker/`, o acumulado de 539 reinicia —
  anotar na hora, como em 08/09.
- Incidente d3d8d1b2 (hang) segue fechado como aceite de risco. Nenhum elapsed
  suspeito hoje (máximo 378,9s, dentro do normal para texto longo).

## O que eu não fiz

Não respondi aluno, não mexi em crédito, não abri nem fechei incidente, não
toquei no endpoint do RunPod.
