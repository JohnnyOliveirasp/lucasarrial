# Ronda diaria de qa_coverage — 06/09/2026

Medido as 15:19Z. Scripts: `/tmp/perf/qacov0906.cjs`, `/tmp/perf/aux0906.cjs`, `/tmp/perf/ref0906.cjs`.

## Resumo

**Dia limpo. Zero falhas hoje, zero falhas ontem, nenhum aluno travado.**
Nenhum build novo desde ontem de manha: a regua `eccc3d59` esta no ar ha ~31h sem
mexer. O acumulado da era estavel cresceu pra **0 em 674 geracoes**.

---

## Passo 1 — qual regua esta no ar

`gh run list --workflow=runpod-worker.yml --limit 5`:

| run | sha | conclusion | termino (updatedAt) |
|---|---|---|---|
| chunk_max sobrescrivivel por job | `eccc3d59` | **success** | **2026-09-05T08:28:05Z** <- CORTE |
| registrar QUAIS palavras sumiram | `f8586783` | cancelled | 2026-09-05T08:04:11Z |
| instrumenta setup da inferencia (#15) | `2bd3c3f8` | success | 2026-09-05T00:41:43Z |
| resgate do ULTIMO chunk | `3bc1535d` | success | 2026-09-03T12:23:08Z |

**A regua no ar continua `eccc3d59`, desde 05/09 08:28:05Z.** Nao houve nenhum run
novo em 24h — nada verde, nada vermelho, nada em andamento. Build nao falhou;
simplesmente nao houve push que tocasse `runpod-worker/`.

Reconferido (licao de 05/09): `f8586783` esta *cancelled* mas **esta no ar**, porque
`eccc3d59` e descendente dele — `git merge-base --is-ancestor` confirma. Ler
"cancelled" como "nao foi pro ar" seria errar pra menos.

### O molde de hoje e DIFERENTE do de ontem (licao de 28/08)

O corte caiu **ONTEM** 08:28Z, nao hoje. Entao **nao existe janela "hoje antes do
corte"** — ela sairia vazia. Hoje inteiro ja e regua atual, e a janela que vale e a
**acumulada (corte -> agora)**. Copiar o molde de ontem aqui teria produzido um
recorte errado.

## Passo 2 — medicao

Sanidade antes de acreditar em qualquer zero (licao de 29/08):
- (a) presas em `processing`/`queued` hoje: **1** — `e0489b21`, criada 15:18:07Z,
  ou seja **1 minuto antes da medicao**. E geracao em voo normal, nao entulho preso.
  Nao contamina o zero.
- (b) `failed` com `error_message` vazio hoje: **0** — nao ha falha invisivel
- (c) status crus hoje: `{"ready": 24, "pending": 1}`

| janela | total | falhas | qa_coverage | leitura |
|---|---|---|---|---|
| Era estavel 28/08 -> corte (contexto, mistura de reguas) | 628 | 3 | **0** | contexto |
| Ontem 05/09 antes do corte (regua velha) | 10 | 0 | 0 | n=10, nao conclui |
| Ontem 05/09 depois do corte (regua ATUAL) | 21 | 0 | 0 | n=21, nao conclui |
| Hoje 06/09 inteiro (regua ATUAL) | 25 | 0 | 0 | n=25, **nao conclui sozinho** |
| **ACUMULADO regua ATUAL (corte -> agora)** | **46** | **0** | **0** | faixa que quebra n=3 |

### O denominador (a parte que mais custa errar)

Hoje tem n=25 global — parece decente, mas **na faixa que quebrava (1500-2500ch) o
n e 2**. E no acumulado da regua atual inteira, n=3. Isso **nao conclui nada**
sozinho: e exatamente o erro de 29/08, anunciar melhora em cima de faixa com n=3.

O que sustenta a conclusao continua sendo o **acumulado da era estavel**, que hoje
ficou maior que ontem:

| recorte acumulado 28/08 -> agora | n | qa_coverage | ontem era |
|---|---|---|---|
| global | **674** | **0** | 638 |
| faixa >=1000ch | **120** | **0** | 114 |
| faixa 1500-2500ch (a que mais quebrava) | **49** | **0** | 47 |

Contra **5 falhas em 68 casos** dessa mesma faixa no periodo anterior. Sao **10 dias
corridos** sem uma unica reprovacao — a ultima foi em 27/08.

**Conclusao honesta: o dia isolado nao prova nada; o acumulado prova.** As duas
coisas precisam ser ditas juntas.

### elapsed_seconds

Nenhuma falha hoje nem ontem, entao nao ha o que classificar entre reprovacao do QA
(40-230s) e hang (>400s).

Sobre o buraco de `elapsed` NULO que a ronda de ontem levantou como achado novo:
**ele continua, no mesmo tamanho de sempre — nao piorou.** Serie diaria (so `ready`):

| dia | 28/08 | 29 | 30 | 31 | 01/09 | 02 | 03 | 04 | 05 | 06 |
|---|---|---|---|---|---|---|---|---|---|---|
| % NULO | 22% | 21% | 15% | 15% | 14% | 26% | 15% | 18% | 16% | **32%** |

Hoje marcou 32%, o maior da serie — **mas com n=25 isso nao e escalada.** A media da
era e 126/671 = **18.8%**, a serie oscila entre 14% e 26%, e 8/25 fica a ~1.7 desvios
da media: dentro do ruido. **Nao vou anunciar piora** — seria errar pra mais, que
custa igual a errar pra menos. O que vale dizer e que o buraco de ~19% **persiste e
nao foi corrigido**, e segue cegando o discriminador desta ronda.

## Passo 3 — quem falhou

**Ninguem, hoje nem ontem.** Zero falhas em toda a janela do relatorio.

Por completude, as 3 falhas da era estavel inteira (todas anteriores a esta ronda,
todas ja reportadas antes) sao **`executionTimeout` = hang, nao reprovacao de
qa_coverage**:

| geracao | dia | aluno | elapsed | estorno (`ref_type='generation_refund'`) | destravado? |
|---|---|---|---|---|---|
| `086970cd` | 28/08 | Victor Araujo | 492s | confirmado (400) | sem geracao posterior; acesso ate 27/09 |
| `a07e9278` | 04/09 | Debora Oliveira | 579s | confirmado (1307) | **sim**, 3 sucessos depois |
| `86254b30` | 04/09 | Renan Juste | 485s | confirmado (749) | **sim**, sucesso depois |

Estornos conferidos por `ref_type`, nunca por `kind` — os tres gravaram
`kind='extra_purchase'`, entao filtrar por `kind` faria parecer que ninguem foi
estornado.

**Nenhum aluno travado agora.**

## Nota sobre o hang (d3d8d1b2) — sem novidade hoje

**Nao houve nenhum hang novo desde 04/09: sao 2 dias limpos.** O par de 04/09 ja foi
reportado na ronda de ontem e continua sendo decisao pendente do Johnny (reabrir ou
nao). **Nao estou reabrindo nada e nao estou re-anunciando aquilo como novo** — o erro
de origem desta rotina foi justamente apresentar falha velha como estado atual.

---

## Veredito

- **Deploy:** regua `eccc3d59` no ar ha ~31h. Nenhum build novo em 24h, nenhum falhou.
- **qa_coverage hoje:** 0 falhas em 25 geracoes. **n da faixa critica = 2, nao conclui sozinho.**
- **qa_coverage acumulado:** 0 em 674, 0 em 49 casos da faixa 1500-2500ch, 10 dias corridos. **Isso conclui.**
- **Direcao:** estavel embaixo. Nao subiu, nao desceu — ja estava em zero.
- **Aluno travado:** nenhum.
- **Hang:** 2 dias limpos. Decisao de reabrir segue com o Johnny (inalterada desde ontem).
- **Pendente:** buraco de `elapsed_seconds` (~19%) segue sem correcao.
