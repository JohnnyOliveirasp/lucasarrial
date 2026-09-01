# Ronda diária — saúde do qa_coverage — 01/09/2026, 15:08Z

Rodada com `/tmp/perf/qacov-2026-09-01.cjs` (a base `/tmp/perf/qacov.cjs` estava
sem a linha do `require` do `_comum.cjs` — reescrita com os parâmetros de hoje).
Paginado em blocos de 1000 (`.range`), 1587 gerações desde 17/08.

## Passo 1 — qual régua está no ar

`gh run list --workflow=runpod-worker.yml`:

| conclusão | headSha | terminou (updatedAt) |
|---|---|---|
| success | `8648927` (merge PR #125) | **2026-08-29T18:32:56Z** |
| success | `c12906e7` (PR #124) | 2026-08-29T18:18:09Z |

**Nenhum run falhou e nenhum está em andamento.** O último verde é de **29/08**,
ou seja **o corte caiu há 3 dias** — não hoje, não ontem.

Como o worker do RunPod não sobe com push na main, "sem build há 3 dias" poderia
significar correção parada fora do ar. **Não é o caso** — conferido:

```
git log --since="2026-08-29T18:32:56Z" -- runpod-worker/   ->  vazio
```

Nenhum dos 106 commits que entraram na main desde o corte toca `runpod-worker/`.
O último commit do worker é `1e9dedd` (29/08 18:24Z), que é exatamente o que o
build `8648927` levou ao ar. **O worker em produção == o worker na main. Nada
pendente de deploy.**

Consequência metodológica (lição de 28/08 aplicada): como o corte caiu há 3 dias,
**não existe "hoje antes do corte" nem "ontem antes do corte"**. Ontem e hoje
estão inteiros na MESMA régua. A comparação de hoje é dia-contra-dia na mesma
régua — **não** é mudança de régua, e seria erro apresentá-la como tal.

## Passo 2 — as janelas

| janela | total | falhas | qa_coverage | taxa qa_cov |
|---|---|---|---|---|
| baseline 17/08 → corte (réguas ANTIGAS, só contexto) | 1352 | 33 | 27 | **2.00%** |
| **régua atual acumulada** 29/08 18:32Z → agora | **235** | **0** | **0** | **0.0%** |
| ontem 31/08 inteiro (régua atual) | 116 | 0 | 0 | 0.0% |
| hoje 01/09 até 15:08Z (régua atual) | 32 | 0 | 0 | 0.0% |

Sanidade antes de acreditar no zero (lição de 29/08):
- status hoje: `{ready: 32}` / ontem: `{ready: 116}` — **nenhuma presa** em
  `processing`/`queued`, então o zero não é "ainda não deu tempo de falhar";
- **0** gerações `failed` com `error_message` vazio — nenhuma falha invisível.

### O denominador que vale é o da faixa que quebra

Falha de qa_coverage sempre se concentrou em texto longo. Por isso o n global não
qualifica o zero:

| faixa | baseline (pré-corte) | régua atual | P(ver 0 sem mudança) | teto 95% da taxa real |
|---|---|---|---|---|
| global | 27/1352 = 2,00% | 0/235 | **0,9%** | 1,3% |
| <1000ch | 13/1064 = 1,22% | 0/193 | 9,3% | 1,5% |
| ≥1000ch | 14/288 = 4,86% | 0/42 | 12,3% | 6,9% |
| **1500–2500ch** (a que mais quebrava) | 9/111 = 8,11% | **0/16** | **25,8%** | **17,1%** |

Leitura honesta, e é o achado do dia:

- **No global dá pra concluir.** 0/235 com taxa velha de 2% teria 0,9% de chance
  de acontecer por acaso. A queda é real.
- **Na faixa que de fato quebrava, NÃO dá.** Com n=16 em 1500–2500ch, havia
  **25,8% de chance de eu ver zero mesmo que nada tivesse sido corrigido** — 1 em
  4. E o teto de 95% diz que a taxa real dessa faixa ainda pode ser até **17,1%**
  e ainda assim eu observar 0. Anunciar "resolvido para texto longo" hoje seria
  errar **pra mais**, exatamente o erro de 19-20/08.

Conclusão que eu assino: **melhora global conclusiva; faixa 1500–2500ch ainda não
certificada, faltam gerações.** No ritmo atual (~5/dia nessa faixa) leva ~4 dias
pra chegar em n≈35, que já derrubaria o P pra ~5%.

### Tempo (elapsed_seconds)

Mediana **82,0s** (baseline, n=1047) → **71,1s** (régua atual, n=197). Não houve a
piora de tempo que foi o achado real de 28/08 — o tempo melhorou.

3 gerações >400s na régua atual (410s, 480s, 400s), **todas `status=ready`**, ou
seja concluíram. São lentas, não são hang. Incidente `d3d8d1b2` foi fechado como
aceite de risco pelo Johnny e **não estou reabrindo** — fica registrado como
observação.

## Passo 3 — quem falhou / quem está travado

**Ninguém travado agora.** Zero falhas desde 31/08; zero gerações em estado
não-`ready` desde 24/08. A última falha de qa_coverage foi em **27/08** (Ronald
Lenz), 5 dias atrás.

Conferência de estorno por `ref_type='generation_refund'` (nunca por `kind`, que
grava `extra_purchase`): 18 falhas desde 24/08, 18 estornos. Reconciliação:
16 casam com falhas da janela, 1 aponta pra geração de 23/08 (fora da janela) e 1
é o estorno manual `incidente-c15ece48-testes-12-08`.

**Alarme falso que quase virou notícia errada:** duas falhas da Kessuly Lopes
(24/08, 18:47 e 18:53) apareceram como `estornado=NAO`. Investigado antes de
reportar: `credit_transactions` não tem **nenhuma** linha apontando pra essas duas
gerações — nem estorno nem **débito**. Ela **nunca foi cobrada**, então não há
estorno a fazer e ela não está lesada.

**Lição de método (nova, 01/09):** checar só o estorno é insuficiente. "Falhou e
não foi estornada" e "falhou e nunca foi cobrada" são indistinguíveis se você olha
apenas `generation_refund`. **Tem que checar se existiu DÉBITO.** Sem isso eu teria
reportado aluna lesada onde não havia.

## Ritmo por dia

```
17/08 102/0   18/08 127/2   19/08 105/4*  20/08 135/4*  21/08  66/0   22/08  94/0
23/08 100/5   24/08 143/7   25/08 124/1   26/08 111/3   27/08  82/6   28/08 117/1
29/08  67/0   30/08  66/0   31/08 116/0   01/09  32/0
                                          (total/falhas)
```
Quatro dias seguidos sem nenhuma falha (29, 30, 31/08 e 01/09).

## O que NÃO fiz (fora do meu perímetro)

Não respondi aluno, não mexi em crédito, não fechei nem reabri incidente, não
recriei endpoint do RunPod.

---

## Apêndice — re-execução do mesmo card (15:25Z)

O card `ecd43b39` **re-disparou** com o texto idêntico ~10 min depois da ronda
acima já ter terminado (a sessão anterior encerrou às 15:11:57Z e ficou marcada
como incompleta, então o runner reenfileirou). Não refiz a ronda às cegas nem
repostei no grupo: **re-verifiquei tudo de primeira mão** e anexo o resultado.

| checagem | resultado da re-verificação (15:20–15:25Z) |
|---|---|
| último run verde `runpod-worker.yml` | `8648927`, `2026-08-29T18:32:56Z` — idêntico, nenhum run falho ou em andamento |
| commits tocando `runpod-worker/` desde o corte | vazio (produção == main) |
| régua atual acumulada | **0 falhas / 235** — idêntico |
| hoje 01/09 | **0 falhas / 32** — idêntico |
| ontem 31/08 | **0 falhas / 116** — idêntico |
| presas em `processing`/`queued` | nenhuma — ninguém esperando |
| `user_id` com falha desde ontem | `[]` |
| falhas desde 24/08 × estorno | 18 falhas / 18 estornos; as 2 da Kessuly sem `generation_refund` seguem **sem nenhum débito** (0 transações apontando pras gerações) — não há aluna lesada |

Diferença única contra a medição das 15:08Z: o baseline pré-corte saiu **1351**
em vez de 1352 (uma linha a menos na paginação, ruído de fronteira). Não move
nada: 33 falhas / 27 qa_coverage seguem iguais, a taxa continua 2,0%.

**Não repostei no grupo.** O relatório de hoje saiu às 15:11:30Z com `ok:true`
confirmado pelo Telegram. Uma segunda mensagem idêntica seria ruído, e o gatilho
foi re-disparo de card, não fato novo. Regra permanente gravada (id 1064) para
que a próxima re-execução cheque a prova do dia + o envio antes de refazer.

A conclusão da ronda **não muda**: sem aluno travado, sem build quebrado, global
conclusivo (0/235), e a faixa 1500–2500ch continua **sem n suficiente** (n=16)
para certificar a correção.
