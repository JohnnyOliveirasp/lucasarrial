# Rotina das Falhas — 26/08/2026, ronda das 18h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → já em dia (`adc96cf`).
Índice de ordens lido. Ronda anterior: 17h UTC (0 fechado, trabalhou `52` e `99`).

**Placar honesto: 0 incidente fechado, 1 fix EM PRODUÇÃO (PR #61, merge `1013b20`),
1 designação de "próximo" da ronda passada retirada por medição, 1 ponto cego do
Vigia fechado com número, 1 bug de teste morto achado e conferido por mim.**

Nenhum incidente fechou porque nenhum estava resolvido. Digo abaixo, um a um, em
que passo cada um trava.

---

## 1. O serial desta ronda: `52` — avançou o INSTRUMENTO, não a causa

Digo os dois com a mesma clareza, porque a tentação aqui é vender o merge como
conserto.

**Não corrigi o defeito.** O `52` segue `investigating` e não há diagnóstico novo.
A ronda das 17h concluiu que continuar cavando no banco queima ronda — nada
registra qual ramo da `transcricao_fiel` rodou, nada registra o transcript
**antes** da cura, `training_jobs` não guarda imagem do worker, e a única régua
que temos roda em **outro motor de whisper**. Essa conclusão continua de pé e eu
não a contornei: fui fechar o buraco que a torna indecidível.

### 1.1 O que entrou em produção

**PR #61** (`feat/instrumentar-transcricao-fiel`), merge **`1013b20`** na main às
17h45Z. Autor do código: `coder` (card `484fffc3`, o card de escopo fechado que a
ronda das 17h reabriu depois do `7a20c24b` voltar vazio). **Revisor: eu.**

O que passa a dar para responder, e hoje não dava de jeito nenhum:

| antes | depois |
|---|---|
| `texto = real or previsto` — whisper **mudo** e whisper **explodindo** caíam os dois calados no texto previsto, indistinguíveis depois do fato | `transcricao_fiel()` devolve o **ramo**: `curado` / `fallback_vazio` / `fallback_erro` / `sem_previsto` |
| só o texto final era gravado | vai junto o **texto antes** da cura — dá para ver *o que* ela mudou, não só *que* rodou |
| `training_jobs` não guardava nada da imagem; "esse treino saiu de que build?" se respondia por data, no olho | `WORKER_IMAGE` carimbado pelo CI (`<branch>@<sha>`), **inclusive nos returns de erro** do treino — é na falha que se pergunta que build rodou |

### 1.2 Minhas verificações, do zero — não as que o coder reportou

- `runpod-worker/test_train_smoke.py`: **26/26 OK** na branch. Rodei a **mesma
  suíte na main**: **12/12**. A diferença não é só teste novo — ver 1.3.
- frontend: `npx tsc --noEmit` **0 erros**; `eslint` limpo nos 2 arquivos tocados;
  `node --test` da suíte inteira **100/100**.
- **A checagem que pegaria regressão, e é a razão de a revisão não ser `tsc`
  verde:** `transcricao_fiel()` mudou de devolver `str` para devolver uma
  dataclass. Grep em todo `.py`: **exatamente 2 pontos de chamada em produção**
  (`train_reference.py:111` e `:223`), os **dois** ajustados. Não há terceiro.
  `ref.transcript` segue `str` em todo lugar e `train.py:219` continua mandando
  `str` pro webhook. **Um terceiro ponto de chamada teria gravado o `repr` de um
  objeto no `reference_transcript` do aluno, em silêncio.**
- Li o comportamento linha a linha: `texto = real or previsto` é **idêntico** ao
  de antes. A decisão não mudou, só passou a ficar registrada.

### 1.3 Achado que não estava no card, conferido por mim na main

Em `test_train_smoke.py`, `unittest.main(verbosity=2)` está na **linha 267** e
`class TranscritoFielTest` começa na **270** — *depois*. Os **4 testes que guardam
justamente a cura do caso Negrini (#124) nunca rodaram**, desde que nasceram no
commit `d912809` de **24/08**. Era código morto com cara de cobertura. É por isso
que a contagem pulou de 12 para 26.

Registro isto porque é o tipo de coisa que faz a casa confiar num teste que não
existe — e o `--curar`, que corrompeu a referência do Alessandro hoje, é
exatamente a função que esses 4 testes diziam cobrir.

### 1.4 Migration 96: commitada e NÃO aplicada — e isso está MEDIDO

`scripts/96_training_jobs_cura_transcricao.sql`, 4 colunas em `training_jobs`.
**Conferido no banco agora, não presumido:** o `select` das colunas novas devolve
`42703 column training_jobs.reference_cura_ramo does not exist`.

Ou seja: **o código está em produção sem as colunas** — e isso é seguro **de
propósito**. O `UPDATE` é separado, best-effort, **depois** do gate idempotente,
dentro de `try/catch` (mesmo padrão da mig 90), e o `logger.info` roda **sempre e
antes** do banco. Enquanto a DDL não for aplicada, **o dado existe no log**, que
já é o que resolve a pergunta na próxima ronda. Coluna inexistente dentro do
claim derrubaria a finalização **inteira** do treino (voz nunca ficaria `ready`)
— por isso não está lá.

⚠️ **Aplicar a DDL precisa de aval do Johnny** (regra: nada de migration sem
aval). Pedido no grupo. Nulo nessas colunas significa *"treino anterior à mig
96"*, **não** *"a cura não rodou"*.

### 1.5 Em que passo o `52` trava

Trava em **esperar um treino NOVO passar pelo worker novo** e ler o ramo no log
(`voice.train.transcript_cura`). Só com isso as duas hipóteses — (a) worker quente
servindo imagem antiga × (b) `transcricao_fiel` com ponto cego — deixam de ser
chute. Não há trabalho técnico meu disponível antes disso.

Não escrevi pro Alessandro: as 3 falhas dele de hoje **já foram estornadas**
(conferido por `ref_type='generation_refund'`, nunca por `kind`) e ele produziu
com sucesso às 15h56.

---

## 2. Retiro a designação de "próximo" que eu mesmo escrevi às 17h

O log das 17h marcou `leandro.fitoway@gmail.com` como o próximo do serial (*"sem
voz há 27 dias, acesso vence 29/08, o relógio mais curto da lista"*). Fui conferir
o estado atual **antes** de agir — passo (1) da rotina, "já resolveu sozinho?" — e
o caso **não estava largado**.

**Ele já foi respondido, e bem.** Sent uid 67, **25/08 00:47Z — há ~41h**, não há 5
dias. O e-mail assume a culpa da casa, dá os números medidos (6 de 14 arquivos,
9min35s dos quais 9min21s de fala limpa, projeção ~22min), explica as **duas**
réguas corretamente (20min de áudio somado na porta + 10min de fala limpa que o
treino consome) e pede mirar em 25min para não passar raspando. **Não cai na
armadilha da ordem de 21/08** — a mensagem antiga dizia "mínimo 10min" e o portão
real é `MIN_DURATION_SECONDS = 20*60`.

Regra 8 é explícita: **esperar resposta de aluno não é estar travado.** 41h não
pede segunda tentativa; o gatilho da varredura é 7d+.

**Dado novo que muda o enquadramento:** `pagou_de_verdade.cjs` diz **NUNCA PAGOU**
— rec#1 R$0 COMPLETE 29/07 (trial) e rec#2 **R$97 OVERDUE** (a cobrança existe e
não foi paga). Ele não é pagante travado, é trial com cobrança vencida. Isso não
muda o atendimento (o defeito do upload foi nosso e o e-mail está certo do jeito
que está), mas muda a leitura de urgência: *"acesso vence 29/08"* não é pagante
prestes a perder o que comprou. E vencer **não tranca porta nenhuma** — medido
pelo Vigia em 25/08 no próprio código (entrada livre no layout; `canTrain` por
**crédito**, não por acesso), e ele tem 97.620 créditos contra os 10.000 do treino.

**Conferi o vizinho pelo mesmo critério, para não errar duas vezes:**
`marcelopersonalthe32@gmail.com` (16 dias sem voz, do `#65`) também já foi
respondido — Sent uid 58, **24/08 21:52Z, há ~44h**, e-mail que assume a falha de
disco do dia 10, confirma o estorno dos 10.000 e explica que o arquivo dele é uma
**entrevista** com mais de uma pessoa falando. Esse **pagou de verdade** (R$97
COMPLETE 12/08). Bola com ele também.

**Conclusão para quem pegar a próxima ronda:** dos 4 presos no painel, os 2 mais
antigos estão com o aluno há ~41h e ~44h com e-mail medido e correto; os outros 2
(`ycarlosk` 2d, `definidameta` 1d) são recentes e já anotados no `#139`. **Nenhum
dos 4 é trabalho nosso parado.** Não repitam a designação de "próximo" sem antes
ler o Sent — eu quase gastei a ronda escrevendo um segundo e-mail que teria sido
ruído em cima de um e-mail bom de 41h.

---

## 3. `143` — fechei o ponto cego do Vigia com número

O Vigia registrou a limitação dele com todas as letras às 16h: *"não consegui ler
o agendador desta sessão... a janela `40 6-21` / `10 6-21/2` citada na ronda das
14h eu **não reconferi hoje** — reporto como herdada, não como medida."* Fui ler o
agendador, que é o que eu tenho e ele não tinha.

| rotina | cron lido | janela morta |
|---|---|---|
| `1845e899` Rotina das Falhas | `40 6-21 * * *` | 21h40 → 06h40 local = **9h** |
| `9cac28fe` Vigia | `10 6-21/2 * * *` | 20h10 → 06h10 local = **10h** |

Confere com o rastro no disco: os logs de hoje são vigia 00h/10h/12h/14h/16h UTC —
exatamente esse desenho, com o buraco entre 00h10 e 10h10 UTC. **A afirmação do
chamado está correta** e o número de 9h para a fila está certo.

Então o `143` **não precisa mais de investigação — precisa de uma linha de
decisão.** Ou o cron vira `40 * * * *` (fila) e `10 */2 * * *` (vigia), ou a ordem
de 20/08 precisa ser corrigida para dizer que o turno é 6h–21h mesmo. Hoje **o
repositório afirma uma coisa e a máquina faz outra**, e foi nessa contradição que
a bola da Luziélia ficou 7h45 parada.

**Não mexi no cron.** Mudar agendamento não é triagem: muda o custo da operação e
o comportamento noturno da casa, e a ordem de 20/08 é do Johnny.

**Correção de registro, de passagem:** a ordem de 21/08 afirma que `1845e899` e
`9cac28fe` estavam **pausadas**. Elas **não estão** — as duas rodaram hoje
(últimas execuções 12h54 e 12h16 local). Foram retomadas depois daquela ordem e
ninguém registrou. Quem ler aquela ordem hoje conclui que a fila está sem rotina
automática, e conclui errado.

---

## 4. Os outros dois abertos: travados em decisão que não é minha

- **`97`** (video clone, drift de rosto) — os 3 afetados já foram **estornados e
  respondidos**; o drift é limitação do InfiniteTalk medida nos 2 tiers. O passo
  que falta é decisão de produto do Johnny, formulada em 24/08 e repetida em
  25/08 e 26/08 — **~53h sem resposta**. Não há trabalho técnico disponível. Não
  toquei.
- **`99`** (Luciano) — escalado às 17h com a premissa corrigida (`message_id`
  460); ele foi cobrado R$97 hoje às 14h11Z e a ordem do Johnny de 25/08 foi
  tomada sobre premissa que caiu. Aluno já avisado na ronda das 17h. Decisão
  comercial pendente. Não toquei.

---

## 5. Fila conferida no fim

- **Abertos: 4** (`52`, `97`, `99`, `143`) — mesmo número da entrada.
- **`aguardando_aluno`: 7** — inalterado.
- **Presos no painel: 4** — todos com dono e prazo conferidos (seção 2).
- Notas gravadas nesta ronda: `52` (31 notas), `72` (28), `143` (2). Todas com
  `.select()` conferido na volta, **1 linha afetada** cada.

---

## 6. Placar, sem inflar

- **1 fix em produção**: PR #61, merge `1013b20`, deploy disparado no mesmo push
  (Deploy Frontend + Build RunPod Worker; o path filter `runpod-worker/**` casou).
- **0 incidente fechado** — nada estava resolvido e eu não fecho o que não resolvi.
- **1 designação de "próximo" retirada** (minha, da ronda passada) com a medição
  que a derruba.
- **1 ponto cego do Vigia fechado** com cron lido, não herdado.
- **1 bug de teste morto** achado pelo coder e **conferido por mim na main**: 4
  testes do #124 nunca rodaram em 2 dias.
- **1 migration commitada e NÃO aplicada**, com a ausência da coluna **medida no
  banco** (`42703`) em vez de presumida.
- **0 aluno escrito** (os 2 candidatos já tinham e-mail de ~41h/~44h — escrever
  seria ruído).
- **0 crédito, 0 GPU, 0 migration aplicada, 0 voz curada, 0 whisper.**

---

## 7. O que está na mão do Johnny (3 linhas, nenhuma é investigação)

1. **Aplicar a migration 96?** O código já está em produção e é seguro sem ela
   (o dado cai no log). Aplicar só liga a persistência.
2. **`143`**: liga o turno de 24h (`40 * * * *` / `10 */2 * * *`) ou corrige a
   ordem de 20/08? Hoje repositório e máquina se contradizem.
3. **`97`**: limita/segmenta a geração longa ou segue só avisando na UI?
   ~53h esperando.
