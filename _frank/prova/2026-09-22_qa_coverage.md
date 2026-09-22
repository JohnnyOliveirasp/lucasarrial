# Ronda diária — saúde do qa_coverage — 22/09/2026 (leitura 15:17Z, terça)

Scripts: `/tmp/perf/qacov_0922.cjs`, `/tmp/perf/_aluno_0922.cjs`,
`/tmp/perf/_hang_0922.cjs`, `/tmp/perf/_retorno_0922.cjs`. Base: `/tmp/perf/qacov.cjs`.

## 0. O que conclui hoje

> **Houve corte de régua REAL ontem às 19:25Z, e é o primeiro em semanas que
> mexe no portão de verdade.** `94c2a825` mudou `chunk_coverage` de
> `matched/len(expected)` para `(casadas + grafias)/len(expected)`: divergência
> de grafia passa a contar como **presente**. O piso segue **0.85** (inalterado,
> conferido no blob). A cobertura medida só pode **subir** ⇒ espera-se **menos**
> reprovação. Ver §1.

> **E o número que isso produziu NÃO PODE SER LIDO AINDA.** `qa_coverage = 0/54`
> na régua nova. Sob a régua velha (0,243%) o esperado em 54 gerações é **0,13
> falhas**, e **P(ver zero mesmo sem melhora nenhuma) = 87,7%**. Pra "zero"
> significar alguma coisa seriam **n≥661 (~9 dias)**. Anunciar melhora hoje
> seria fabricar desfecho — exatamente o erro de 20/09. Ver §2.

**O hang voltou, e é decisão do Johnny.** A única falha de hoje **não é de
cobertura**: `executionTimeout`, 644s. É a 4ª desde 25/08 (28/08, 04/09 ×2,
22/09) e a **primeira em 18 dias** — e a mais longa das quatro. O incidente
`d3d8d1b2` foi fechado como aceite de risco com a condição "reabrir SÓ se
voltar". **Voltou.** Não reabro sozinho. Ver §3.

**Nenhum aluno travado agora.** 0 não-terminais com idade real. A geração que
apareceu como `pending` tinha **72 segundos de vida** e fechou `ready` em 58s —
não era travamento, era uma geração em curso. (Checagem de presa precisa de
**idade**, não só de status.)

**A pior notícia de ontem se desfez: Tania Regina VOLTOU.** A ronda de 21/09
registrou que ela perdeu o acesso às 12:00Z e nunca voltou depois das 3 falhas
de 16/09. Hoje: `access_until = 2026-10-14` (**renovou**) e gerou com sucesso em
21/09 18:46Z. Ver §3.

---

## 1. Qual régua está no ar (PASSO 1)

`gh run list --workflow=runpod-worker.yml --limit 5`: **cinco verdes**, nenhum
`in_progress`, nenhum falhado.

| run | sha | terminou (updatedAt) |
|---|---|---|
| **último** | **`94c2a825`** | **2026-09-21T19:27:52Z** |
| anterior | `561f6867` | 2026-09-20T22:26:15Z |
| — | `d49837ff` | 2026-09-20T00:20:17Z |

**É deploy de verdade:** job `deploy-runpod` verde **incluindo o passo `Point
template to new image + recycle workers`** ⇒ frota trocada.

### É corte de régua — e isso se conferiu no diff, não se herdou

`git diff --numstat 94c2a825^1 94c2a825` (contra o **pai**, não `--stat` de merge):
`tts_qa/metrics.py` (196+/39−), `tts_qa/canon.py` (203+, novo), `tts_qa/loop.py`
(87+/7−), `jobs/inference.py` (13+/4−).

```diff
-    sm = difflib.SequenceMatcher(None, expected, got)
-    matched = sum(b.size for b in sm.get_matching_blocks())
-    return round(matched / len(expected), 3)
+    d = _diagnostico(expected, got)
+    return round((d.casadas + len(d.grafias)) / len(expected), 3)
```

- **`chunk_coverage` mudou** ⇒ o portão mudou. Grafia divergente ("Cestaro" onde
  a aluna escreveu "Sestaro") conta como **presente**.
- **O piso NÃO mudou.** Conferido **no blob**, não na memória:
  `qa.coverage_min` = `{"0.85": 1487}` — valor **único** em todas as gerações com
  telemetria, e `{"0.85": 39}` na janela nova.
- `divergencias_de_grafia` / `registrar_grafias` são **telemetria pura** (nenhum
  portão lê). Quem move a régua é a linha acima, só ela.
- Direção do efeito: a cobertura nova é **≥** a antiga sempre ⇒ **menos**
  reprovação. É melhora esperada, **não medida** (§2).

### Deploy provado no DADO, e o timestamp estava errado

O campo `grafia_*` só existe no build novo. **40 gerações** já o carregam, a
primeira às **2026-09-21T19:25:42Z** — **2 minutos ANTES** do `updatedAt`
(19:27:52Z) do workflow. O corte empírico é **19:25:42Z**, e é ele que vale: o
dado prova o deploy melhor que o relógio do GitHub.

### O outro lado da régua (lição 2 de 21/09)

O texto do erro é escrito pelo **app**, e o passo 1 só vigia o worker. Hoje
houve **6 deploys de frontend** (12:30Z → 15:04Z) e 5 ontem. Conferido: as duas
strings do detector seguem **intactas** —
`api/v1/webhooks/runpod/route.ts:230` e `api/v1/generations/[id]/route.ts:166`.
Detector continua válido pelos dois caminhos.

---

## 2. Medição (PASSO 2)

### Integridade da base

- **(e)** `qa_coverage` desde 25/08: **13** (ontem 13, `delta=0`). Falhas totais:
  **32** (ontem 31, `delta=+1` = a de hoje). **Nenhuma falha de período fechado
  desapareceu.**
- **(e2)** **Nenhum dia fechado encolheu hoje** — 09/09 a 21/09 batem linha a
  linha com os valores vivos de ontem. É o **primeiro dia em cinco** sem linha
  sumindo. Não promove ninguém a "estável" (quinta lição de 17/09).
- **(a)** 0 travados. **(b)** 0 `failed` com erro vazio.

### Janelas

| janela | total | falhas | taxa | qa_coverage |
|---|---|---|---|---|
| 20/09 fechado (régua velha) | 38 | 1 | 2,63% | 1 |
| **21/09 inteiro** (misto) | 77 | 0 | 0,00% | 0 |
| ↳ 21/09 **antes** do corte (velha) | 49 | 0 | 0,00% | 0 |
| ↳ 21/09 **depois** do corte (nova) | 28 | 0 | 0,00% | 0 |
| **HOJE 22/09** até 15:17Z (nova) | 24 | 1 | 4,17% | **0** |
| **ACUMULADO RÉGUA NOVA** (19:25Z→agora) | **54** | 1 | 1,85% | **0** |
| RÉGUA VELHA comparável (f8586783 05/09→corte) | 1233 | 18 | 1,46% | 3 (0,243%) |

**A taxa de hoje (4,17%) não é de QA.** A única falha é `executionTimeout`
(§3). `qa_coverage` hoje = **0/24**. E n=24 passa raspando o mínimo de 20: uma
falha vale **4 pontos** nesse denominador. **Não concluo nada de hoje.**

### O poder — a conta ANTES do verbo

A série 10/09 → 11/09 → 13/09 → 20/09 diz: calcule o poder **antes** do
critério de parada, e no tamanho da **célula rara**, não no n total.

- régua velha: **3/1233 = 0,243%** de `qa_coverage`
- régua nova: **n=54**
- esperado se **nada** mudou: **0,13 falhas**
- **P(ver ZERO mesmo sem melhora nenhuma) = 87,7%**
- pra P(zero|sem efeito) < 20% seriam **n ≥ 661** ⇒ ~**9 dias** no ritmo de ~75 ger/dia

> **Veredito: INDECIDIDO, e indeciso é desfecho honesto.** A mudança é
> mecanicamente favorável (a cobertura só sobe), mas o dado de hoje é
> *indistinguível* do dado que eu veria se ela não tivesse efeito nenhum. Fica
> **pré-registrado**: reavaliar em **n≥661** (≈01/10), sem alargar nem encurtar
> a janela depois de ver o número.

---

## 3. Quem falhou (PASSO 3)

### A falha de hoje — e ela NÃO é de cobertura

- **Rodrigo Andrade Sirahata** (`rsirahata@gmail.com`)
- 22/09T12:54:18Z, 981ch, **`elapsed = 644,3s`**,
  `executionTimeout exceeded [fase: inference.chunk.generate chunk=6 attempt=1]`
- Faixa normal é 40–230s (mediana da régua nova: 120s) ⇒ **hang**, não reprovação.
- **Estorno confirmado**: 981 créditos às 13:15:55Z, `ref_type='generation_refund'`.
  (O lançamento tem `kind='extra_purchase'` — filtrar por `kind` faria parecer
  que ninguém foi estornado.)
- Assinante pagante (grant de 100.000 em 16/09), usuário pesado (áudio, vídeo,
  imagem, roteiro). Já tinha gerado **885ch em 101s** e **1002ch em 92s** — mesmo
  porte de texto, 6× o tempo.
- **Não voltou** (2h24 depois da falha).
- **`access_until = 2026-09-23T12:00Z` — vence em ~21 horas.**

### O hang voltou (incidente `d3d8d1b2`)

Todas as `executionTimeout` desde 25/08:

| quando | texto | elapsed |
|---|---|---|
| 28/08 18:16Z | 206ch | 491,6s |
| 04/09 20:36Z | 1307ch | 579,0s |
| 04/09 20:47Z | 749ch | 484,8s |
| **22/09 12:54Z** | **981ch** | **644,3s** |

Primeira em **18 dias**, e a **mais longa** das quatro. `d3d8d1b2` foi fechado
como **aceite de risco pelo Johnny**, com a condição explícita "reabrir **só**
se voltar". **Voltou.** Não reabro incidente sozinho — **decisão do Johnny**.

### Estornado ≠ resolvido — o indicador é o RETORNO

| aluno | última falha | voltou? | access_until |
|---|---|---|---|
| `rsirahata@` | **hoje 12:54Z** (hang) | **NÃO** (2h24) | **23/09 12:00Z — ~21h** |
| `larissaoviana@` | 20/09 22:55Z (qa_cov) | **NÃO** (2 gerações na vida) | 25/09 12:00Z — 2,9 dias |
| `taniaregina.espadaro@` | 16/09 19:51Z (×3) | **SIM** ✅ | **14/10 — renovou** |

**Tania Regina desmente a leitura de ontem.** A ronda de 21/09 fechou com ela
como "a pior notícia": acesso morto às 12:00Z, nunca voltou. Hoje ela tem
geração **`ready` em 21/09 18:46Z** e `access_until` em **14/10**. Ela voltou e
**renovou**. Registro porque a ronda de ontem errou na direção pessimista, e um
erro pessimista também é erro.

**Larissa segue sem voltar**, 2,9 dias de acesso. O padrão que a ronda de 21/09
nomeou continua de pé: **crédito devolvido dentro de um acesso que expira é um
vale que vence** — e o Rodrigo é o caso mais apertado (21h).

---

## 4. O que NÃO fiz (limites da ronda)

Não respondi aluno, não mexi em crédito, não fechei nem reabri incidente, não
recriei endpoint do RunPod.

## 5. Pré-registro para as próximas rondas

- **Régua nova**: corte **21/09 19:25:42Z** (empírico, campo `grafia_*`).
  Reavaliar `qa_coverage` em **n≥661** (≈01/10). Não alargar a janela depois de
  ver o número.
- **Linha de base para amanhã** (valores VIVOS lidos hoje):
  `ONTEM_QACOV = 13`, `ONTEM_FALHAS = 32`, rótulo `22/09`.
- **Dias fechados** (vivos hoje): 09/09=116, 10/09=89, 11/09=100, 12/09=72,
  13/09=50, 14/09=96, 15/09=94, 16/09=75, 17/09=76, 18/09=83, 19/09=57,
  20/09=38, **21/09=77** (primeira leitura fechada).
- **Vigiar**: `elapsed` alto (o hang), e se o Rodrigo volta antes de 23/09 12:00Z.
- **Corrigir no script**: checagem de presa tem que usar **idade > 300s**, não só
  status — hoje ela deu um falso positivo de 72 segundos.
