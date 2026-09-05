# Ronda das falhas — 05/09/2026 ~11:40–12:10Z (Frank, dono da fila)

Fila no início: **15 abertos**, 12 aguardando aluno, 3 presos. A ronda das 02hZ
deixou 4 itens numerados. Fiz o 1 e o 2; o 2 abriu o achado do dia e o 3/4
seguem com o Johnny.

**Não fechei nenhum incidente nesta ronda.** O backlog não baixou, e o motivo
está escrito abaixo caso a caso — não é maquiagem.

---

## 1. Solon — silêncio confirmado, agora a **24h** do débito

Item 1 da lista da ronda anterior. Conferi as **duas** caixas dele:
`ler_caixa.cjs --de lscontabilidade813@gmail.com` e `--de
solonandrade03@gmail.com` → **"nada encontrado"** nas duas. Ele não respondeu.

A ronda das 02hZ já tinha consertado o erro de endereço (escreveu para a caixa
que ele usa de verdade, Sent uid 1047). Portanto **não é mais silêncio nosso**:
a pergunta chegou onde ele lê e ficou sem resposta.

Estado: R$97 indevidos entram em **06/09 12:00Z**, daqui a ~24h. É o **4º**
pedido de decisão sem resposta (grupo ~20hZ de 04/09, depois 22hZ, 00hZ, 10hZ).
Cancelar assinatura é ação de dinheiro e para o mundo externo — **não é alçada
de agente**, a 9-C não me autoriza sozinho. Postado no grupo como urgente.

**Não fiz nada além de medir**, de propósito: não cancelei, não estornei, não
escrevi de novo (escrever pela 2ª vez em 10h seria repetir à mão o `#259`).

## 2. `setup_s` — o PR #184 está PROVADO, e o worker FOI redeployado

Repeti a consulta com o corte pedido (`2026-09-05T00:52:38Z`) e o critério de
leitura que a ronda das 02hZ deixou escrito. **7 gerações após o corte, 6 com
`setup_s` preenchido** → pelo critério dela, *"linha com `setup_s` preenchido =
PR #184 provado"*. Provado.

**De brinde, uma pergunta que estava aberta há 3 rondas caiu:** `setup_s` é
produzido por `runpod-worker/jobs/inference.py:138`. Se ele chega ao banco, a
**imagem do worker foi reconstruída**. As rondas de 00hZ, 02hZ e 10hZ
registraram *"continuo sem confirmar se o worker foi redeployado"* (commit
`2bd3c3f`). Está confirmado, por consequência e não por suposição.

Valores medidos: **12,32 · 9,17 · 14,42 · 11,09 · 9,31 · 74,18 s**.

## 3. O achado do dia: o instrumento do `#15` **nunca foi ligado**

Peguei o `#15` (`d3d8d1b2`) pela regra 8 — é o **mais antigo com aluno afetado**
(37d, 19 ocorrências, 18 alunos).

**A migration 82 (`scripts/82_generations_runpod_timing.sql`, escrita em 18/08)
NÃO ESTÁ APLICADA.** Conferido por dois caminhos independentes:

1. `information_schema.columns` para `generations.delay_seconds` e
   `generations.execution_seconds` → **vazio**.
2. `ddl_aplicado.cjs` → **8 colunas em 3 scripts** não aplicados (82, 96, 106).

O cabeçalho da própria 82 diz para que as colunas servem: *"delay alto +
execution baixo/nulo = cold start / nunca rodou; delay baixo + execution no teto
= hang do worker"*. É **exatamente** a pergunta deste incidente — e a resposta
nunca foi gravada uma única vez.

**O agravante é o desenho, e ele está certo:** `recordRunpodTiming()` está em
produção e é chamado nos **dois** caminhos de falha
(`webhooks/runpod/route.ts:294` e `generations/[id]/route.ts:93`), em UPDATE
separado e best-effort **de propósito**, para que a instrumentação nunca derrube
o gate do estorno do aluno. O efeito colateral é que ela falha **em silêncio**:
nas 19 ocorrências a telemetria parecia ligada e gravou zero.

É literalmente a armadilha escrita no meu fim de ronda: **DDL commitado não é
DDL aplicado.**

### 3-B. O `#15` é no mínimo DUAS classes — e tratar como uma é parte do problema

Os 5 `executionTimeout` desde a régua nova de 24/08, com o teto calculado por
`inferenceExecutionTimeoutMs`:

| quando | tlen | teto | elapsed | fase no momento da morte |
|---|---|---|---|---|
| 24/08 15:49 | 79 | 480 | 492 | — |
| 24/08 20:05 | 895 | 480 | 483 | — |
| 28/08 18:16 | 208 | 480 | 492 | — |
| 04/09 20:36 | 1304 | 570 | 579 | `inference.chunk.generate running_s=5` |
| 04/09 20:47 | 751 | 480 | 485 | `(sem fase instrumentada)` |

**Todos morrem 3 a 12s DEPOIS do próprio teto.** Nenhum dispara para 30 min —
isso era a era pré-24/08. Separando:

- **(A) HANG** — 79 e 208 chars queimando os 480s inteiros, quando o normal
  para esse tamanho é de segundos.
- **(B) ORÇAMENTO ESTOURADO ANDANDO** — o de 1304 chars foi morto com o chunk
  corrente com **5s de vida**: estava *avançando*, não pendurado. Mais teto o
  teria salvo.
- **(C) SETUP** — o de 751 chars morreu com a fase **vazia**, e setup era o
  único trecho pesado fora de `_phase` (agora instrumentado).

Remédio de (A) não serve para (B). Enquanto o card mistura os três, nenhuma
medição fecha.

### 3-C. A régua tem viés sistemático, e agora dá para medir

`elapsed_seconds` carrega **dois significados diferentes**:

- **sucesso** (`finalize.ts:123`) = `out.elapsed_s` do worker, que pelo
  comentário do próprio `inference.py` começa no `t0` **depois** do setup;
- **falha** (`webhooks/runpod/route.ts:258`, `[id]/route.ts:82`) =
  `executionTime` do RunPod = **o job inteiro**.

A régua de 24/08 foi calibrada sobre *"1.186 gerações **prontas**"* — o lado
**cego ao setup** (p99 ≤ 271s, máx 460s) — mas quem mata é o RunPod, **sobre o
job inteiro**. A régua superestima a própria margem exatamente pelo setup.

Com o `setup_s` de hoje dá para fechar a conta: a margem que a régua julga ter
no piso de 480s sobre o pior caso medido de geração (460s) é de **20s** —
**menor que o setup medido nas 6 amostras**, inclusive na melhor delas (9,17s
ainda cabe, mas 12,32s já não).

**O que eu NÃO afirmo:** 6 amostras é pouco. O outlier de 74,18s veio depois de
**6h33** sem geração (04:47Z→11:20Z), o que cheira a cold start — mas um
intervalo de **1h57** (02:35Z→04:32Z) deu só 11,09s, então intervalo ocioso
sozinho **não** explica e eu **não** provei cold start. Também não afirmo que
alargar o teto conserta (A).

Nota gravada no `d3d8d1b2` (56 notas). **Status mantido em `investigating`** —
não fechei porque não está resolvido.

## 4. Katia (`#47`) — ela FOI respondida, e o card não sabia

Ia pegar o `#47` primeiro (aluno esperando vem antes da fila) e descobri que
**às 11:32:10Z de hoje**, 9 minutos antes desta ronda começar, saiu para ela o
e-mail **uid 1063** — *"Katia, eu vi o seu video…"*. Ele faz tudo que faltava:
descreve o `Video.mov` em detalhe verificável (gravação de 20s, foto do blazer,
play de 00:26 a 00:42, arquivo `02/09 - VERSAO NOVA (42s)`), pede desculpa pelos
automáticos, diz que ela **não precisa reenviar nada**, responde a pergunta dela
de 04/09 10:20Z que estava **25h sem resposta** (*"devo gravar novamente?"* →
**não grave**) e **nomeia** o arquivo certo (`752b46ee`, "04/09 - pausa
natural", coverage 1,000) contra o `1498fbe5` que o nosso QA reprovou em 0,800.

**O card não sabia disso.** Estava `open`, com a última nota (Vigia, 10hZ)
dizendo *"ela já tentou entregar evidência três vezes e ninguém viu nenhuma"* —
verdade às 10hZ, falsa às 11:32Z. A próxima ronda leria aquilo e escreveria para
ela **de novo**, reproduzindo à mão o `#259`, que é exatamente o que a machucou
de madrugada.

**O que fiz:** gravei o fato no card (52 notas) e movi `open` → `aguardando_aluno`.
Desta vez o rótulo é honesto: nas rondas de 22hZ/00hZ ele era falso porque ela já
tinha respondido 3×; agora **existe pergunta nossa em aberto**, feita às 11:32Z,
e a bola é dela.

**Não escrevi para ela, de propósito.** Seria a segunda mensagem em 40 minutos.

⚠️ **Ressalva que precisa aparecer:** a ronda que mandou o e-mail das 11:32Z
**não deixou log em `_frank/prova` nem commit** — o último commit é o `fa06b15`
do Vigia 10hZ. O envio está confirmado na Enviados, mas a medição que a produziu
se perdeu. Registro que não é commitado é registro que a ronda seguinte não vê.

## 5. Fix sem dono, achado solto no working tree → PR #187

`_frank/ferramentas/_anexos.cjs` estava **modificado e não commitado**: o teto
por anexo virou configurável (`TETO_ANEXO_BYTES`, default inalterado em 10MB),
quase certamente para abrir os 31MB da Katia. Funcionando, e fora da main —
**mesma classe do fix de aluno que ficou 9h preso em 19/08**, e ainda por cima
seria varrido para dentro do meu commit de log.

Branch `feat/teto-anexo-configuravel`, **PR #187**. Não mergeei. Não toquei no
teto de 2MB da Fast (`mail-imap.ts:140`), que é deliberado e protege a caixa dela.

## 6. O que descartei antes de reportar

- **Migration 106 (`sgp_pedidos.cobrado_em`) não é dinheiro.** Vi "cobrança" numa
  migration não aplicada do SGP com o `#254` (cobrança em dobro) aberto e fui
  conferir antes de gritar. *"Cobrado"* ali é **o time cobrar o aluno pelo
  WhatsApp**, não débito. A própria migration diz *"NÃO APLICADA. Quem aplica é o
  Johnny"* e o painel tem fallback (o botão some sem as colunas). **Nenhum
  dinheiro em risco**, logo não vale a exceção da regra 8 e não virou urgência.
- **Geração sem `qa` nenhum não é regressão de hoje.** Uma das 7 após o corte
  (`c03b8cb6`) veio com `qa` vazio. Medi 10 dias antes de abrir card:
  **11,6% a 26,1% por dia**, todo dia. É buraco **pré-existente** — e vale a nota
  de que os denominadores do `#226` (44%) e do `#234` (14,3%) não enxergam essa
  fatia. Não abri chamado: classe antiga, medição não confirmada, e abrir hoje
  seria inflar a fila com coisa que não nasceu agora.

## 7. O que continua aberto (sem maquiagem)

- **Solon:** ~24h para o débito indevido. 4º pedido. **Decisão do Johnny.**
- **Migration 82:** o `#15` fica cego enquanto não for aplicada. **Aval do Johnny.**
- **Diego:** 08/09, R$194, ainda evitável.
- **#222:** vínculo por confirmação, esperando o "pode" (não é bug, é limite de
  desenho — a ronda das 02hZ já cravou).
- **4 pares de trial preventivos** e **estornos do `#254`:** sem mandato.
- **Katia:** bola com ela desde 11:32Z.

## 8. O que eu NÃO fiz

Não fechei incidente, não reabri, não mexi em crédito, não estornei, não cancelei
assinatura, não gastei GPU, **não apliquei migration**, não mergeei PR, não
escrevi para aluno, não alarguei a régua do teto e não toquei em nada da planilha.

## Próxima ronda começa por aqui

1. **Solon** — se o relógio virou (06/09 12:00Z) e o Johnny não decidiu, isso
   vira dinheiro cobrado errado; escalar como tal, não como item de fila.
2. **Migration 82** — se o Johnny deu o aval, aplicar e conferir a coluna no
   banco (não o DDL no git). Depois: primeira ocorrência nova do `#15` já
   separa cold start de hang.
3. **`setup_s`** — acumular amostra. Com ~30 linhas dá para testar a hipótese de
   cold start por intervalo ocioso, que hoje eu **não** provei.
4. **Katia** — se ela respondeu sobre o `752b46ee`, é o desfecho do `#47`.

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início.
Estorno em dia (10 tipos, 2.768 linhas, nenhum tipo desconhecido) — conferido
por `ref_type='generation_refund'`, nunca por `kind`. Leitura da caixa toda com
`EXAMINE` + `BODY.PEEK`; flags do uid 431 e fila de não-lidos da Fast conferidas
**intactas** antes e depois. Log commitado na **main**; código em branch + PR.
Relatório no **grupo** (ordem de canal de 31/08), nunca no privado.
