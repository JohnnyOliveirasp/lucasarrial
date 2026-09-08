# Ronda das falhas — 08/09/2026, ~14h20–15h20Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08).

**Card levado adiante:** `#226` (`702cc916`).
**Estado no fim:** conserto **mergeado** (PR #176, merge `c1db335`), imagem do
worker em build; incidente **continua `investigating`** de propósito; 1 achado
lateral consertado (PR #213, merge `2adb080`); 2 notas gravadas e relidas.

---

## 0. A ronda em uma linha

**Mergeei um conserto medido e testado que estava parado há 4 dias enquanto o
defeito seguia entregando áudio ruim para aluno pagante — e, ao medir de novo
antes de subir, achei que o pior caso não é mais 0,333 de cobertura: são três
entregas com cobertura 0,0.**

---

## 1. O item que a ronda anterior deixou: FECHADO

A ronda das 14h pediu pra conferir se o cron falou com as 5 pessoas do `#306`,
com prioridade pra `alinecuida` (janela fechando 10/09). Conferido por
`ler_caixa.cjs --enviados --para <email>`, uma a uma:

| pessoa | convite | quando |
|---|---|---|
| `alinecuida` | uid 1318 | **08/09 14:00:08Z** |
| `herysilva.27` | uid 1319 | 08/09 14:00:15Z |
| `gustavocasarotto` | uid 1320 | 08/09 14:00:22Z |
| `jkakorio` | uid 1321 | 08/09 14:00:29Z |
| `rodrigo.limas.1978` | uid 1322 | 08/09 14:00:35Z |

**As 5 receberam.** O fix do `#306` funcionou em produção na primeira varredura
depois do deploy. A hipótese que a ronda anterior deixou escrita ("se seguirem
sem convite, o defeito é o cron") **não precisou ser investigada**.

---

## 2. Por que o `#226`, e não o mais antigo da fila

Fila no início: **36 abertos**, 12 `aguardando_aluno`, 4 presos.

Ordenei os abertos por `created_at` (não por `last_seen_at`, que é o que a
varredura mostra) e fui de cima pra baixo:

- **`#15`** (30/07, o mais antigo) — travado por dois motivos que não dependem
  de mim: espera a **próxima falha** com a imagem nova pra ler `chunk`/`attempt`
  (a nota de 08/09 02hZ provou que `fase_corrente` só sobrevive em geração que
  morreu, então nenhuma geração bem-sucedida responde), e a **migration 82**
  aguarda aval do Johnny. Pela regra 8 de 21/08, digo o passo e sigo.
- **`#222`** (01/09 15:54) — travado em **decisão do Johnny**, medido em 06/09.
- **`#226`** (01/09 17:52) — **acionável, e o conserto já existia.**

O que me fez parar nele: o **PR #176 estava aberto desde 04/09 15:52Z**, com a
medição pronta e a suíte verde, e a classe seguiu disparando os 4 dias inteiros.
O Vigia já tinha registrado em 06/09 12hZ que *"o conserto já está no PR #176"* —
e ninguém mergeou.

É o mesmo padrão que a ronda das 14h pegou hoje no `#306` (código pronto e
invisível), com uma diferença: aqui o trabalho estava no **git**, revisado e
medido. Ficou parado mesmo assim.

---

## 3. Medi de novo antes de subir — e o número piorou

Não herdei a medição de 04/09. `generations` `status='ready'` com
`qa->>'coverage_min_visto'`, desde 06/09:

```
118 entregas · 47 alunos · 22 abaixo da régua 0,85 (18,6%) · 5 abaixo do piso 0,65
```

**O pior caso não é mais 0,333.** São **três entregas com cobertura 0,0**:

| geração | quando | tlen | cobertura | exhausted | regens |
|---|---|---|---|---|---|
| `2631f5ec` | 08/09 01:28 | 380 | **0,0** | 1 | 6 |
| `b1291334` | 08/09 01:23 | 380 | **0,0** | 3 | 16 |
| `21b2d7ef` | 07/09 23:40 | 557 | **0,0** | 5 | 13 |
| `b7806399` | 06/09 16:45 | 2045 | 0,4 | 9 | 34 |

### 3.1 Conferi que esse 0,0 é entrega, não tomada descartada

Essa é exatamente a armadilha de instrumento que o campo carrega, e quase
reportei errado. `tts_qa/loop.py:151` (bloco de 26/08) registra
`coverage_min_visto` **só pelo CHAMADOR**, nos pontos de decisão de
`_gerar_todos_os_chunks`/`_resgatar_por_subdivisao` — de propósito, pra que o
chunk **jogado fora** no resgate não entre na conta. O docstring registra que em
26/08 a leitura ingênua teria acendido alarme falso em 4 de 5 casos.

Logo: **cobertura 0,0 aqui é conteúdo que o aluno recebeu**, com o QA medindo 0%
do texto pretendido dentro dele.

### 3.2 O que eu NÃO afirmo

**Não afirmo que o aluno ouviu silêncio.** A `2631f5ec` tem
`coverage_alucinado: 5` e `coverage_idioma_divergente: 1` — então 0,0 pode ser
whisper devolvendo texto completamente diferente (alucinação), não áudio mudo.
Separar as duas coisas exige **ouvir o arquivo**, e eu não ouvi. O que está
provado é que **entregamos pedaço cuja cobertura medida foi 0**.

---

## 4. O que subiu — e a prova

**PR #176** rebaseado em cima da `main` de hoje (`ac7dbb7`), sem conflito.

Suíte do worker, saída real, branch × main **no mesmo venv**:

| arquivo | main | branch |
|---|---|---|
| test_coverage_qa.py | 87 OK | 87 OK |
| test_cura_fim_telemetria.py | 14 OK | 14 OK |
| test_rate_qa.py | 17 OK | 17 OK |
| **test_refactor_smoke.py** | **33 OK** | **51 OK** |
| test_reference_word_snap.py | 25 OK | 25 OK |
| test_tail_qa.py | 37 OK | 37 OK |
| test_train_smoke.py | 41 OK | 41 OK |

Delta **+18** = exatamente os testes do PR (12 do piso + 6 do gate terminal).
Zero regressão. Merge **`c1db335`**.

---

## 5. O achado lateral: a guarda do `#15` estava morta

`test_fase_telemetria.py` **falhava**. Antes de atribuir ao PR, rodei **nos dois
lados**: falha idêntica na `main`. Não era do #176.

Causa: o **PR #209** (07/09, do `#15`) fez `_fase_post` levar o `meta` da fase
(4º posicional + campo novo no corpo) e **não atualizou o teste**. Falhava na
main desde ontem.

O que importa não é o vermelho: o arquivo que **guarda** a telemetria de fase
ficou **sem guarda** exatamente no chamado que depende dela. O `#15` está parado
esperando a próxima falha pra ler `chunk`/`attempt` — se o `meta` parasse de
viajar nesse meio tempo, ninguém seria avisado, depois de 40 dias esperando por
essa ocorrência.

**Conserto (PR #213, merge `2adb080`):** código de produção **intocado** — o
comportamento novo está certo, o teste é que estava velho. Os dois testes passam
a **afirmar** o comportamento (corpo com `meta`; tick afirmando
`meta == {"chunk": 3}`).

**Prova de que o teste não é decorativo:** removi o `meta` da chamada em
`worker_log.py:92` e rodei. Saída real:

```
ValueError: not enough values to unpack (expected 4, got 3)
FAILED (errors=1)
```

Restaurado em seguida (`git diff` do `worker_log.py` vazio). `test_fase_telemetria`
agora **13/13**.

---

## 6. O que NÃO está feito (não confundir com resolvido)

1. **O `#226` continua aberto, e fechar seria mentira.** O piso **não vale no
   gate TERMINAL** (`_resgatar_nivel_2`), de propósito: ali `False` não manda pro
   resgate, manda o job pra `failed` + estorno — a tempestade de 19/08. Então
   **um pedaço de cobertura 0 que chegue ao nível 2 continua sendo entregue
   depois deste merge.** Confirmado no teste rodando ao vivo: o log
   `inference.coverage.espalhada.piso_terminal` aparece com cobertura 0,357 /
   0,5 / 0,333 e o áudio sai assim mesmo. O PR é **estritamente melhor** que a
   main de hoje (pega os gates 1 e 2), mas **não zera a classe**.
2. **Não está em produção ainda.** Mudança de worker só vale com **imagem nova
   no ar**: o `runpod-worker.yml` faz build + aponta o template pra tag do commit
   + recicla workers nos **dois** endpoints (A `2jcta960kzc2m4`, B
   `0qd28qwo9ptcp4`). Merge na main **não é produção aqui**. Estado no fim desta
   ronda registrado no item 8.
3. **`#15` e `#222`** seguem travados pelos motivos do item 2 — não reabri, não
   redecidi.

---

## 7. Para a próxima ronda

1. **Confirmar que o build fechou `success`** e que o template aponta pra imagem
   nova. Se não fechou, o conserto do `#226` **não está no ar** e o card não
   andou.
2. Depois disso, recontar entregas abaixo de 0,65: a expectativa é que os gates
   1 e 2 zerem e **sobre só o que passa pelo gate terminal**. Esse resto é a
   medida honesta do que falta no `#226`.
3. **Decisão que não é minha, e vai pro Johnny:** entregar áudio com cobertura
   **0** é melhor ou pior que falhar o job e estornar? A casa escolheu entregar
   em 19/08 — mas escolheu quando o pior caso era 0,333. Com 0,0 na mesa o trade
   é outro.
4. `#254` (perna DIEGO) e `#304` (Emanuel) seguem como a ronda das 14h deixou:
   o primeiro espera `4UKYMN4L`/`MYEXXEMA` rolarem pra 15/09 12:00; o segundo
   precisa de decisão comercial.

---

## 8. Higiene de fim de ronda

- Código foi por **branch + PR** (#176 e #213); só este log vai direto na `main`.
- `git log --oneline origin/main..HEAD` → conferido **vazio**.
- `git rev-list main..<branch>` conferido nas duas branches → **vazio** (nada
  preso em branch).
- Worktrees de verificação (`/tmp/wt176`, `/tmp/wtmain`) removidos.
- Nada de crédito, GPU, migration, assinatura cancelada ou e-mail em massa.
- Nenhum e-mail a aluno nesta ronda: os 5 do `#306` já tinham sido alcançados
  pelo cron (item 1) e o `#226` não tem aluno esperando resposta.
