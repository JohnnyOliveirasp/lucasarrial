# Ronda diária qa_coverage — 2026-09-17 (quinta)

Medição às 15:32Z. Script: `/tmp/perf/qacov-2026-09-17.cjs` (saída completa em
`/tmp/perf/out-0917.txt`, 426 linhas, exit=0). Apoio: `_aluno_0917.cjs`,
`_erros_0917.cjs`, `_stats_0917.cjs`.

**Resumo:** o indicador desta rotina (`qa_coverage`) está **limpo** — zero em
16/09 e 17/09, e segue 1/795 na régua vigente. **Mas o dia não é limpo.** Ontem,
às 19:24-19:51Z, apareceram **4 falhas com uma assinatura de erro que nunca
existiu na série**: `System error.` / `RunPod FAILED: System error.` Duas alunas
afetadas, todas as 4 estornadas. **Não é `qa_coverage` e não é deploy** — não há
build desde 15/09, e o de 15/09 é treino de voz. Uma aluna se recuperou por
completo; a outra levou o áudio dela no meio do cluster mas **sumiu há 20h**
depois de duas falhas seguidas.

> **Se eu tivesse reportado só o indicador da rotina, este relatório diria "dia
> limpo" enquanto duas alunas pagantes falhavam.** O achado do dia está fora do
> indicador que a rotina foi criada pra vigiar.

---

## PASSO 1 — Qual régua está no ar

`gh run list --workflow=runpod-worker.yml --limit 5`:

| SHA | Fim (updatedAt) | Conclusão |
|---|---|---|
| `b2d9f47` | 2026-09-15T03:49:41Z | success |
| `7b673a7` | 2026-09-15T02:44:36Z | success |
| `2adb080` | 2026-09-08T15:22:32Z | success |

**Nenhum run falhou. Nenhum `in_progress`. Não há build de hoje nem de ontem.**

### Verde não é corte — refiz a checagem em vez de herdar a nota da véspera

A lição de 15/09 é que nota da véspera não é árbitro, então **não** herdei a
conclusão da ronda de 16/09. Refiz na mão:

```
git log -1 --format='%H parents=%P' b2d9f47   -> UM parent (squash, nao merge)
git diff b2d9f47^1 b2d9f47 --numstat -- runpod-worker/
    4+/0-    jobs/train.py
   28+/4-    jobs/train_reference.py
  190+/6-    test_reference_word_snap.py
   44+/0-    test_train_smoke.py
   10+/0-    voice_pipeline/__init__.py
   65+/14-   voice_pipeline/reference.py
git diff b2d9f47^1 b2d9f47 -- runpod-worker/ | grep -iE "qa_cov|coverage|limiar|threshold|piso"
   -> VAZIO
```

As 14 remoções de `reference.py` eu li uma a uma: são assinatura de tipo e
troca de "devolve a melhor janela" por "devolve o ranking" — refatoração do
caminho de **treino de voz**. Zero conteúdo de `qa_coverage`.

**Armadilha que eu quase comi nesta ronda:** `git log -- runpod-worker/inference.py`
saiu **vazio** e por um instante isso parecia "arquivo intocado". É o contrário:
o arquivo **mudou de lugar** (`runpod-worker/inference.py` → `runpod-worker/jobs/inference.py`).
Caminho errado devolve vazio com exit 0, e vazio é exatamente o que eu queria ver.
Conferi onde a lógica mora de fato (`grep -rl qa_coverage runpod-worker/`) antes
de concluir qualquer coisa. Os arquivos que decidem `qa_coverage`:

```
git log -1 -- runpod-worker/jobs/inference.py     -> 243aa73 (04/09, no ar em 08/09)
git log -1 -- runpod-worker/jobs/tts_settings.py  -> 243aa73 (04/09, no ar em 08/09)
```

**Confirmação independente no dado** (regra de 10/09, vale mais que o `gh`):
`coverage_espalhada_piso` = 0 na régua anterior → **21** na nova;
`coverage_espalhada_piso_terminal` = 0 → **16**. Os contadores do `2adb080` só
aparecem depois de 08/09 15:22Z, e **nada novo apareceu depois de 15/09 03:49Z**.

> **Régua no ar: `2adb080` (08/09 15:22:32Z) — NOVE dias.**
> `git log b2d9f47..origin/main -- runpod-worker/` saiu **vazio**: não existe
> correção escrita e não deployada. O acumulado **não** reinicia.

---

## PASSO 2 — Medição

### Sanidade

| Checagem | Resultado |
|---|---|
| (a) presas HOJE | **0** — o zero de hoje não é "ainda não deu tempo de falhar" |
| (b) `failed` com `error_message` vazio HOJE | **0** — sem falha invisível |
| (c) status crus HOJE | `{"ready": 40}` |
| (d) `elapsed` NULL em `ready` na régua nova | 197/790 (**25%**) — dentro da faixa normal 13-29%. Sem alarme. |

### (e) Denominador que encolhe

| Filtro (desde 25/08) | Hoje | 16/09 registrou | Δ |
|---|---|---|---|
| `qa_coverage` | 11 | 11 | **0** |
| Falhas totais | **18** | 14 | **+4** |

O `+4` é exatamente o cluster de ontem — falha **nova**, não apagamento.
Nenhuma falha de período fechado sumiu.

### (e2) Total de dias fechados

| Dia | Véspera registrou | Vivo hoje | Δ |
|---|---|---|---|
| 09/09 | 118 | **116** | **−2** |
| 10/09 | 90 | 90 | 0 |
| 11/09 | 100 | 100 | 0 |
| 12/09 | 72 | 72 | 0 |
| 13/09 | 50 | 50 | 0 |
| 14/09 | 96 | 96 | 0 |
| 15/09 | 94 | 94 | 0 |

**−2 linhas, e num dia que eu tinha dado como estável.** A ronda de 16/09
escreveu que "dias mais antigos (09, 10, 11/09) já estabilizaram". **Não
estabilizaram**: 09/09 encolheu oito dias depois do fato. Não existe prazo após
o qual um dia fechado para de mudar — só há dias que ainda não mudaram.

As 2 linhas eram **sucesso**, não falha: falhas totais foram 14→18 e o +4 está
todo explicado pelo cluster de ontem. Como só sucesso saiu, a taxa foi empurrada
levemente **pra cima**, que é o lado seguro. Verificado, não presumido.

### Janelas

Molde: corte em 08/09, **nove dias atrás** → terceira forma da lição de 28/08.
Não existe "hoje antes do corte" nem "ontem antes do corte".

| Janela | Total | Falhas | qa_cov | Taxa | ≥1000ch | 1500-2500ch |
|---|---|---|---|---|---|---|
| Contexto 25/08→05/09 (réguas misturadas) | 893 | 13 | 10 | 1,5% | 7/153 | 5/68 |
| Régua anterior `eccc3d59` (baseline limpo) | 180 | 0 | 0 | 0,0% | 0/26 | 0/14 |
| 14/09 | 96 | 0 | 0 | 0,0% | 0/23 | 0/3 |
| 15/09 | 94 | 0 | 0 | 0,0% | 0/15 | 0/0 |
| **16/09 (ontem, fechado)** | **78** | **4** | **0** | **5,1%** | **4/18** | 0/3 |
| **17/09 até 15:32Z (hoje)** | **40** | **0** | **0** | **0,0%** | 0/4 | 0/3 |
| **ACUMULADO régua nova (08/09 15:22Z →)** | **795** | **5** | **1** | **0,6%** | 4/135 | **0/32** |

As linhas "15/09 antes/depois do build 03:49Z" (29 e 65, ambas 0 falhas) ficaram
na saída como **contexto rotulado**, não como divisor de régua.

> **Bug de janela que eu corrigi nesta ronda:** essas duas linhas de contexto
> tinham `fim: ${HOJE}T00:00:00Z`. Isso funcionava enquanto `HOJE=16/09`, mas com
> `HOJE=17/09` a linha rotulada **"15/09 DEPOIS do build"** passaria a cobrir
> 15/09 03:49Z → **17/09** 00:00Z — dois dias inteiros, com rótulo de um. Janela
> que cresce sozinha quando a data vira é o viés de 14/09 na veia: deixar a
> **janela** escolher o resultado. Fixei no fim real do dia 15/09.

---

## PASSO 3 — Quem falhou (vem antes de qualquer número)

### O achado: `System error.` é assinatura NOVA

Antes de chamar de "novo", conferi o passado no banco (lição de 12/09 — "novo" é
uma afirmação sobre o passado, e o passado está no banco, não na minha memória):

| Erro | Total desde 25/08 | Quando |
|---|---|---|
| `qa_coverage` | 11 | 25-27/08 (10) + 11/09 (1) |
| **`System error.` (RunPod/infra)** | **4** | **todas em 16/09 19:24-19:51Z** |
| `executionTimeout` | 3 | 28/08 (1) + 04/09 (2) |

**Zero ocorrências antes de ontem.** É assinatura nova de verdade.

**Concentração** (estrato `≥1000ch` é o corte fixo da rotina, não garimpo):

- Em 16/09: **4/18 em ≥1000ch vs 0/60 em <1000ch**, Fisher p = **0,0022**
- No tempo: **4/17 na janela 19:00-20:15Z vs 18/1868 na série**, Fisher p = **1,3e-5**

O cluster é real e denso. **Mas o p mede a concentração, não a causa** — e a
causa não está provada aqui.

**O que empurra contra "regressão de código":** dentro da mesma janela, outras
alunas geraram normalmente (19:35, 19:37, 19:40, 19:49) e a **própria Tania teve
um 1350ch pronto às 19:40**, entre a 1ª e a 2ª falha, com o mesmo texto. Falha
intermitente no mesmo texto/mesma conta é assinatura de **infra**, não de bug
determinístico. Somado a **não haver deploy** desde 15/09 (e o de 15/09 ser
treino de voz), a hipótese de regressão do worker fica fraca. **Hipótese, não
conclusão** — eu não fui ao RunPod confirmar, e não vou inventar a causa.

### As duas alunas

**Mariana Macedo Leme** (`mariana@excellerconsultoria.com.br`, acesso até 07/10)
— 1 falha às 19:24Z (1141ch, elapsed 402s).
**Desfecho: resolvido.** O mesmo texto de 1141ch saiu **ready às 20:24Z**, e ela
seguiu gerando normalmente até 02:23Z de hoje (7 `ready` depois da falha).
Estornada em 19:31Z. Caso fechado.

**Tania Regina Bazaglia Espadaro** (`taniaregina.espadaro@gmail.com`, acesso até
**21/09** — 4 dias) — 3 falhas (19:28, 19:47, 19:51Z), todas 1350ch, todas
estornadas.

Aqui eu preciso **corrigir a minha própria ferramenta**. O script que escrevi
olhava só o que veio **depois da ÚLTIMA falha** e cuspiu
`NAO -- ALUNO SEGUE SEM O QUE PEDIU`. Isso está **errado** e teria virado um
alarme falso no relatório. A sequência real dela é:

```
17:40  ready   97ch
19:28  FAILED  1350ch  System error.
19:40  ready   1350ch          <<< ela TEM o audio dela
19:47  FAILED  1350ch  System error.
19:51  FAILED  1350ch  RunPod FAILED: System error.
(nada desde entao — 20h)
```

**Desfecho honesto:** ela **não está sem o áudio** — o 1350ch saiu às 19:40. Mas
ela tentou mais duas vezes depois do sucesso (provavelmente querendo outra
tomada), levou duas falhas seguidas, e **não voltou há 20 horas**. Não é "aluna
travada" no sentido de estar sem entrega, e eu não vou inflar isso. É **risco de
churn** numa conta que vence em 4 dias, e é a única das duas que merece olhada
humana.

> Estorno não é desfecho — as 4 foram estornadas e isso não diz nada sobre quem
> conseguiu o que queria. Quem responde isso é a coluna de `ready`, e eu fui
> olhar uma por uma.

---

## O que dá e o que não dá pra concluir

**Dá pra concluir:**

- **`qa_coverage` segue baixo.** Zero em 16/09 e 17/09. Na régua nova: **1/795
  (0,13%)**. Se tivesse voltado à histórica de 1,1%, o esperado em 795 seria
  **8,7 falhas**, não 1. Última `qa_coverage`: 11/09 20:53Z, 441 gerações atrás.
- **A régua está confirmada no dado**, não só no workflow (piso 0→21).
- **O cluster de ontem é real e não é `qa_coverage`** (p=1,3e-5 no tempo).

**NÃO dá pra concluir:**

- **Que hoje está bem no estrato que quebrou ontem.** Hoje tem **0/4** em
  ≥1000ch. Se a taxa de ontem (22,2%) ainda valesse, P(ver 0 em n=4) = **37%**.
  O dia limpo de hoje **não refuta** o de ontem onde importa.
- **A causa do `System error.`** Intermitência + ausência de deploy apontam pra
  infra, mas isso é hipótese.
- **Que a faixa 1500-2500ch melhorou.** 0/32 no acumulado; P(ver zero por sorte
  na taxa histórica de 7,4%) = **8,5%**. Baixo, mas não é prova.

### H-idioma (pré-registrado 12/09, n calculado 13/09)

Acúmulo: **358/828** gerações novas. Ritmo honesto (só dias completos): **80/dia**.
Divergentes: **6/8** do alvo. `COM divergência 0/6` vs `SEM 4/262`, Fisher p=1,0.

**Não conclui, e não deve.** O critério é 8 divergentes, e são 6. A taxa de
divergência observada segue ~1,7% (6/358), coerente com a reestimativa de 15/09
— o alvo de 828 continua defensável. Faltam ~470 gerações ≈ 6 dias.
**Ressalva que não pode sumir:** as 4 falhas que entraram no braço "SEM
divergência" são o cluster de infra de ontem, não `qa_coverage`. Se elas
inflarem o braço de controle, o teste fica contaminado por um evento que nada
tem a ver com a hipótese. **Anotado pra decidir na ronda que fechar o teste: as
falhas de `System error.` devem sair do H-idioma.** Decidir isso agora, com o
resultado ainda aberto, é o oposto de escolher a janela depois de ver o número.

### Elapsed

Sem hang novo. Máximo na régua nova segue **378,88s** — a mesma geração de
sempre, não caso novo. A falha de Mariana teve **402s**, acima do limiar de 400s
do detector, **mas o erro é `RunPod FAILED`, não hang silencioso** — é o job
morrendo, não pendurando. Incidente `d3d8d1b2` segue fechado; **não reabri** e
não há dado novo que peça isso.

---

## Lição de hoje — a ronda enxerga ~40% do dia

A ronda de 16/09 mediu às 15:12Z, viu **0/18** e escreveu, com toda a honestidade,
"dia limpo, mas n=18 não conclui". **Quatro horas depois o dia produziu 4
falhas.** O dia fechou em 78 gerações: a ronda tinha visto **26%** dele.

Não é erro da ronda de ontem — ela declarou o n baixo. O problema é
**estrutural**, e eu quantifiquei em vez de tratar como anedota:

| Dia | Visto às 15:32Z | Dia fechado | % visto |
|---|---|---|---|
| 08/09 | 28 | 86 | 33% |
| 09/09 | 39 | 116 | 34% |
| 10/09 | 45 | 90 | 50% |
| 11/09 | 51 | 100 | 51% |
| 12/09 | 29 | 72 | 40% |
| 13/09 | 13 | 50 | 26% |
| 14/09 | 50 | 96 | 52% |
| 15/09 | 49 | 94 | 52% |
| 16/09 | 20 | 78 | 26% |

**Mediana 40%** (26-52%). Ou seja: **"HOJE está limpo" é sempre uma afirmação
sobre a minoria do dia**, e a minoria muda de tamanho conforme o dia. O pico de
uso é à **noite** — justamente o pedaço que a ronda nunca vê no mesmo dia.

**REGRA:** a janela que conclui sobre um dia INTEIRO é sempre **ONTEM**, nunca
HOJE. "Hoje" é prévia, e deve ser rotulada como prévia — com o % do dia que ela
representa, não só o `n`. Dizer "n=40 passa do piso de 20" é verdade e ainda
assim engana, porque o piso foi pensado pra poder estatístico, não pra
representatividade do dia.

Isso conversa com a lição de 14/09 (comparar o mesmo horário) e com a de 16/09
(toda checagem tem que declarar o que **não** cobre): **esta rotina não cobre a
noite do próprio dia.** Nunca cobriu. Ontem foi a primeira vez que isso custou
alguma coisa visível.

### Segunda lição — a ferramenta respondeu a pergunta errada com confiança

O `_aluno_0917.cjs` imprimiu `ALUNO SEGUE SEM O QUE PEDIU` em maiúsculas com
setas, e estava **errado**: a Tania tinha o áudio dela desde 19:40. O código
fazia "olhe o que veio depois da ÚLTIMA falha" — correto quando as falhas vêm em
bloco, errado quando **sucesso e falha se intercalam**, que é exatamente a
assinatura de infra intermitente.

Par com 14/09 ("o viés veio de código MEU") e 15/09 ("a nota da véspera não é
árbitro): **a saída enfática da minha própria ferramenta também não é árbitro.**
Ela formata com urgência o que o `if` dela decidiu, e o `if` tinha uma premissa
escondida. Só peguei porque li a lista de gerações linha a linha em vez de
confiar no veredito. **REGRA: veredito de ferramenta própria em caso de aluno se
confere contra a sequência crua antes de virar frase no relatório** — ainda mais
quando o veredito é o alarmante, porque alarme falso gasta a credibilidade do
relatório inteiro.

---

## Pendências para a próxima ronda (CRITÉRIO, nunca gatilho)

1. **`System error.` voltou?** Se aparecer de novo, deixa de ser evento isolado e
   vira padrão — aí a pergunta é infra do RunPod, e vale escalar. Se não
   aparecer em 2-3 rondas, foi blip. **Não** abrir incidente agora com n=4 de uma
   janela de 27 min.
2. **Tania voltou a gerar?** Conta vence **21/09**. Se seguir sem gerar, é sinal
   de churn — e isso é assunto do Johnny com a aluna, não meu.
3. **Régua:** se aparecer verde novo, **cheque o diff de
   `runpod-worker/jobs/inference.py` e `jobs/tts_settings.py`** (caminho novo,
   depois da mudança de pasta) antes de partir qualquer janela. Verde não é corte.
4. **H-idioma:** faltam 2 divergentes. Ao fechar, **tirar as falhas de
   `System error.`** do braço de controle — decidido hoje, com o teste aberto.
5. **Baselines pra amanhã:** `qa_coverage` desde 25/08 = **11**; falhas totais =
   **18**; dias fechados 09/09=**116**, 10/09=90, 11/09=100, 12/09=72, 13/09=50,
   14/09=96, 15/09=94, **16/09=78** (primeira leitura fechada).
