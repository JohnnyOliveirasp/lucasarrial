# Saúde do QA de áudio — ronda de 04/09/2026

Medição às **15:09–15:20Z**. Sem admin/sócio em nenhum número (johnny.oliveirasp@gmail.com, Lucas).
Canal: relatório vai para o **grupo** (`notify-grupo.sh`), ordem de 31/08.

**Não fiz nada fora do sensor:** não respondi aluno, não mexi em crédito, não fechei nem reabri
incidente, não toquei no endpoint do RunPod.

⚠️ **Lacuna no registro:** não existe `_frank/prova/2026-09-03_qa_coverage.md`. A ronda de ontem
não deixou prova commitada. Não sei dizer se ela não rodou ou se rodou e não gravou — registro o
buraco em vez de fingir série contínua.

---

## 1. Resumo

**Dia limpo, e pela primeira vez o zero é conclusivo — mas só o zero da régua que está LIGADA.**

| | |
|---|---|
| Falhas hoje | **0** em 25 gerações |
| Falhas na régua atual (03/09 12:23Z → agora) | **0** em 71 |
| `qa_coverage` | **0** |
| Último dia com `qa_coverage` | **27/08** (8 dias atrás) |
| Presas em `processing`/`queued` | 0 |
| `failed` com `error_message` vazio | 0 |
| Aluno travado | **nenhum** |
| Estorno pendente | nenhum (não houve falha) |

Build verde e no ar. Nenhuma ação minha necessária hoje.

---

## 2. Qual régua está no ar — e o erro que quase cometi

Último run **verde** do `runpod-worker.yml`: sha **`3bc1535`**, término **03/09 12:23:08Z**.
Nenhum commit em `runpod-worker/` depois dele. Nada pendente de deploy.

**Achado do dia sobre o método (vale mais que o número):** o workflow constrói a **árvore** do
headSha, não o diff. Então um run verde cujo *commit* não toca `runpod-worker/` **ainda assim pode
publicar código novo do worker**, se esse código entrou num commit anterior ainda não construído.

Foi exatamente o caso de ontem 03/09 02:35Z: o sha `65fc20d` é de *frontend/financeiro*, mas o
build carregou `tts_qa/loop.py` (+102 linhas) do `7c2dee5`. Eu tinha descartado esse build como
"rebuild sem troca de régua" — estava errado, conferi a ancestralidade e voltei atrás.

**Consequência: ontem teve DUAS trocas de régua (02:35Z e 12:23Z), não uma.** Portanto "ontem
inteiro" é mistura de 3 réguas e serve como **contexto, nunca como baseline** (lição de 29/08).
Como o corte caiu ontem, não existe janela "hoje antes do corte": hoje inteiro já é régua atual.

| janela | n | falhas | qa_coverage |
|---|---|---|---|
| régua −2 (02/09 17:08Z → 03/09 02:35Z) | 54 | 0 | 0 |
| régua −1 (03/09 02:35Z → 12:23Z) | 12 | 0 | 0 | 
| ontem inteiro (mistura de 3 réguas — contexto) | 71 | 0 | 0 |
| hoje inteiro (já é régua atual) | 25 | 0 | 0 |
| **régua atual acumulada (03/09 12:23Z → agora)** | **71** | **0** | **0** |

A régua −1 tem n=12: **pequeno demais pra concluir qualquer coisa sozinha.**

---

## 3. O zero é conclusivo? Depende de qual zero

O denominador que vale não é o n global — é o **n da faixa que quebrava** (≥1000ch).

| era | n total | `qa_coverage` | n ≥1000ch | `qa_coverage` na faixa |
|---|---|---|---|---|
| velha (19→27/08) | 941 | 26 (2,8%) | 201 | **14 (7,0%)** |
| nova (28/08→agora) | 583 | 0 | **101** | **0** |
| só a régua atual (03/09 12:23Z→agora) | 71 | 0 | **9** | 0 |

Poder estatístico, tomando 7,0% como a taxa antiga da faixa:

- **Régua atual sozinha (n=9):** P(ver 0 mesmo se nada tivesse mudado) = **52%**.
  → **NÃO dá pra concluir nada sobre o build de ontem.** O teto de 95% ainda é 28%.
- **Era nova acumulada (n=101):** P(ver 0 mesmo se nada tivesse mudado) = **0,1%**.
  → **Conclusivo.** Teto de 95%: 2,9%. A taxa caiu de verdade em relação à era velha.

**A distinção importa e é a razão desta rotina existir:** posso afirmar que *a plataforma está
limpa há 8 dias e isso não é sorte*. **Não posso** creditar isso ao build de ontem — ele tem n=9 na
faixa que quebra. Quem quiser dizer "a correção de ontem funcionou" está medindo a régua errada.

Tempo na régua atual: n=65, p50=102s, p90=238s, máx=373s. **Zero acima de 400s** — nenhum sinal do
hang do incidente `d3d8d1b2` (segue fechado, não reabri).

---

## 4. O que o meu "0%" NÃO enxerga — e este é o número do dia

O `3bc1535` de ontem conserta um caso em que **um portão sumia**: no resgate por subdivisão, o
último sub-pedaço ia pro QA com `eh_ultimo=False`, então o fim REAL do arquivo era julgado pela
régua **interna**, que está em **sombra** (`pontua=False`). Ou seja: o único ponto do áudio com
gate duro ficava **sem gate nenhum**.

Isso é a coisa mais importante a entender sobre a métrica que eu reporto todo dia:
**a taxa de falha pode cair por um motivo RUIM.** Portão ausente e portão passando produzem o mesmo
zero. Por isso fui olhar a telemetria de sombra em vez de parar no 0%.

Estado atual (`TTS_TAIL_QA_INTERNO_MODO` = `sombra`, padrão): a fronteira **interna** entre chunks
**não reprova nada**. Só o fim do arquivo reprova. Na régua atual:

| | régua atual (65 ger.) | desde 03/09 04:01Z (74 ger.) |
|---|---|---|
| pedaços entregues com veredito interno | 332 | 433 |
| destes, com a fronteira **decepada** | **24 (7,2%)** | **36 (8,3%)** |
| entregues sem veredito (último chunk) | 65 | 73 |
| confere? `entregue_n + sem_veredito` = `coverage_medido_n` | **397 = 397 OK** | **506 = 506 OK** |
| **gerações com ≥1 pedaço decepado** | **14/65 (21,5%)** | **17/74 (23,0%)** |
| pressão de regen se a chave virar | 48/560 (8,6%) | 66/729 (9,1%) |

**A conta fecha** nas duas janelas — que é exatamente o denominador que o `3bc1535` foi consertar.
Isso sim é evidência direta de que aquele commit fez o que prometeu, e não depende do n=9.

⚠️ **Onde eu paro, porque não tenho como saber:** esses 7,2% são o que a régua **de sombra**
aponta. **Ninguém conferiu esses flags contra o áudio real.** Não afirmo que 21,5% dos alunos
receberam áudio ruim — afirmo que a régua que está desligada apontaria isso, e que a taxa de falso
positivo dela é desconhecida. Decidir a chave sem ouvir uma amostra é decidir no escuro.

Por faixa de texto (régua atual), o decepamento não explode no texto longo como o `qa_coverage`
antigo explodia — mas os n são pequenos e não sustentam conclusão:
0–500ch: 1/17 · 500–1000ch: 17/221 (7,7%) · 1000–1500ch: 5/54 (9,3%) · 1500+: 1/40.

---

## 5. Aluno travado

**Nenhum.** Zero falhas na janela, zero presas, zero `failed` sem mensagem. Nada a estornar
(conferência de estorno é por `ref_type='generation_refund'`, não por `kind` — não precisou hoje).

As gerações com pedaço decepado **não falharam**: o aluno recebeu o áudio. Se o flag da sombra for
real, ele recebeu um áudio com corte interno sem que ninguém tenha sido avisado. Não é caso de
suporte hoje; é insumo pra decisão da chave.

---

## 6. Pro Johnny decidir (não fiz nada disso)

1. **A chave `TTS_TAIL_QA_INTERNO_MODO=reprovando`** tem agora o denominador que faltava: custo
   ≈ **+8,6% de regen**, alcance ≈ **1 em 5 gerações**. O que falta pra decidir não é mais número,
   é **ouvir uma amostra dos 24 pedaços decepados** pra saber quanto daquilo é falso positivo.
2. **Amostra sugerida** (as mais decepadas da régua atual, todas entregues sem falha):
   `c6ec2bda` 4/9 · `500e4da6` 4/12 · `ad43a045` 2/3 · `2974609b` 2/5 · `4ae940a8` 2/5.
   Dois alunos aparecem repetido: `cxmuller@hotmail.com` e `wilson.nfaustino@yahoo.com.br`.

---

## 7. Como reproduzir

- `/tmp/perf/qacov-2026-09-04.cjs` — janelas, sanidade do zero, faixa de texto, tempo, erros crus.
- `/tmp/perf/poder-2026-09-04.cjs` — taxa por era e o poder estatístico do zero.
- `/tmp/perf/interno2-0904.cjs` — telemetria de sombra do #234 na população certa.

Paginação de 1000 em 1000 (`.range`), campo `error` cru impresso antes de acreditar em zero.
Colunas usadas: `id, user_id, status, error_message, created_at, text_raw, elapsed_seconds, qa`.

**Armadilha registrada pra próxima ronda:** somar `tail_interno_entregue_*` sobre a era toda faz a
conta "não fechar" (506 vs 3012) por **artefato** — esses campos só existem desde `7c2dee5`
(03/09 04:01Z), enquanto `coverage_medido_n` existe em todas. Restrinja à população que carrega a
régua de entrega antes de gritar divergência. Eu caí nisso no primeiro passe.
