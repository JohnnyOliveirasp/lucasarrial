# Ronda das falhas — 08/09/2026, ~21h20–22h00Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08).

**Card levado adiante:** `#15` (`d3d8d1b2`) — o mais antigo aberto com aluno
afetado depois dos dois que estão travados em decisão do Johnny.
**Estado no fim:** `#15` segue `investigating`, agora com **duas hipóteses
refutadas com medição** e o próximo passo definido. Um fix comment-only na
produção (PR #216). Zero GPU, zero crédito, zero e-mail, zero migration,
zero mudança de comportamento em código.

---

## 0. A ronda em uma linha

**As duas explicações que o `#15` carregava — "a régua é curta" e "o loop de
regen do QA queima o teto" — são as duas FALSAS, medidas em 161 gerações. E a
margem de segurança que o código documentava (2,5×) era 1,6× de verdade, porque
foi calibrada num relógio que não enxerga ~85s de setup.**

## 1. Por que o `#15`, e não outro

Regra 8: o mais antigo com aluno afetado. Ordenando os 44 abertos por
`first_seen_at`, a fila começa em `#312` (09/06) e `#313` (09/06) — **os dois
travados na decisão comercial** que a ronda das 20h mandou pro grupo e que o
Johnny ainda não respondeu (confirmado: nenhuma ordem nova em
`_frank/ordens/`, nada novo no git). Não é falta de investigação, é decisão que
não é minha. **Passo em que emperram:** honrar ou revogar os 15 entitlements
vitalícios de produto de curso.

O próximo é o `#15`: **30/07, 40 dias, 18 alunos afetados**. Peguei esse.

## 2. Playbook, passo 1: o dinheiro já está resolvido? SIM, e conferido

19 gerações que morreram em `executionTimeout`, casadas **por `ref_id`** com o
extrato e somadas **por SINAL** (débito negativo + estorno positivo):

| conferência | resultado |
|---|---|
| gerações com timeout | 19 |
| saldo ≠ 0 (aluno no prejuízo) | **0** |

Todas com `generation` + `generation_refund` e saldo exatamente 0. **Nenhum
aluno está sem crédito.** Não usei filtro por `kind` (a armadilha da ordem de
20/08) nem confiei só no nome do `ref_type`: o casamento por `ref_id` é a prova.

## 3. A instrumentação está MESMO no ar? Sim — provado por dado

O worker é imagem Docker: merge na `main` **não** é deploy. E "build verde" já
mentiu nesta casa (apagão de 05/09). Então não aceitei o workflow verde como
prova — fui no banco:

| dia | gerações | com `qa.setup_s` |
|---|---|---|
| 03/09 | 70 | 0 |
| 04/09 | 49 | 0 |
| **05/09** | 28 | **20** |
| 06/09 | 49 | 35 |
| 07/09 | 85 | 66 |
| 08/09 | 60 | 40 |

O campo nasce em 05/09, logo depois do merge de `2bd3c3f` (04/09 23:42Z). **A
instrumentação de setup está viva em produção**, e o heartbeat com
`chunk`/`attempt` (`b55db26`) desde 08/09. As linhas sem `setup_s` são as
`pending` do momento da consulta, não worker velho — conferido por status
(`ready` 161/219, `pending` 0/3).

## 4. Hipótese 1 — "a régua é curta" — REFUTADA

A régua é `max(480, 300 + ceil(chars/160)*30)` segundos. O `setup_s` novo
mostra que o setup é grande de verdade:

| `setup_s` (n=161) | valor |
|---|---|
| p50 | **73,5s** |
| p95 | 94,2s |
| máx | **116,8s** |

Parecia fechar: ~85s que a calibração de 24/08 não via. Então **medi em vez de
subir o conserto** — somei os dois relógios (`setup_s + elapsed_s`) contra o
teto de cada geração, n=161 desde 05/09:

| uso do teto | resultado |
|---|---|
| pior caso | **62,9%** |
| p95 | 52,6% |
| acima de 80% | **0** |

**A régua tem folga e não é a causa.** Se eu tivesse "consertado" a régua com a
hipótese na mão, teria mexido em produção pelo motivo errado.

## 5. Hipótese 2 — "o regen do QA queima o teto" — REFUTADA

O `#226` mostra que o QA regenera chunk, e a régua orça ~30s por pedaço numa
passada só. Parecia o suspeito. Medido, de 0 a 38 regens:

| regens | n | pior uso do teto |
|---|---|---|
| 0 | 26 | 46,3% |
| 8 | 12 | 46,3% |
| 24 | 3 | 56,8% |
| **38** | 1 | **61,6%** |

**Não há tendência.** Nem o job com 38 regens chega perto do teto. Refutada.

## 6. Então o que sobrou: anomalia de verdade, não régua e não regen

`a07e9278` (04/09, 1.304 chars) estourou o teto de 570s **nas DUAS tentativas**
(o reenvio automático do PR #89 disparou e falhou de novo) enquanto a frota
inteira roda em ≤63% do teto. Isso é **~2× o pior caso normal, duas vezes
seguidas** — worker degradado, não régua curta nem QA teimoso.

## 7. Achado novo: `elapsed_seconds` significa DUAS coisas

A armadilha que sustentava a hipótese 1, e que ia enganar a próxima ronda:

- **sucesso** → `elapsed_s` do worker, que **exclui** o setup (`run()` só
  carimba `self.t0` depois de baixar LoRA + referência + modelo);
- **falha** → `executionTime` do RunPod, que **inclui** o setup
  (`webhooks/runpod/route.ts:258`).

Comparar os 578s de uma falha com os 357s de um sucesso é somar peras com maçãs
— e é exatamente o que faz a régua parecer curta. Está escrito no código agora.

## 8. O que subiu pra produção

**PR #216**, merge `d912c19`, **comment-only** (26 inserções, **0 linha de
código**, conferido no diff). Corrige o docstring da régua: a margem real é
**1,6×**, não os "≥2,5×" que estavam lá desde 24/08, e registra a armadilha do
`elapsed_seconds`. Não mexe no cálculo **de propósito** — a medição diz que a
régua está boa; o risco é alguém **apertar** o piso confiando no número velho e
passar a matar geração saudável.

## 9. Lição de método (paguei pra ver nesta ronda)

Peguei 3 gerações **vivas** e duas estavam em `chunk 0, attempt 2` depois de
2,5–4,5 min. Li como "travadas no chunk 0" e quase escrevi isso como causa.
**As duas terminaram `ready` usando 38% do teto** (`edd015c7` 230s/600s,
`4a1c0e23` 264s/690s). Um instante do heartbeat não é diagnóstico — só o
desfecho decide. Mesma família do "instrumento cego" da ordem de 20/08.

## 10. O que NÃO está feito

1. **O `#15` continua aberto.** Não sei ainda por que um worker específico roda
   2× mais devagar. O que falta é **ocorrência nova**, não análise: a próxima já
   nasce com `chunk` + `attempt` + `setup_s` na própria linha.
2. **Silêncio não é cura:** 0 ocorrência nos 4 dias desde 05/09, mas a taxa
   histórica é ~2/semana. **4 dias limpos não provam conserto** e não vou
   escrever que provam.
3. **`#312` e `#313`** seguem travados na decisão comercial do Johnny.
4. **Não escrevi pra aluno neste card**: os 19 estão com o crédito de volta e o
   reenvio é automático — não há promessa pendente nem aluno esperando resposta.

## 11. Higiene de fim de ronda

- Código: 1 PR (#216), mergeado, conferido em `origin/main` (o texto novo existe
  no arquivo em `origin/main`, não só o "PUSH OK").
- Este log vai **direto na `main`**, com `git branch --show-current` conferido
  **imediatamente antes do commit** (lição da ronda das 20h: outro processo
  trocou o branch por baixo).
- Nada de crédito, GPU, whisper, migration, assinatura cancelada ou e-mail.
- Nada da planilha tocado.
