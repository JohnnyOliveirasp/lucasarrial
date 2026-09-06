# Ronda das falhas — 05/09/2026 ~12:41–13:00Z (Frank, dono da fila)

⚠️ **RONDA INTERROMPIDA POR FALHA DE AMBIENTE, NÃO POR CONCLUSÃO.** O shell
morreu no meio (detalhe na seção 5). O que está escrito abaixo até a seção 4 foi
medido e gravado ANTES da queda; a partir dali eu não consegui mais executar nada.
Este arquivo pode estar **não commitado** — ver seção 5.

Fila no início: **28 não-fechados** (contados por `status NOT IN
('fixed','ignored')`, a correção que o Vigia pediu às 12hZ — a lista positiva do
texto do cron esconde os 13 `aguardando_aluno`).

---

## 1. Solon — o item nº1 da lista da ronda anterior CAIU, e não fui eu

Peguei pela regra 8: era o único com dinheiro sendo cobrado errado dentro de 24h.

A fila tinha um card novo de **12:30:17Z, 11 minutos antes desta ronda**:
`bff5cb47` (#262) — *"Solon confirmou por e-mail que quer cancelar"*.

**Cronologia medida (não inferida):**

| quando | o quê | prova |
|---|---|---|
| 12:24:34Z | Solon responde: *"favor cancelar assinatura referente a esse e-mail"* | INBOX uid 445, **DE** `solonandrade03` |
| 12:30:11Z | a Fast responde a ele prometendo encaminhar | Sent uid 1066 |
| 12:30:17Z | card #262 aberto | `incidents` |
| 12:38:43Z | Hotmart registra o cancelamento | `raw_event.cancellation_date` |
| 12:38:45Z | webhook grava no nosso banco | `entitlements.updated_at` |

**A ambiguidade eu resolvi antes de agir, não depois.** *"Esse e-mail"* é ambíguo
e cancelamento não tem desfazer. Conferi de qual caixa ele escreveu: veio **de**
`solonandrade03` — a conta nunca usada — respondendo à pergunta que **nomeava as
duas contas**. As duas leituras possíveis convergem na mesma conta. A caixa de
`lscontabilidade813` está **vazia** (zero mensagens): não havia pedido concorrente.

**Estado conferido no banco** (`cancelar_assinatura.cjs` em **ENSAIO** — nada foi
enviado por mim):

- `solonandrade03` / POTX6UYJ: **canceled**, CANCELLED_BY_SELLER, acesso até 06/09
  12:00Z, **200.000 cr intocados**.
- `lscontabilidade813` / IJA1SHDQ: **ACTIVE** até 13/09, 88.025 cr — **a conta
  certa ficou de pé**. Confirmado que não cancelamos a errada.

**As 4 escalações anteriores estavam CERTAS.** `raw_event.date_next_charge` =
`1788696000000` = **06/09 12:00:00Z exato**. A cobrança era real; não foi alarme
falso. O relógio parou a ~23h do débito.

⚠️ **Duas coisas que eu NÃO afirmo:**
1. **Não fui eu que cancelei** e **não consigo atribuir quem foi** (entrou pelo
   lado *seller*: Johnny ou outro agente). Registro como fato medido, não como
   entrega minha.
2. Provei que a assinatura está **cancelada na Hotmart**; **não** provei que a
   Hotmart não vai disparar a cobrança. A prova definitiva é **06/09 12:00Z**,
   quando nenhum evento de compra chegar. Deixei como checagem objetiva.

**Não escrevi para ele, de propósito:** a Fast já respondeu 12:30:11Z. Segunda
mensagem em 10 minutos seria reproduzir à mão o `#259` — o defeito que machucou
a Katia.

**Não fechei o #262.** Metade continua aberta: o R$97 já cobrado em 13/08
(HP3690808585, COMPLETE). Fora da minha alçada por **dois caminhos independentes**:
(a) 9-C manda reembolso para a Hotmart; (b) mover os 200.000 cr parados seria
**10× o teto de 20.000/caso** da 9-B, que manda parar e chamar. É a **mesma
decisão** do Jackson (`b229e491`, R$97 em dobro, proposta parada desde 04/09
21:19Z) — uma pergunta, não duas.

## 2. `#254` (`f1ada07e`) — corrigi o título que virou mentira

O card diz *"SOLON é cobrado de novo em 06/09 12h"*. Falso desde 12:38:43Z.
Anotado (9 notas). **Não fechei**: ele cobre 5 alunos e só a perna do Solon caiu.
Seguem de pé Jackson e Carlos Augusto (R$194/ciclo, próximo débito 22/09,
lembrete previsto para 07/09). Não remedi os outros — a regra 8 manda levar **um**
até o fim, e o meu era o Solon.

## 3. `#261` (`ab485826`) — peguei, e parei no primeiro passo

Próximo item pela regra 8 (aluno esperando antes da limpeza da fila): Gleide,
**pagante do SGP**, escreveu 04/09 16:06Z e está **~20h sem resposta**.

Confirmei o sintoma do Vigia por leitura independente: uid 436, 7KB,
`--corpo 8000` → **`(sem corpo em texto)`**. Mensagem de 7KB não está vazia de
verdade, então o corpo se perde na leitura, como o card descreve
(`mail-respond.ts:67-69` escolhe o `text/plain` por presença de cabeçalho, nunca
por conteúdo, e nunca cai pro `text/html`).

O Vigia pediu: **dumpar o BODYSTRUCTURE do uid 436 antes de mexer no `mailText`**.
Escrevi o dump só-leitura (espelhando as 3 travas do `ler_caixa`: `BODY.PEEK[]`
sempre, `EXAMINE`, zero STORE/EXPUNGE/MOVE/DELETE, mais tripwire) — **e foi
exatamente aí que o ambiente caiu. O dump NÃO chegou a rodar.**

**A aluna continua sem resposta.** Não escrevi para ela porque não sei o que ela
escreveu — responder sem ler seria chutar. Este é o item mais urgente da fila.

## 4. O que eu NÃO fiz

Não fechei incidente, não reabri, não mexi em crédito, não estornei, **não
cancelei assinatura** (rodei só o ENSAIO), não gastei GPU, não apliquei migration,
não mergeei PR, não escrevi para aluno, e não toquei em nada da planilha.

## 5. ⚠️ A FALHA DE AMBIENTE — e o que ficou por conferir

Ao tentar criar a branch para o dump do `#261`, o shell começou a devolver saída
vazia com exit 1 em **qualquer** comando, inclusive `echo ping` e `date`. Testei
três vezes, com intervalo. Não é o meu comando: é a ferramenta.

Antes disso houve dois sintomas menores: `/tmp` recusou escrita com **EDQUOT**
(tmpfs de 16G com **12G ocupados**, 77%) e escrita fora do repo foi bloqueada.

**O que isso deixou por fazer, e é obrigação declarar:**

1. 🔴 **O passo fixo de fim de ronda NÃO foi executado.** Não rodei
   `git fetch origin && git log --oneline origin/main..HEAD`, nem `git branch`,
   nem `git rev-list`. **Não posso afirmar que nada ficou preso fora da main.**
2. 🔴 **Não sei em que branch o repositório está.** O comando
   `git status --porcelain && git checkout -b fix/261-corpo-vazio` foi enviado e
   voltou vazio/exit 1. Se a árvore estava limpa, o `checkout -b` **rodou** e o
   repo pode estar em **`fix/261-corpo-vazio`**. Quem pegar a próxima ronda:
   **confira o branch ANTES de qualquer coisa** e traga este log para a **main**
   se ele estiver preso — é a armadilha de 19/08, e desta vez ela pode ter sido
   armada por mim.
3. 🔴 **Este arquivo provavelmente NÃO está commitado** (o commit precisa do shell).
4. 🔴 **O relatório consolidado da ronda NÃO foi ao grupo.** O
   `notify-grupo.sh` precisa do shell.

**O que SAIU com sucesso, antes da queda:** o aviso do Solon no **grupo** (via
`notify-grupo.sh`, ordem de canal de 31/08) — com o cancelamento confirmado, a
cobrança de amanhã evitada, a ressalva de que não fui eu quem cancelou, e a
decisão do R$97 (Solon + Jackson) escalada como uma coisa só. **Nada foi para o
privado do Johnny.**

## Próxima ronda começa por aqui

0. **Conferir o branch e o estado do git** (seção 5, itens 1–3). Antes de tudo.
1. **`#261` / Gleide** — pagante, agora **>20h sem resposta**. Dumpar o
   BODYSTRUCTURE do uid 436, ler o que ela escreveu, **responder**. É o item mais
   urgente e não avançou nesta ronda.
2. **Solon** — às 06/09 12:00Z, confirmar que **nenhum evento de compra** chegou.
   Isso fecha a perna dele do `#254` com prova, não com expectativa.
3. **R$97 em dobro (Solon + Jackson)** — decisão do Johnny, escalada no grupo.
4. **Migration 82** — segue não aplicada; o `#15` continua cego. Aval do Johnny.
5. **Diego:** 08/09, R$194, ainda evitável.
6. **Katia (`#47`)** — bola com ela desde 11:32Z de ontem.

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início (repo já
estava em `main`, up to date). Leitura da caixa toda com `EXAMINE` +
`BODY.PEEK` — nenhuma flag alterada, nenhum e-mail marcado como lido.
`cancelar_assinatura.cjs` rodado **só em ensaio**, nas duas contas. Notas
gravadas via `anotar_incidente.cjs` (concatena, nunca sobrescreve; releitura
confirmou 1 linha afetada em cada). Nada da planilha foi lido, classificado ou
reaberto (ordem de 29/08). Comunicação no **grupo** (ordem de 31/08).
**Fim de ronda NÃO conferido — ver seção 5.**
