# Ronda diária — saúde do qa_coverage — 02/09/2026, 15:09Z

Rodada com `_frank/ferramentas/qa_coverage.cjs --desde 2026-08-19 --corte auto`
(corte descoberto sozinho pelo GitHub, não chutado) + `/tmp/perf/qacov-2026-09-02.cjs`
para sanidade e faixa de texto. Paginado em blocos de 1000 (`.range`): 1418
gerações desde 19/08, **1395** depois de tirar admin/sócio.

## Passo 1 — qual régua está no ar

`gh run list --workflow=runpod-worker.yml`:

| conclusão | headSha | terminou (updatedAt) |
|---|---|---|
| **success** | **`9f1e452`** | **2026-09-02T01:51:20Z** |
| cancelled | `e4cc692` | 2026-09-02T01:35:48Z |
| success | `8648927` | 2026-08-29T18:32:56Z |

**Nenhum run falhou e nenhum está em andamento.** O `e4cc692` foi *cancelled*,
não *failure* — foi substituído pelo run seguinte 13 min depois, comportamento
normal de push em cima de build rodando. Não é notícia.

Corte que vale (fim do job `deploy-runpod`, **não** a hora do push — erro de
20/08): **2026-09-02T01:51:19Z**, sha `9f1e452`.

Build levou 16 min (01:35 → 01:51), abaixo da faixa usual de 28-52 min. Verde e
completo, então não travou; só registro a diferença.

**Nada pendente de deploy** — conferido:

```
git log --since="2026-09-02T01:51:19Z" -- runpod-worker/   ->  vazio
```

Último commit do worker é o próprio `9f1e452`. **Worker em produção == worker na
main.**

O corte caiu **hoje de madrugada**, então o molde de hoje é: régua anterior
(baseline) | hoje antes do corte | hoje depois do corte.

## Passo 2 — as janelas

| janela | n | falhas | qa_coverage | taxa qa_cov |
|---|---|---|---|---|
| baseline histórico 19/08 → 29/08 (réguas antigas) | 1095 | 30 | 26 | **2.37%** |
| **régua ANTERIOR** 29/08 18:32Z → 02/09 01:51Z | **281** | **0** | **0** | **0.0%** |
| ontem 01/09 inteiro (subconjunto da régua anterior) | 75 | 0 | 0 | 0.0% |
| hoje antes do corte (00:00Z → 01:51Z) | 6 | 0 | 0 | — n pequeno demais |
| **régua NOVA** 01:51Z → agora | **19** | **0** | **0** | — **n pequeno demais** |

Sanidade antes de acreditar em qualquer zero (lição de 29/08):

- régua anterior: `status={ready: 281}` — **0 presas** em `processing`/`queued`;
- régua nova: `status={ready: 19}` — **0 presas**;
- **0** gerações `failed` com `error_message` vazio nas duas — sem falha invisível.

O zero está conferido. Não é "ainda não deu tempo de falhar".

### O denominador que vale é o da faixa que quebra

| faixa | baseline 19-29/08 | régua ANTERIOR | régua NOVA | P(ver 0 na NOVA sem mudança) | teto 95% da NOVA |
|---|---|---|---|---|---|
| global | 26/1095 = 2.37% | 0/281 | 0/19 | **63.3%** | 14.6% |
| <1000ch | 12/869 = 1.38% | 0/231 | 0/18 | 77.9% | 15.3% |
| ≥1000ch | 14/226 = 6.19% | 0/50 | **0/1** | 93.8% | 95.0% |
| 1500–2500ch (a que mais quebrava) | 9/92 = 9.78% | 0/19 | **0/0** | 100% | — |

**Sobre a régua NOVA não dá pra concluir nada, nem pra bem nem pra mal.** Com
n=19 global, havia 63% de chance de eu ver zero mesmo que nada tivesse mudado. Na
faixa que de fato quebra (≥1000ch) o n é **1**, e em 1500–2500ch é **zero** — não
existe uma única geração da faixa crítica sob a régua nova. Qualquer frase sobre
"a correção de hoje funcionou" seria inventada.

**O que dá pra concluir é sobre a régua ANTERIOR**, e essa é a notícia boa de
verdade: 0/281 contra taxa histórica de 2.37% tem **0,12%** de chance de acontecer
por acaso. O teto 95% da taxa real ficou em **1,06%**. A queda que vinha sendo
acompanhada desde 29/08 se confirmou com n robusto. Na faixa ≥1000ch, 0/50 (P=4,1%)
também fecha; em 1500–2500ch, 0/19 (P=14,2%) ainda **não** fecha.

### Enquadramento honesto do build de hoje

Vale dizer explicitamente, porque é fácil ler errado: o deploy de hoje **não
corrigiu um estado quebrado**. O sistema já estava em 0 falhas há 281 gerações
(5 dias corridos sem uma única falha: 29/08, 30/08, 31/08, 01/09, 02/09). O
commit `9f1e452` mexe em reconhecimento de quem já está no Gravador e para de
gravar artefato do medidor de treino como régua.

Ou seja: **o risco a vigiar hoje é regressão, não melhora.** E com n=19 eu também
não detectaria uma regressão ainda. É por isso que a ronda de amanhã importa mais
que a de hoje.

### Tempo (hang é outro bicho)

Régua nova, `elapsed_seconds` (n=10 com tempo registrado): min 13,98s / mediana
67,45s / máx **147,13s**. **Nenhuma acima de 400s.** Faixa normal, sem sinal de
hang.

O incidente **d3d8d1b2** (hang / `executionTimeout exceeded`, fechado como aceite
de risco pelo Johnny) **continua sem reincidência** — o último caso foi
28/08 (`viktoraraujo@icloud.com`, 491s). **Não reabri.**

## Passo 3 — quem falhou

**Ninguém.** Zero falhas desde 01/09 (e na verdade desde 28/08). Nenhum aluno
travado, nenhum estorno a conferir, nada a escalar.

## Ritmo de hoje (pra dimensionar o n)

00h:5 · 01h:1 · 02h:2 · 05h:1 · 07h:2 · 10h:2 · 11h:1 · 12h:1 · 13h:3 · 14h:6 · 15h:1

Cerca de 1-3 gerações/hora. Para a régua nova chegar a n≈100 (aí sim conclusivo
no global) faltam umas 30-40 horas de uso — **a janela só fecha na ronda de
depois de amanhã**, não na de amanhã.

## Conclusão

1. Build **verde**, régua nova no ar desde 01:51Z, nada pendente de deploy.
2. **Nenhum aluno travado.** 5 dias corridos sem falha.
3. Régua anterior: queda **confirmada** com n=281 (P=0,12%).
4. Régua nova: **n=19, não dá pra concluir.** Faixa crítica com n=1 e n=0.
5. Vigiar **regressão** nas próximas rondas, não melhora.
