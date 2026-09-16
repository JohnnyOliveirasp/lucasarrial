# Ronda diária qa_coverage — 2026-09-16 (quarta)

Medição às 15:12Z. Script: `/tmp/perf/qacov-2026-09-16.cjs` (saída completa em
`/tmp/perf/out-0916.txt`, 384 linhas, exit=0).

**Resumo:** dia limpo de falhas (0/18), mas **o dia não conclui sozinho** — n=18
está abaixo do piso de 20. Nenhum aluno travado. Dois achados que não são sobre
qa_coverage e que eu não fui procurar: **(1)** o denominador de dias FECHADOS
encolheu de novo (−7 linhas desde ontem) e a checagem fixa não pegou, porque ela
só olha falha; **(2)** o volume de hoje está na metade da quarta anterior no
mesmo horário. Nenhum dos dois é incidente. Ambos são coisa pra vigiar.

---

## PASSO 1 — Qual régua está no ar

`gh run list --workflow=runpod-worker.yml --limit 5`:

| SHA | Fim (updatedAt) | Conclusão |
|---|---|---|
| `b2d9f47` | 2026-09-15T03:49:41Z | success |
| `7b673a7` | 2026-09-15T02:44:36Z | success |
| `2adb080` | 2026-09-08T15:22:32Z | success |

Nenhum run falhou e nenhum está `in_progress`. **Não há build de hoje.**

### Verde não é corte — e eu refiz a checagem em vez de confiar na nota de ontem

A ronda de 15/09 já tinha concluído que os dois verdes de ontem não são corte de
régua. Eu **não** herdei essa conclusão: a lição de 15/09 é exatamente que nota
da véspera não é árbitro. Refiz o teste na mão hoje:

```
git log -1 -- runpod-worker/jobs/inference.py     -> 243aa73 (08/09)
git log -1 -- runpod-worker/jobs/tts_settings.py  -> 243aa73 (08/09)
git log -1 -- runpod-worker/tts_qa/loop.py        -> f858678 (05/09)
git diff 2adb080 b2d9f47a -- .../train_reference.py | grep -i cover  -> VAZIO
```

Os três arquivos que decidem `qa_coverage` na **inferência** estão intocados
desde 08/09. Os dois verdes de ontem tocam `train.py`, `train_reference.py`,
`voice_pipeline/reference.py` (treino de voz) e `sample_gen.py` (amostra
pós-treino). `train_reference.py` aparece nos dois conjuntos, então eu conferi o
diff dele especificamente por `cover` — saiu vazio. Caminho diferente do que eu
meço.

**Confirmação independente no dado** (regra de 10/09, vale mais que o `gh`):
`coverage_espalhada_piso` = 0 na régua anterior → **17** na nova;
`coverage_espalhada_piso_terminal` = 0 → **11**. Os contadores do `2adb080` só
aparecem depois de 08/09 15:22Z, e **nada novo apareceu depois de 15/09 03:49Z**.
A régua está confirmada pelos jobs, não só pelo workflow.

> **Régua no ar: `2adb080` (08/09 15:22:32Z) — OITO dias.**
> `git log b2d9f47a..origin/main -- runpod-worker/` saiu **vazio**: não existe
> correção escrita e não deployada. O acumulado **não** reinicia.

---

## PASSO 2 — Medição

### Sanidade

| Checagem | Resultado |
|---|---|
| (a) presas em `pending` HOJE | **2** — investigadas até o fim, ver abaixo. Não é "ainda não deu tempo de falhar" |
| (b) `failed` com `error_message` vazio HOJE | **0** — sem falha invisível |
| (c) status crus HOJE | `{"ready": 17, "pending": 1}` no instante da medição |
| (d) `elapsed` NULL em `ready` na régua nova | 180/695 (**26%**) — dentro da faixa normal 13-29%, encerrada em 08/09. Sem alarme. |

As duas `pending` eu não deixei como "provavelmente resolve". Acompanhei com teto
(20 tentativas × 20s, nunca laço aberto) até as duas fecharem:

```
a50869b4 -> ready, elapsed= 92,73s, err=null
c01e27eb -> ready, elapsed=106,68s, err=null
```

Nenhum aluno travado. Mas ver isso ao vivo produziu um achado — está no fim.

### (e) Denominador que encolhe — a checagem fixa passou limpa, e mesmo assim sumiu gente

| Filtro (desde 25/08) | Hoje | 15/09 registrou | Δ |
|---|---|---|---|
| `qa_coverage` | 11 | 11 | **0** |
| Falhas totais | 14 | 14 | **0** |

Nenhuma falha de período fechado sumiu. **Mas a checagem só olha falha**, e o
total de dias já fechados encolheu:

| Dia (fechado) | 14/09 registrou | 15/09 registrou | Vivo hoje | Δ desde 15/09 |
|---|---|---|---|---|
| 09/09 | 118 | 118 | 118 | 0 |
| 10/09 | 90 | 90 | 90 | 0 |
| 11/09 | 100 | 100 | 100 | 0 |
| 12/09 | 75 | 74 | **72** | **−2** |
| 13/09 | 51 | 50 | 50 | 0 |
| 14/09 | — | 101 | **96** | **−5** |

**−7 linhas desde a ronda de ontem.** O 12/09 encolheu duas rondas seguidas
(75 → 74 → 72). Dias mais antigos (09, 10, 11/09) já estabilizaram.

**Mecanismo, procurado no código antes de chamar de anomalia** — são dois
caminhos legítimos de produto, os dois **hard delete, sem tombstone**:

- `DELETE /api/v1/generations` (`generations/route.ts:160`) — o aluno apaga a
  própria geração.
- `DELETE /api/v1/account/delete` — exclusão de conta; o `deleteUser` no Auth
  cascateia por FK e leva as gerações junto.

Isso **não é bug** e não é incidente. Mas tem três consequências que valem pra
medição, e é por isso que está aqui:

1. Todo número de dia fechado que eu publico é **provisório**. O "101 do 14/09"
   que a ronda de ontem registrou já não existe.
2. O acumulado de 697 é **piso**, não o que realmente rodou.
3. **O risco que importa:** um aluno cuja geração **falhou** é justamente o mais
   propenso a apagá-la. Se isso acontecer, a falha some do histórico e a taxa
   melhora **sozinha** — que é exatamente o modo de erro que a lição de 13/09
   antecipou. Hoje isso **não** ocorreu (a falha de 11/09 segue viva, falhas
   desde 09/09 = 1, inalterado), mas o mecanismo está ativo e removeu 7 linhas em
   24h. A checagem fixa precisa passar a vigiar **total por dia fechado**, não só
   contagem de falha.

### Janelas

Molde: corte em 08/09, oito dias atrás → terceira forma da lição de 28/08. Não
existe "hoje antes do corte" nem "ontem antes do corte". Quem conclui é o
acumulado.

| Janela | Total | Falhas | qa_cov | Taxa | ≥1000ch | 1500-2500ch |
|---|---|---|---|---|---|---|
| Contexto 25/08→05/09 (réguas misturadas) | 902 | 13 | 10 | 1,4% | 7/153 | 5/68 |
| Régua anterior `eccc3d59` (baseline limpo) | 180 | 0 | 0 | 0,0% | 0/26 | 0/14 |
| 08/09 depois do corte (rabo do dia) | 59 | 0 | 0 | 0,0% | 0/5 | 0/2 |
| 09/09 | 118 | 0 | 0 | 0,0% | 0/9 | 0/3 |
| 10/09 | 90 | 0 | 0 | 0,0% | 0/12 | 0/4 |
| 11/09 | 100 | 1 | 1 | 1,0% | 0/14 | 0/5 |
| 12/09 | 72 | 0 | 0 | 0,0% | 0/22 | 0/5 |
| 13/09 | 50 | 0 | 0 | 0,0% | 0/14 | 0/4 |
| 14/09 | 96 | 0 | 0 | 0,0% | 0/23 | 0/3 |
| 15/09 (ontem) | 94 | 0 | 0 | 0,0% | 0/15 | 0/0 |
| **16/09 até 15:12Z (hoje)** | **18** | **0** | **0** | **0,0%** | 0/2 | 0/1 |
| **ACUMULADO régua nova (08/09 15:22Z →)** | **697** | **1** | **1** | **0,1%** | **0/116** | **0/27** |

As linhas "15/09 antes/depois do build 03:49Z" (29 e 65, ambas 0 falhas) ficaram
na saída do script como **contexto rotulado**, não como divisor de régua — forma
que a lição de 07/09 manda usar pra build que não muda decisão.

### O que dá e o que não dá pra concluir

- **Hoje NÃO conclui.** n=18 está **abaixo do piso de 20**. Na faixa que quebra é
  n=2 (≥1000ch) e n=1 (1500-2500ch). Escrever "0% hoje, melhorou" com esse n seria
  exatamente o erro que esta rotina existe pra impedir: uma falha só levaria a
  taxa a 5,6%. **n pequeno demais pra concluir.**
- **Quem sustenta é o acumulado, com a ressalva de sempre.** 0/116 em ≥1000ch é o
  número que segura. Mas em 1500-2500ch são **0/27**, e P(ver zero por sorte na
  taxa histórica de 7,4%) = **12,5%** — o acumulado **não** prova melhora *naquela
  faixa*. Quem conclui é o n global, não a faixa.
- **A régua continua consistente com "baixa", e "baixa" não é "zero"** (lição de
  12/09). Última falha de `qa_coverage`: **11/09 20:53Z**, 341 gerações atrás.
  Taxa pós-28/08 = 1/1477 = **0,07%**. Na régua nova, 1/697.
  P(ver ≥1 se a taxa for a baixa) = **37,6%** → a falha de 11/09 era **esperada**,
  não piora. Se a taxa tivesse voltado à histórica de 1,1%, o esperado em 697
  seria **7,7 falhas**, não 1.

### Elapsed e mecanismo

Sem hang. Máximo **378,88s** na régua nova — é a mesma geração que já era o máximo
ontem, não um caso novo. Incidente `d3d8d1b2` segue fechado como aceite de risco;
nada aqui pede reabertura.

| | Régua anterior | Régua nova |
|---|---|---|
| `ready` geral | n=139, mediana 96,5s, p90 169,1s | n=515, mediana 98,0s, p90 168,7s |
| ≥1000ch | n=26, mediana 168,9s, p90 330,9s | n=116, mediana 147,5s, p90 251,7s |

**Recomposição:** `coverage_rescued` 12 → 25, com o sub-caminho contando a
história: piso 0→17 e orgânico 12→8. População trocou por dentro, como esperado.
`coverage_exhausted` = 1 em 697 (a falha de 11/09 — o portão funcionando).

Observação de ontem que **persiste**: em ≥1000ch a régua nova segue mais rápida
(147,5s vs 168,9s), contra a direção projetada do piso 0.65. O n do lado novo
subiu de 111 para 116; o do lado antigo segue **26** e não vai crescer nunca (é
janela fechada). Continua **não** sendo achado: comparação não pré-registrada,
lado antigo com n pequeno. Fica como coisa a observar, não como resultado.

---

## PASSO 3 — Quem falhou

**Ninguém.** Zero falhas em 15/09 e zero em 16/09. `user_id` com falha desde
ontem: `[]`.

A única falha da régua nova continua sendo a de **11/09 20:53Z**
(`67f28d0f-…`, user `4fbe87ff-…`, 354ch, 234,2s), já tratada nas rondas de 12 e
13/09, incluindo a checagem de pagante trancado. Não há caso novo, então **não há
estorno novo a conferir** (`ref_type='generation_refund'`, nunca `kind`).

**Sem aluno travado.** As duas `pending` de hoje fecharam `ready` sem erro.

---

## PASSO 4 — Volume (lição de 14/09: compare o MESMO horário)

Hoje é **quarta**. Sempre até 15:12Z, nunca contra o total fechado dos outros dias:

| Dia | até 15:12Z | dia fechado |
|---|---|---|
| 08/09 (ter) | 26 | 86 |
| 09/09 (**qua**) | **36** | 118 |
| 10/09 (qui) | 43 | 90 |
| 11/09 (sex) | 48 | 100 |
| 12/09 (sáb) | 27 | 72 |
| 13/09 (dom) | 12 | 50 |
| 14/09 (seg) | 46 | 96 |
| 15/09 (ter) | 48 | 94 |
| **16/09 (qua)** | **18** | — (parcial) |

**18 é a menor leitura de dia útil de toda a série** neste horário — metade da
quarta anterior (36) e ~40% de ontem (48). Só os domingos ficam abaixo.

Antes de chamar de queda, quebrei por hora pra ver **onde** o déficit está:

| Dia | 00-03h | 04-10h | 11-15h |
|---|---|---|---|
| 11/09 | 20 | 2 | 32 |
| 12/09 | 12 | 4 | 14 |
| 13/09 | 3 | 3 | 7 |
| 14/09 | 27 | 2 | 21 |
| 15/09 | 29 | 2 | 24 |
| **16/09** | **5** | **0** | **14** |

- O bloco **04-10h é sempre vazio** (0-5 em toda a série). O zero de hoje **não é
  sinal de nada** — eu ia reportar como "8 horas sem geração" antes de olhar a
  série e ver que é o padrão normal da madrugada.
- O déficit está inteiro no bloco **00-03h**: 5 hoje contra 27 e 29 nos dois dias
  anteriores. Só que esse é **o bloco mais volátil da série** (amplitude 3 a 29).
- O bloco comercial (11-15h) está em 14, baixo mas dentro do já visto (12/09 teve
  14, 13/09 teve 7).

**Conclusão honesta: não dá pra concluir queda de demanda com um dia.** É a menor
leitura útil da série, o que é real e merece vigilância, mas o déficit está
concentrado justamente no bloco mais barulhento, e é **um** dia. Se 17/09 repetir
o padrão no mesmo horário, aí vira sinal. Hoje é item de vigia, não achado.

---

## Achado do dia: `elapsed_seconds` não é o que o aluno espera

Acompanhando as duas `pending` ao vivo, apareceu um descompasso que a tabela não
mostra:

| Geração | Criada → `ready` (relógio) | `elapsed_seconds` (GPU) | Diferença |
|---|---|---|---|
| `a50869b4` | **8,4 min** | 92,73s (1,5 min) | **~6,9 min de fila** |
| `c01e27eb` | **3,5 min** | 106,68s (1,8 min) | **~1,7 min de fila** |

O aluno do primeiro caso esperou **8,4 minutos** por uma geração que ocupou a GPU
por **93 segundos**. `elapsed_seconds` mede **computação**, não espera.

Duas consequências:

1. **O detector de hang é cego pra fila.** A regra em uso é
   `elapsed_seconds > 400s ⇒ suspeita de hang`. Um aluno parado 7 minutos numa
   fila registra `elapsed=93s` e passa como "tempo normal". Se a experiência que
   importa é a do aluno, esse teste não cobre ela.
2. **Não dá pra medir isso pra trás.** Conferi as colunas reais de `generations`:
   `id, user_id, voice_id, text_raw, text_normalized, reference_audio_path,
   reference_transcript, audio_path, sample_rate, duration_seconds,
   elapsed_seconds, status, error_message, created_at, runpod_job_id, name, qa,
   request_params, request_attempts`. **Não existe `completed_at` nem
   `updated_at`.** Sem isso, a espera do aluno só é observável **ao vivo**, como
   eu fiz hoje por acaso. Histórico não tem.

Plausível que seja cold start dos workers do RunPod (que escalam 0→N) num dia de
volume baixo — o que casa com o PASSO 4. Mas isso é **hipótese com n=2**, não
medição, e eu não vou apresentar como causa.

**Não fiz nada a respeito** (não é meu escopo mexer em schema nem no endpoint).
Fica registrado como pendência pro Johnny decidir: se a latência percebida pelo
aluno importa, falta uma coluna de conclusão pra ela ser mensurável.

---

## H-idioma — pré-registro, acumulando

Janela: gerações de **13/09 em diante**, sem reaproveitar as 1182 já vistas.

- **258** gerações novas (185 com coluna `qa`)
- **3 divergentes** de 8 necessários
- COM divergência: 0/3 · SEM divergência: 0/182 · Fisher p = 1,0000
- Poder: se o efeito de 12/09 (12,5%) fosse real, esperaria **0,38** falha entre
  os 3 divergentes

> **VEREDITO: AINDA ACUMULANDO — 3/8 divergentes. Não conclui, e não deve.**
> Não alargar a janela pra trás.

**Reconferência da premissa** (regra deixada em 15/09 — o alvo envelhece junto com
a taxa): divergência observada agora é **3/258 = 1,16%** (~86 gerações por
divergente), contra 0,97% medido ontem. n necessário pra 8 divergentes nessa taxa
= **~688**, contra o alvo vigente de 828 (Δ = −140). **O alvo de 828 segue
compatível** — não mexi nele. Ressalva que não pode sumir: isso se apoia em
**n=3**, que é ruído; não prova que a taxa é 1,16%.

Ritmo honesto (**só dias completos**, 240 gerações / 3 dias = **80/dia**) → faltam
570 → **~7,1 dias**, ou seja **~23/09**. Corrigi o script aqui: a conta antiga
dividia pelo tempo corrido **incluindo o dia parcial de hoje**, o que joga o
ritmo pra baixo (daria 71/dia). É a mesma família de erro da lição de 14/09, onde
o viés veio do meu próprio código.

Idiomas no dado novo: `{"pt":29, "de":1, "en":1, "es":1, "tr":1}`.

---

## Pendências para a próxima ronda

- **Números pra checagem de denominador**: `qa_coverage` desde 25/08 = **11**;
  falhas totais desde 25/08 = **14**.
- **Totais de dias fechados** (pra detectar apagamento, que a checagem de falha
  não pega): 09/09=118 · 10/09=90 · 11/09=100 · 12/09=**72** · 13/09=50 ·
  14/09=**96** · 15/09=**94**. Se algum cair de novo, é linha apagada.
- **Régua no ar**: `2adb080` (08/09 15:22Z), **oito dias**, nada pendente de
  deploy. Critério (não gatilho): se aparecer verde novo, **cheque o diff de
  `jobs/inference.py`, `jobs/tts_settings.py` e `tts_qa/loop.py`** — é isso que
  define corte, nunca a existência do build.
- **Volume**: 16/09 teve a menor leitura de dia útil da série (18 às 15:12Z, vs 36
  na quarta anterior), com o déficit todo no bloco volátil 00-03h. **Se 17/09
  repetir, vira sinal.** Um dia não conclui.
- **H-idioma**: 258/828, **3/8 divergentes**. Meta é o número de divergentes, não
  a data. Se chegar em ~23/09 com <8, o resultado certo segue sendo continuar sem
  resultado.
- **A observar, sem status de achado**: ≥1000ch mais rápido na régua nova (147,5s
  vs 168,9s). O lado antigo é janela fechada em n=26 e não cresce.
- Incidente `d3d8d1b2` (hang) segue fechado. Nenhum elapsed suspeito hoje.

## Lição do dia (para o cabeçalho da base)

**LIÇÃO DE 16/09 — uma checagem que passa limpa não é a mesma coisa que nada ter
mudado.** A checagem (e) existe desde 13/09 pra pegar denominador que encolhe.
Hoje ela passou limpa (falhas 14=14, qa_cov 11=11) e, ao mesmo tempo, **7 linhas
sumiram de dias fechados**. Ela não errou — ela só vigia o **numerador**. Eu só
notei porque comparei os totais por dia contra a tabela da véspera, coisa que a
rotina não manda fazer. O erro que isso quase produziu não é reportar número
errado: é **confiar que "a checagem passou" significa "a base está íntegra"**.

**Corolário:** toda checagem de integridade tem que declarar **o que ela NÃO
cobre**. A (e) cobre falha apagada; não cobre sucesso apagado, e portanto não
cobre o caso perigoso de o aluno apagar a própria geração **que falhou**. Por
isso passei a registrar os totais por dia fechado nas pendências — o custo é uma
linha por ronda, e é o que transforma "passou limpa" em "conferido".

**Segunda lição, mesma família:** eu ia reportar "8 horas sem nenhuma geração
hoje" como sinal de problema. Fui olhar a série por hora e o bloco 04-10h é vazio
**todos os dias**. O padrão só vira anomalia contra a linha de base — e eu não
tinha a linha de base até construir a matriz dia × hora. Vale pro volume de hoje
também: 18 é a menor leitura útil da série (real), mas o déficit está no bloco de
maior amplitude da série (3 a 29), então **um dia não conclui**.

## O que eu não fiz

Não respondi aluno, não mexi em crédito, não abri nem fechei incidente, não
toquei no endpoint do RunPod, não mexi em schema.
