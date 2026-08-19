# Triagem da fila — 19/08 ~01:35 UTC

Pedido: triagem dos incidentes do mais antigo pro mais novo, varredura de
travados, alunos pagantes parados. Tudo abaixo foi **medido agora**. Onde a
medição contradisse a minha própria hipótese, vale a medição — e eu digo qual
hipótese caiu.

Scripts em `_Bugs/` (fora do git): `pagante_parado.cjs`, `vozes_travadas.cjs`,
`quem_esta_parado.cjs`, `timeout_prova.cjs`, `elapsed_pop.cjs`,
`nunca_comecaram.cjs`, `probe_schema.cjs`.

---

## 1. Varredura de travados — 0, e o zero é confiável

`varredura_travados.cjs`: **0 itens presos** em 6 tabelas. Nenhuma linha
`⚠️ tabela: erro` foi impressa, então o zero é do script, não meu.

Conferi a contagem exata por status em `voices` (com `count: exact`, imune ao
teto de 1000 linhas do PostgREST):

| status | linhas |
|---|---|
| ready | 689 |
| failed | 51 |
| awaiting_training | 24 |
| rejected_too_short | 24 |
| uploading / validating / training | **0 / 0 / 0** |
| TOTAL | 788 |

### Hipótese minha que CAIU

Vi `uploading=0, validating=0, training=0` e achei que a varredura estivesse
vigiando status mortos — que seria a explicação bonita pro "0 travados" de
sempre. **Está errado.** Fui no código: `start-training/route.ts` grava
`status: "training"` (linhas 136 e 270) e `uploads-complete/route.ts` grava
`validating` e `uploading`. Os três são status vivos e usados. Estão zerados
agora porque **não há nada treinando às 01:35 da manhã** — e porque o
`rescue-stuck-uploads` limpa `uploading` a cada 5 min, que é ele funcionando.

Não reportei o alarme falso. Fica registrado porque a próxima pessoa vai olhar
essa tabela e ter a mesma ideia.

---

## 2. Aluno pagante parado — 0 travados de verdade

Régua do `03_ROTINA.md` §3: acesso ativo + crédito no bolso + nenhuma voz
pronta, há mais de 2 dias.

Primeira passada deu **160 pessoas** e quase virou manchete. Não é. Ao cruzar
com as vozes *prontas* de cada um, o número real de **pagante parado é 0**.

As 24 vozes em `awaiting_training` (a única fila que a varredura não olha)
se explicam assim:

| grupo | qtd | é travamento? |
|---|---|---|
| acesso ativo, mas **já tem voz pronta** | 11 | **não** — é 2ª voz abandonada no meio |
| sem acesso ativo | 13 | não |
| acesso ativo + crédito + **0 voz pronta** | **0** | — |

E `awaiting_training` **não é fila de sistema**: o comentário do
`rescue-stuck-uploads.ts` é explícito — *"NÃO dispara treino e NÃO cobra — quem
decide treinar é o aluno, clicando"*. `runpod_job_id` = NÃO nas 24, como manda
o desenho. Ninguém está esperando a gente.

---

## 3. O achado que sobrou: 81 pagantes que nunca começaram

Esse é o número que interessa, e a varredura nunca ia achar — ela só olha
estado intermediário, e essa gente **não tem estado nenhum**.

```
perfis com acesso ativo (conta > 2d) ......... 515
  └ com crédito ............................... 502
     └ NUNCA criaram nenhuma voz .............. 154
        ├ PAGARAM de verdade .................. 81   ← aqui
        └ sem compra aprovada (trial/cortesia) . 73
```

"Pagou de verdade" = tem `PURCHASE_APPROVED` com `price.value > 0` no nosso
`payment_events`. É a 2ª fonte do `pagou_de_verdade.cjs`, consultada no nosso
banco pra não bater 154 vezes na Hotmart. **Não usei `access_until` como prova
de pagamento** (regra 9: acesso ativo ≠ pagou) nem `ja_pagou` (o backfill nunca
rodou — 0 `true` em 1.244 perfis, está inerte).

Ressalva honesta: dos 81, **4 são de casa** — `jmo.usa.007`, `johnny.optimal`,
`johnny.milum001` (contas do Johnny) e `lucasarrial@gmail.com` (o Lucas).
Sobram **~77 alunos reais**. Os mais antigos:

| dias parado | e-mail | crédito |
|---|---|---|
| 49d | kettycruz@hotmail.com | 99.770 |
| 42d | j_a_simoes@hotmail.com | 100.000 |
| 42d | ryanmaciel@flyliberty.com.br | 100.000 |
| 41d | marcelotaua@gmail.com | 100.000 |
| 41d | vendas@imobiliariaempirassununga.com.br | 189.425 |

Pagaram, têm crédito parado, e em até 49 dias nunca subiram um áudio. Não é bug
— é ativação. **Não mandei e-mail**: e-mail em massa com conteúdo novo pra mais
de ~10 pessoas precisa da palavra do Johnny (`06_RELATORIO_E_LIMITES.md`).

---

## 4. Incidente `d3d8d1b2` — 19 dias, segue `investigating`, agora com teste decisivo

Único aberto. "Geração de áudio: tempo de execução estourado", 13 ocorrências,
12 alunos afetados, desde 30/07. Última: 18/08 20:46 — **4h44 limpas**.

Medi o que faltava. A coluna `elapsed_seconds` **nunca foi preenchida no
caminho de falha**, desde sempre:

| status (desde 22/05) | com elapsed | sem elapsed |
|---|---|---|
| ready | 2.303 | 625 (~21%) |
| **failed** | **0** | **30** |

13 de 13 falhas de `executionTimeout` com `elapsed_seconds = null`.

**Isso não é regressão.** O commit `1c09508` ("guarda o tempo de execução do
RunPod quando o job falha") é de 18/08 18:10 -0400 = **22:10 UTC**. As duas
ocorrências de 18/08 (18:05 e 20:46 UTC) são **anteriores** a ele. O fix está no
bundle mas **ainda não foi exercitado** — não houve falha de timeout depois que
subiu.

### O teste que fecha o incidente sem migration 82 e sem gastar GPU

Na próxima ocorrência, os três desfechos são distinguíveis:

- `elapsed` preenchido e **≈ o teto** (`trainExecutionTimeoutMs`) → o job rodou
  e estourou de verdade: é capacidade, cabe mexer no teto.
- `elapsed` preenchido e **muito menor que o teto** → confirma cold start / job
  que nunca executou.
- `elapsed` **ainda null** → aí o `1c09508` não funciona nesse caminho e o bug
  é nosso, no handler da falha.

Gravei isso como nota 23 no incidente. **Status inalterado** (`investigating`),
porque pela regra 14 não se marca `fixed` sem ter resolvido.

---

## 5. Produção

`pm2 aiverse` **online**, 305 MB, CPU 0, `unstable_restarts: 0`. Reiniciou
01:27:40 UTC — bate com o deploy do build das 01:14, não é crash loop (os 255
restarts são acumulados de meses de deploy).

Sweep **vivo**, de 5 em 5 min, último 01:30:02. O zerador de trial segue
**desligado dentro da função do banco** — verificado no log, não na nota.

⚠️ Continua logando `expiração de trial FALHOU` a cada 5 min (~288/dia). É a
trava funcionando, registrada como falha. Já estava anotado na rodada anterior;
mantenho o registro porque alarme constante que é normal treina a gente a
ignorar o log.

Ruído novo, **não é nosso**: `Cannot read properties of undefined (reading
'M_ID')` chegando de minuto em minuto no `/app/videos/clone`. A stack é
`chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon` — extensão no navegador
do próprio aluno. Nosso logger de erro de cliente está capturando barulho de
extensão. Cosmético, não afeta ninguém.

---

## 6. O que eu mexi

Uma coisa só: **nota 23 no incidente `d3d8d1b2`**. Nada de crédito, nada de
GPU, nada de e-mail, nada apagado, nenhuma migration. Todo o resto foi leitura.
