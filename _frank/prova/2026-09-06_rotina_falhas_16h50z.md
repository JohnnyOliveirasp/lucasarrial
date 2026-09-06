# Ronda das falhas — 06/09, ~16h50Z (13h50 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** assunto e levei até onde dava.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**,
nada foi pro privado.

---

## 0. A ronda em uma linha

**Um aluno pagante estava travado há 2 dias tendo reclamado DUAS vezes sem
nunca receber uma resposta humana — e a causa não era ele: passando de 60min
de áudio o nosso botão "Treinar voz" morre, e o medidor ainda escreve
"Faltam: 00:00" com a barra cheia. Ele lia que não faltava nada e via o botão
apagado ao mesmo tempo.**

---

## 1. Por que peguei este

Fila no início: **24 incidentes abertos**, 13 `aguardando_aluno`, 3 presos.

Os grandes da faixa antiga seguem **parados em DECISÃO, não em investigação**
(#15 na migration 82, #222 esperando reenquadrar, #226/#234 na decisão de
produto) — reconferidos na ronda das 16hZ, sem dado novo meu.

O que mudou nesta janela: o **#287** entrou às 16:37Z dizendo *"já escalado
antes como técnico mas sem retorno"*. Fui ver quem era: **mesmo aluno** do
**#253** (`acalbamonte@gmail.com`), aberto em 04/09 19:39. Dois dias, dois
chamados, e `ler_caixa.cjs --enviados` confirmou: **nunca ninguém escreveu
pra ele**. É exatamente o silêncio que fez a Viviana explodir, e vinha com
relógio: o acesso dele **expira 09/09**.

Aluno esperando vem antes da limpeza da fila. Peguei este.

### De quebra, uma classe fechada que segue produzindo vítima

Conferindo `awaiting_training` (armadilha padrão: *classe fechada que segue
disparando esconde bug nosso*), o **#137** foi fechado em 26/08 com a leitura
"é entulho de primeira tentativa, 14 dos 16 donos já têm voz `ready`". A
população hoje é **18**, não 16. Fui remedir em vez de herdar:

| | quantos | leitura |
|---|---|---|
| donos **sem nenhuma voz `ready`** | **3** | candidatos a vítima real |
| donos **com voz `ready`** | 15 | entulho — a leitura do #137 vale |

Dos 3 sem voz: dois (`superaspen22`, `emanuelfmguerreiro`) são upload
abandonado de 1 arquivo, `duration_seconds` **nulo**, **zero crédito** e sem
acesso — não são pagantes travados. **Sobra a Tânia** como única vítima viva.
Ou seja: a leitura do #137 continua de pé, mas o número dele (12) nunca foi a
população real e não é hoje.

---

## 2. O que eu medi (a causa está no nosso código)

`frontend/src/lib/audio/medicao.ts`, `resumirMedicao()`:

```js
const acimaDoMaximo = total > maxSegundos;                 // > 3600s
const atingeMinimo  = total >= minSegundos && !acimaDoMaximo;
faltam: Math.max(0, minSegundos - total)
```

`voice-creator.tsx:905` — `disabled={!meetsMinimum || busy || ...}`

**O booleano que significa "não atingiu o mínimo" é o mesmo que carrega
"passou do máximo".** Então cruzar 60min desabilita o botão pelo caminho do
mínimo. E como nesse estado `faltam` = 0, o `DurationMeter` (linha 1193) cai
no ramo do `meets=false` e imprime **"Faltam: 00:00"**, em cinza, com a barra
**cheia**.

O aluno lê *"Faltam 00:00"* e vê o botão morto. Existe sim um alerta vermelho
`overMax` ("Máximo de 60 minutos — remova alguns arquivos"), mas o medidor —
que é o número em corpo 3xl e a barra — **contradiz o alerta**.

Isso viola o compromisso escrito no cabeçalho do **próprio** `medicao.ts`:

> *"o número que o aluno lê nunca pode contradizer o que a tela faz com ele"*

Mesma classe do **#203** (Jussara, assinante pagante, **um mês** travada).

### O que eu NÃO provei (e por que o e-mail tem duas hipóteses)

**Não dá pra medir os arquivos dele do servidor.** São locais no browser e só
sobem no clique. O R2 tem **1 único take** dele (0,8MB, 05/09 03:20) — a "1
hora" está na máquina dele. Então o teto de 60min é a hipótese **principal**
(bate com o relato "1 hora" + botão morto), mas não é fato medido no caso
dele. A secundária é a falha de medição contando zero (classe #203). O e-mail
cobre **as duas** e pede o valor do "Total de áudio" pra separar.

Registro isso como hipótese porque ensaio não é entrega — o que o banco
confirma é que ele tem 0 vozes, 87.000 créditos e nada cobrado.

---

## 3. O que eu fiz

- **Escrevi pro aluno** (`acalbamonte@gmail.com`, Enviados **uid 1163**,
  cópia CONFIRMADA). Primeiro contato humano em 2 dias. Mandei o que
  destrava agora (deixar ~30min, que é o recomendado — excesso não melhora a
  voz), as faixas (mín 20 / rec 30 / máx 60, teto de 20 arquivos), e a
  pergunta que separa as duas causas. Disse que os créditos estão intactos.
- **#253 (`a8a543ea`)** → `aguardando_aluno`, com a causa medida escrita e o
  que **não** foi provado.
- **#287 (`4225e8dd`)** → `aguardando_aluno`, marcado **duplicata** do #253,
  sem repetir a investigação (duas versões da mesma verdade é como nota vira
  ruído).
- **Card `1b1b030b` delegado ao `coder`**: separar `atingeMinimo` (verdade
  sobre o mínimo) do portão do botão (`podeEnviar = atingeMinimo &&
  !acimaDoMaximo`), e o medidor nunca imprimir "Faltam: 00:00" — acima do
  teto ele diz o que está **sobrando**. Com i18n nos 3 locales e teste em
  `node --test` pros limites 3600/3601.
  ⚠️ Passei explícito: **não mudar o teto e não deixar passar de 60min** — ele
  existe porque 79min estourou o `executionTimeout` do worker em produção
  (21/07). O que muda é a EXPLICAÇÃO, não a permissão.
- **Postei no GRUPO** (regra 7): aluno escrito, fato consumado.

## 4. O que eu conferi em vez de herdar

**Tânia** (única vítima viva do `awaiting_training`, 30min, 6 arquivos,
200.000 créditos, acesso até 17/09). A ronda anterior mandou 2 e-mails
dizendo que "falta o clique dela" — antes de repetir isso, fui ver se o
clique **existe**: `voice-status-panel.tsx:117-118` renderiza o botão para
`awaiting_training` com `disabled={training}` apenas, ela tem 6
`raw_audio_paths` e 200.000 créditos contra um custo de 10.000. **O caminho
dela está de fato livre** — a orientação estava certa. Bola com ela (regra 8).

Valia conferir: se o botão estivesse morto pra ela também, os 2 e-mails
teriam culpado a aluna por um defeito nosso.

## 5. O que eu NÃO fiz

Não virei chave de produção, não mergeei PR, não apliquei migration, não
gastei GPU, não toquei em crédito/acesso/plano, não reabri incidente, não
fechei nada como `fixed` sem conserto em produção, e não toquei em nada da
planilha.

---

## 5.1 O conserto da Tânia já existe e está esperando revisão

Na checagem de fim de ronda (branch que esconde fix) achei o que fecharia o
buraco que a seção 1 mediu:

- 🟢 **PR #196** — *"Lembrete automático para voz parada em
  `awaiting_training` (+ conserta a tela do detalhe)"*, aberto **hoje
  15:14Z**. É exatamente o mecanismo que teria pego a Tânia **sem depender de
  ninguém da ronda olhar**: hoje a única coisa que tira alguém de
  `awaiting_training` é um humano notar. Está há ~1h30 na fila — não está
  perdido, mas é o PR com vítima viva esperando do outro lado.
  O segundo commit dele (*"a tela do DETALHE ainda dizia 'Pronta para
  treinar'"*) é o rabo do #137: o PR #57 corrigiu o rótulo na **lista** e a
  tela de **detalhe** ficou para trás.
- 🟡 **PR #15** — varredura enxergar `awaiting_training` com recorte de
  pagante parado. Aberto em **20/08**, **17 dias**.

Não mergeei nenhum dos dois: merge é revisão, não é ronda — e este repositório
já teve fix de produção derrubado por branch velha (`feat/onedrive-401`,
`feat/fix-image-upload-retry`). Fica como recomendação, com a ressalva de que
o #196 precisa ser lido contra o `37d982f` (o #137 já em produção) pra não
reverter o rótulo da lista.

## 6. Precisa de DECISÃO do Johnny

Nada novo meu — os itens vermelhos seguem os da ronda das 16hZ (**#226**
destrava o #234; **migration 82** destrava o #15; **#222** reenquadrar ou
fechar; **23 PRs abertos**, com o #176 esperando desde 04/09). Acrescento só
dois relógios e um PR:

0. 🟢 **PR #196** (seção 5.1) — barato, aberto hoje, e é o que impede o
   próximo `awaiting_training` de depender de alguém reparar. Tem vítima viva
   (Tânia) esperando.

1. 🟡 **acalbamonte** — acesso expira **09/09** (3 dias). Se ele responder
   confirmando o teto, o destrave é dele mesmo e não custa nada. Se o acesso
   vencer antes de ele conseguir treinar, vira decisão de estender.
2. 🟡 **Marcelo** — garantia vence **11/09**, 2 ciclos pagos sem nunca ter
   tido voz. Segue sem resposta dele.

---

## 7. Lição que fica

**Chamado técnico sem dono vira reincidência no atendimento — e quem paga o
juro é o aluno.** O #253 ficou 2 dias em `investigating` sem ninguém escrever
pro aluno; ele voltou pelo canal de atendimento como #287 marcado "URGENTE,
sem retorno". Um chamado virou dois, o aluno perdeu 2 dos ~7 dias de acesso
que lhe restavam, e o custo de responder no dia 04/09 seria o mesmo de hoje.
`aguardando_aluno` só é honesto **depois** que alguém escreveu — antes disso é
`investigating` sem dono com outro nome.

E a lição de instrumento: **medir a população da classe antes de aceitar o
número do chamado que a fechou.** O #137 dizia 12 alunos e foi fechado com
"14 de 16 já têm voz". Hoje são 18, e o recorte que importa (dono **sem
nenhuma** voz `ready`) devolve **3** — dos quais só 1 é pagante viva. Nem o
número do chamado nem o do fechamento descreviam a fila real.

---

## 8. Erro meu nesta ronda, e a armadilha nova que ele revela

**O segundo commit deste log foi parar em branch de feature, não na main.**
Eu rodei `git commit` na pasta do projeto como sempre, mas entre o meu
primeiro commit e o segundo o **`coder`** (card `1b1b030b`, trabalhando no
MESMO diretório) fez `checkout` da branch dele
(`feat/medidor-nao-mente-acima-do-teto`). Meu `git push origin main` respondeu
**"Everything up-to-date"** — que é a mensagem de sucesso mais enganosa do
git: nada falhou, e o registro simplesmente não estava onde eu pensava.

É exatamente o defeito que o passo fixo de fim de ronda existe pra pegar
("em 19/08 um fix de aluno ficou 9h preso assim") — só que com uma causa nova:
não foi esquecimento meu de trocar de branch, foi **outro agente trocando a
branch debaixo de mim**, no meio da minha própria ronda.

**Como corrigi sem atropelar o `coder`:** ele estava com
`voice-creator.tsx` e `medicao.ts` modificados e **não commitados**. Um
`git checkout main` ali teria arrancado a árvore de trabalho debaixo dele e
podia destruir o conserto em voo. Usei `git worktree add /tmp/... main`,
fiz `cherry-pick` do commit do log na main isolada, empurrei e removi a
worktree. Conferido depois: a branch dele segue como estava e o trabalho
avançou (os 3 locales entraram). O `origin/main..HEAD` fecha vazio.

**A regra que fica, e vale pra toda ronda daqui pra frente:** desde que os
operários rodam no mesmo diretório do projeto, `git branch --show-current`
**antes de cada commit** virou obrigatório — a branch não é mais estável
dentro de uma ronda só. E `push` que responde "Everything up-to-date" quando
você acabou de commitar não é sucesso: é sinal de que o commit foi para outro
lugar. Quando houver operário com trabalho não commitado no diretório, a
correção é **worktree**, nunca `checkout`.
