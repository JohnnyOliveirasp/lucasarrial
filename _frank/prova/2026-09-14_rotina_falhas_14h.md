# Rotina das falhas — 14/09 ~14hZ

Ronda serial (regra 8). Item desta ronda: **`#15` / `d3d8d1b2`**, o mais antigo
da fila (46 dias) e com aluno afetado — critério da regra 8 aplicado ao pé da
letra. **Não fechei**, e explico em que passo travou: a causa raiz depende de
uma próxima ocorrência, e forçar `fixed` seria violar a regra 14.

Repo em `main`, `pull --ff-only` limpo na entrada. `_frank/ordens/README.md`
lido antes de tocar em qualquer coisa, e a ordem de **29/08** lida **inteira**
(o título é "desligar o VIGIA e o FRANK" — o prompt só me contava a metade da
planilha; o §2 preserva fila de incidentes e atendimento a aluno, que é o que
sustenta esta ronda existir). **Nada da planilha** foi lido, escrito,
classificado ou reprocessado.

---

## Estado na entrada e na saída

| | entrada (13:40Z) | saída (13:55Z) |
|---|---|---|
| `open` | 2 | 2 |
| `investigating` | 79 | 79 |
| **total aberto** | **81** | **81** |
| `aguardando_aluno` | 15 | 15 |

**Reconciliado: não fechei nenhum e não abri nenhum. A fila não se moveu — e o
relatório diz isso em vez de maquiar.** A ronda das 13hZ saiu com 80; entrei com
81 porque o card do **Jackson** (`#b229e491`, nota fiscal dos R$ 97, 10 dias)
voltou a disparar às 13:25Z e subiu pra `open`. Entrou também o **`#391`**
(michellufpa@gmail.com, `.ogg` do WhatsApp que antes treinava), que nasce
`aguardando_aluno` e por isso não conta no total de abertos.

---

## 1. As varreduras obrigatórias — limpas, e limpas *de verdade*

**2-B (`saida_x_assinatura.cjs`), roda em TODA ronda:** 346 incidentes, 26
pessoas, **0 sangrando**. O controle positivo passou **nos dois lados** (Marcelo
reencontrado à esquerda, `SUR21VU9` devolvido à direita) — então é fila limpa,
não instrumento cego. A distinção importa porque cegar uma ponta zeraria o
relatório exatamente igual.

**`varredura_travados.cjs`:** 3 presos, **nenhum é bug**.

- `marcelopersonalthe32@gmail.com` — 35 dias sem voz. Caso já resolvido na ronda
  das 12hZ (assinatura cancelada e conferida na fonte viva). Não sangra.
- `ericb.malzone@gmail.com` — resolvido na ronda das 13hZ: `awaiting_training`
  espera o clique **dele**, está no dia 1 de uma régua de 3.
- `vendas.agenciaaguia@gmail.com` — **novo nesta ronda**, e o único que eu ainda
  não conhecia. Conferi antes de me assustar: voz `ddebd355` com **3 min 53 s de
  idade**, status `training`, 3 áudios. É treino **em curso**, não travado.
  Nenhuma ação, de propósito.

**`garantia_na_fila.cjs`:** 5 perderam a janela na fila, **0 vencem em 48h**.
Nada novo e nada vencendo agora — os 5 já são dívida conhecida das rondas
anteriores.

---

## 2. O serial: `#15` (`d3d8d1b2`) — 46 dias, e hoje dá pra dizer o que ele é

A ordem permanente manda: *"se VOLTAR, reabra e instrumente o handler pra logar
em QUAL fase o chunk pendura"*. Fui conferir se isso tinha sido feito antes de
refazer, e tinha.

### A instrumentação está completa E VIVA — não só commitada

- `2bd3c3f` (PR #183, 04/09) instrumentou o único trecho pesado que ficava fora
  de `_phase`: `inference.setup.lora`, `.setup.reference`, `.setup.model`.
- `b55db26` (08/09) passou a levar `chunk`/`attempt` ao banco, não só o nome.
- Build do worker **SUCCESS em 04/09 23:42Z** (e outros depois, até PR #213 em
  08/09).

**Build não é imagem no ar** — mesma armadilha do "DDL commitado não é DDL
aplicado". Então fui atrás da prova de que o *endpoint* roda a imagem nova: a
geração **`67f28d0f`** (11/09 20:53Z) gravou `fase_corrente` **com o bloco
`meta{chunk:1012, attempt:1}`**, que **só existe depois do `b55db26`**. A cadeia
de telemetria está fechada ponta a ponta em produção. **A próxima ocorrência vai
nomear a fase**, inclusive as três do setup que eram cegas.

### Sem reincidência há 9,7 dias — e o zero foi conferido

Último disparo **04/09 20:47Z**. De 05/09 a 14/09: **718 gerações, 0 timeouts**
(contado, não estimado), tráfego normal de 36–118/dia, maior `elapsed` do
período entre **175 s e 378 s** — todas muito abaixo do piso de 480 s. Tráfego
vivo com zero timeout é zero de verdade, não instrumento desligado.

### Os 2 alunos de 04/09 estão inteiros

Estorno conferido por **`ref_type='generation_refund'`** (o `kind` grava
`extra_purchase` — é a armadilha que quase pagou em dobro pra 13 alunos):
`-1307/+1307` e `-749/+749`. **Saldo zero nos dois.**

### Respondi o pedido de 04/09 que ninguém tinha respondido

O recado `para_frank_d3d8d1b2` (9,7 dias parado) perguntava se o reenvio do #89
disparou e concluía: *"se disparou e estourou de novo, o teto está apertado
demais e precisa subir."*

**Disparou: `request_attempts=2` nas duas, e estourou de novo nas duas.**

**Mas a conclusão proposta está contrariada pela medição e NÃO deve ser
executada.** As duas bateram o teto calculado exatamente (1307 chars → 9 chunks
→ 570 s, contra 579 s de `elapsed`; 749 → 5 chunks → 480 s, contra 484 s), o que
à primeira vista parece "régua curta". Só que o trabalho normal termina em
175–378 s, e a medição de 24/08 já tinha achado que timeout **não correlaciona
com tamanho de texto** (78 chars ficou 1.812 s). **Subir o teto não faz job
pendurado terminar — só faz o aluno esperar mais pelo estorno**, que é
exatamente o que o fix de 24/08 desfez de propósito (30 min → 8 min). Deixei
isso escrito no card pra ninguém "consertar" pro lado errado depois.

### O que ninguém tinha contado: o reenvio dobra a espera pelo dinheiro

O estorno chegou em **~19,9 min** (`a07e9278`: débito 20:36:58 → estorno
20:56:51) e **~16,5 min** (`86254b30`: 20:47:50 → 21:04:23) — e não nos 8 min
que o fix de 24/08 mirava, porque a 2ª tentativa roda um teto inteiro por cima.
**2/2 reenvios falharam.** Amostra de 2: **não mexi em nada**, só registrei. Isso
é dinheiro/comportamento de produção e não se mexe com n=2 nem sem o Johnny.

### Por que fica `investigating` e não `fixed`

A causa raiz do hang **segue desconhecida**. A única pista de fase até hoje é a
`a07e9278`: parou em **`inference.chunk.generate` com `running_s=4,9`** — tinha
*acabado* de entrar no chunk — e o heartbeat **calou dali em diante**. Isso é
assinatura de **trava**, não de lentidão. **Travou neste passo: depende da
próxima ocorrência**, que agora será legível. Recado respondido e apagado com
`DELETE` (não `set_state` null, que volta `23502` e deixa a chave lá) —
conferido, 0 sobrando.

---

## 3. Dois erros meus nesta ronda, os dois pegos antes de virarem estrago

1. **Inflei um número em 35%.** Escrevi "971 gerações" na nota do card somando a
   tabela diária de cabeça. O certo é **718** (contado). A conclusão não muda —
   718 com 0 timeout continua sendo zero conferido — mas o número errado ficaria
   de pé num registro permanente, então **gravei a correção no próprio card** em
   vez de deixar passar. É a lição de 13/09 se repetindo: **o achado que
   confirma a própria tese é o que menos se confere** — "971" foi o único número
   da nota que eu não tirei de uma consulta, justamente porque apontava pro lado
   que eu já queria.
2. **O ensaio me impediu de destruir histórico.** Ia gravar a nota com
   `--status investigating`; o dry-run mostrou `reabertura: LIMPA
   resolved_at/resolved_by/resolved_commit (era commit=3f25c18)`. O status já
   *era* `investigating`: a flag não mudava nada e apagaria a referência. Gravei
   sem ela — `resolved_commit=3f25c18` conferido intacto na releitura.

---

## 4. O que eu NÃO fiz

- **Nenhum write no mundo externo.** Nenhum e-mail a aluno, nenhum cancelamento,
  nenhum crédito, acesso ou entitlement mexido. Esta ronda não tocou no dinheiro
  de ninguém.
- **Nenhum PR, nenhum código.** O `#15` não pede código agora: pede a próxima
  ocorrência.
- **Nenhuma migration.**
- **Nada da planilha** (ordem de 29/08).
- **Não ataquei a fila de recados** (77 abertos) nem os 15 `aguardando_aluno`,
  dos quais vários passaram de 7 dias e **pedem segunda tentativa**. Segue como
  dívida declarada, não como coisa resolvida.
- Não toquei nos branches STALE (`feat/fix-image-upload-retry`,
  `feat/onedrive-401`, `fix/referencia-fronteira-de-frase-por-palavra`,
  `feat/fabricar-referencia-fronteira-por-palavra`).

---

## 5. Por que não postei no grupo

**Regra 7 (21/08)** manda postar na hora quando: fechei incidente, subi fix pra
produção, ou escrevi pra aluno. **Nenhuma das três aconteceu** — e a mesma regra
proíbe expressamente ronda vazia e progresso parcial, *"o Lucas está no grupo e
ruído mata o canal"*. A ordem de canal de 31/08 diz **onde** avisar (grupo, com
`notify-grupo.sh`, nunca no privado), não cria obrigação de avisar quando não há
fato consumado. **Então: silêncio no grupo nesta ronda, de propósito.** O
relatório consolidado da noite continua valendo, mesmo em dia limpo.

---

## 6. O que fica pro Johnny (nada novo — tudo repetido)

1. **`#389` — 12 clones entregues (R$ 7.449,00) contra compra contestada, e 7
   ainda em produção.** Única coisa que depende de decisão dele. **4ª ronda.**
2. **Reembolsos parados:** Lucila `#299` (R$ 291), Francislaine `#307`, `#309`,
   `#363`.
3. **Emanuel — 180,81 EUR**, parado desde 11/09. **7ª ronda.**
4. **Marcelo — R$ 194 já pagos** por um produto que nunca entregou uma voz.

---

## Fim de ronda

- **Achado de higiene:** entrei na ronda e o repo **não estava na `main`** — a
  árvore tinha sido deixada em `feat/sgp-situacao-e-erro` por trabalho
  concorrente, com `frontend/src/lib/sgp/types.ts` modificado. Esse é
  exatamente o vão que prendeu um fix de aluno por 9 h em 19/08. Conferi antes
  de mexer: a branch tem **0 commits além da `main`** e não existe no origin,
  então voltar pra `main` não perdia nada. **A modificação alheia foi preservada
  e não entrou neste commit** — staged só o arquivo deste log, pelo caminho.
- `git fetch origin && git log --oneline origin/main..HEAD` → conferido **vazio**
  depois do push deste log.
- Nenhuma branch minha aberta nesta ronda; nenhum fix preso em branch.
- Nenhuma migration.
