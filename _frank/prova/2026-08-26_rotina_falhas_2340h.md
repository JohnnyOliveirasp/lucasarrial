# Rotina das Falhas — 26/08/2026, ronda das 23h40 UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → `origin/main`
em `349525b`. Índice de ordens lido. Ronda anterior: **23h UTC**.

**Placar honesto: 1 fix em PRODUÇÃO (incidente 146, Parte A — PR #65, merge
`def14fb`, deploy SUCCESS), 0 incidente fechado, 0 e-mail pra aluno, 0 crédito
devolvido (não havia o que devolver). O `#146` continua `investigating` de
propósito: subiu a metade que para de mentir pro aluno, não subiu a metade que
destranca a porta — essa cobra crédito e está com o Johnny.**

**O achado que mais vale desta ronda não é o fix: é que ele NÃO ESTAVA EM
PRODUÇÃO, apesar do card `completed` e do PR aberto.** Detalhe na §3.

---

## 1. O serial: `#146` (`e4d8b6ce`), e por que não peguei o mais antigo

A regra 8 manda pegar o mais antigo com aluno afetado. Medi os cinco mais
velhos antes de escolher, e todos estão bloqueados em coisa que não é trabalho
técnico meu:

| # | idade | por que não é o serial |
|---|---|---|
| `#52` | 19/08 | sem aluno esperando e sem crédito devido (medido na ronda das 22h). Depende do **PR #63, ainda aberto** |
| `#97` | 23/08 | drift de rosto: **não há correção técnica possível hoje**, alunos já respondidos, entregue ao time em 24/08 |
| `#99` | 23/08 | Luciano. Espera **posicionamento do Lucas/Johnny**, não conserto. Ele já foi respondido 5× (última 26/08 20h51) |
| `#120` | 24/08 | pré-venda da Sandra: depende dos Termos, que estão **em rascunho** |
| `#143` | 26/08 | turno da noite: espera a linha do Johnny |

O `#146` era o único aberto **diagnosticável e consertável hoje** — a ronda das
23h deixou a causa localizada na linha e um card entregue. Peguei esse.

## 2. O que subiu, e o que deliberadamente NÃO subiu

**Parte A — em produção.** `import/route.ts`: `audioCurto` passa a exigir
`imported > 0`. Um run que não mediu nada não afirma nada ao aluno sobre
duração. O veredito herdado vira motivo honesto e vai **só pro grupo**; a linha
continua sendo erro na planilha, porque ela está parada de verdade. O que para é
a **repetição do e-mail**: 16 recusas duplicadas medidas (robson 3×, itabenke
3×, isabella 3×, adrianomarques 2×, aleciotenório 2×, kelinnavelar 2× — esta
levou recusa de **áudio** por causa de uma **foto**).

Casos legítimos preservados: `imported>0` + `rejected_too_short` continua
avisando; `imported+skipped=0` continua avisando. **A régua não mudou** —
`MIN_TOTAL_SECONDS` e `estimateSpeechSeconds` intactos. O objetivo é o portão
**rodar**, não afrouxar.

**Parte B — NÃO subiu, e essa é a decisão da ronda.** Ela reabre a importação
quando chega `fileId` novo — é o que destranca a porta. Só que o caminho termina
em `tentarTreino` → `dispararTreinoOnboarding` → `debitCreditsOnboarding`, que
debita `TRAINING_CREDIT_COST` **sem trava de saldo** (o aluno fica negativo). Os
**5 alunos hoje parados** em `rejected_too_short` **nunca pagaram** (conferido
com `pagou_de_verdade.cjs`).

A ronda das 23h já tinha escalado isso ao Johnny (Telegram msg 474) e a resposta
não saiu. **Conferi antes de decidir**: `--espiar` vazio e `--ler --tudo` com
última entrada de **21/08** — não há registro de "pode". Reverter em silêncio uma
escalação que envolve dinheiro de aluno não é decisão de ronda. Perguntado de
novo, msg **475**, separado do relatório.

## 3. O achado de processo: o fix estava fora do ar, e o board dizia o contrário

O card `93f56e4d` estava **completed**, o PR **#64 aberto**, e a ronda das 23h
registrou `origin/main..HEAD` **vazio**. Mesmo assim:

- o commit do fix (`0abaeb0`) estava **só na main LOCAL**, não empurrado;
- `origin/main` estava em `349525b` — **o código não estava em produção**;
- o mesmo commit estava salvo no origin, mas **dentro do branch do PR #64**.

É exatamente a armadilha que a ordem manda checar no fim de ronda ("card
`completed` não significa em produção", "fix preso em branch") — e ela passou
pela verificação da ronda anterior. Desfeito: main local resetada pra
`origin/main` (nada se perdeu, o conteúdo estava no origin), e a Parte A subiu
pelo caminho certo — branch `feat/inc146-parte-a` → PR #65 → merge na main.

**Lição pra próxima ronda:** `git log origin/main..HEAD` vazio **não** prova que
o fix está no ar. Ele sai vazio tanto quando não há nada pendente quanto quando
alguém commitou depois da checagem. A pergunta que prova é `git branch -r
--contains <sha>` — se `origin/main` não aparece na lista, não está em produção.

**PR #64 ficou aberto e comentado.** Não pode ser mergeado como está:
`veredito-audio.ts` e os 18 testes já entraram na main pelo #65, então ele
precisa de rebase pra sobrar só o diff de `import.ts`. Ele é o veículo da Parte B
quando o Johnny liberar.

## 4. O que eu conferi com a minha mão, e não herdei do PR

O PR afirmava os números. Rodei tudo de novo na **minha** branch (a que exclui a
Parte B), porque teste que não roda passa em silêncio:

- `veredito-audio.test.ts`: **18 pass / 0 fail**.
- Suite `src/lib`: **100 na main → 118 na branch**, 118 pass / 0 fail. Contagem
  medida **nas duas pontas** — é isso que prova que os 18 aparecem.
- `tsc --noEmit`: exit 0. `eslint` nos 3 arquivos: 0 erros.
- Li a lógica antes de mergear. `audioCurto = curto && imported > 0` está certo:
  só quem mediu pode falar de duração.
- Deploy conferido no run, não presumido: `Deploy Frontend (production)`
  `33024589319` → **SUCCESS** em `def14fb`.

## 5. Dois falsos alarmes que eu quase reportei — e a medição que derrubou

**(a) "O e-mail do Luciano saiu com o texto embaralhado".** O último e-mail pra
ele (26/08 20h51) aparece na pasta de enviados cheio de `Voc&ecirc;`,
`n&atilde;o`. Parecia regressão do bug de acentos de 25/08 — e no caso mais
sensível que existe hoje. **Não é.** O `enviar_email.cjs` manda
`Content-Type: text/html` + base64; entidade HTML **renderiza certo** no cliente
do aluno. Quem não decodifica é o **meu leitor** (`ler_caixa.cjs` tira as tags e
deixa a entidade crua). O aluno leu certo.
⚠️ Fica o registro: auditar "o que o aluno recebeu" pela pasta de enviados
**engana**. Foi a um passo de virar incidente falso.

**(b) A `telma@centia.com.br` como "pagante travada".** A varredura a mostra no
bloco 🚨 (acesso vivo, 58.775 créditos, nenhuma voz pronta, acesso vencendo em
27/08 — amanhã), com 60min de áudio parados em `awaiting_training`. Parecia o
caso urgente da noite. **`pagou_de_verdade.cjs`: NUNCA PAGOU** — assinatura R$0
APPROVED, que é trial. `awaiting_training` também não é travamento nosso: a voz
espera o aluno **clicar** (há registro de gente parada 43 dias aí).
Escrever pra ela seria empurrar trial a gastar crédito — decisão comercial, não
minha, e ela cai na REGRA FINAL DE CRÉDITO de 20/08. **Não escrevi.** A própria
varredura avisa: "acesso vivo ≠ pagou".

## 6. Por que não escrevi pra aluno nenhum nesta ronda

Por medição, não por esquecimento:

- **ycarlosk** e **rafaelleitemacedo** (os 2 com material novo recusado sem ser
  olhado): já têm voz pronta e estão gerando. Não estão parados.
- **Os 5 em `rejected_too_short`** (adrianomarques, robson, kelinnavelar,
  isabella.abasup, definidameta): **nunca pagaram**. REGRA FINAL DE CRÉDITO de
  20/08, assunto encerrado.
- **Os 6 que levaram e-mail duplicado**: escrever pros seis é **e-mail em
  MASSA** pra trial churnado — precisa do "pode" do Johnny (regra 8) e é decisão
  comercial. Perguntado na msg 475.
- **Luciano** (`#99`): respondido 5× e a última foi hoje 20h51. O que falta é o
  posicionamento do Lucas/Johnny. Mandar mais um e-mail meu seria ruído.

## 7. Higiene do fim

- `git fetch origin && git log --oneline origin/main..HEAD` → **vazio**.
- `git branch -r --contains def14fb` → **inclui `origin/main`**. Está no ar.
- Nenhum fix meu preso em branch: `feat/inc146-parte-a` foi mergeada e apagada.
- PR #64 aberto **de propósito** (Parte B, aguardando Johnny), comentado.
- Sem migration nesta ronda — nada de DDL, então nada de coluna pra conferir.
- Grupo avisado (regra 7, fato consumado): fix em produção. Não postei ronda
  vazia nem progresso parcial.

## 8. Para quem pegar a próxima ronda

- **`#146` fecha quando a Parte B subir.** Se o Johnny liberar: rebase do PR #64
  em cima da main e o diff vira só `import.ts` — a lógica pura já está na main
  com os 18 testes. Se não liberar, o incidente fica aberto e honesto.
- **Não confie em `origin/main..HEAD` vazio** pra afirmar que algo está em
  produção. Use `git branch -r --contains <sha>` (§3).
- **Não audite e-mail de aluno pela pasta de enviados** sem lembrar que o leitor
  não decodifica entidade HTML (§5a).
- **Continua valendo da ronda das 23h:** não gaste tempo com timeout de 90s,
  `MAX_FILES` ou stderr do ffmpeg no `speech-estimate.ts` — refutado no código.
- **Fila que pede segunda tentativa:** `#47` (7 dias), `#65` (6 dias, Marcelo é
  **pagante** parado desde 10/08), `#72` (5 dias, leandro.fitoway está sem voz há
  **27 dias** e o acesso dele vence em 29/08). Os dois são `aguardando_aluno`,
  mas a varredura avisa que 7d+ sem resposta pede segunda tentativa, não silêncio.
- **`#137`** (voz pronta pra treinar e nunca treinada, 12 alunos) está `fixed` de
  25/08, e a Telma caiu no mesmo estado em 26/08. Vale conferir se o conserto
  cobre caso novo ou só curou os 12 de então.
