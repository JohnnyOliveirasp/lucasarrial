# Ronda das falhas — 23/09/2026 ~14h40–15h05Z

Dono da fila (regra 14-A). Serial (regra 8). **Produção tocada: 1 merge**
(PR #403). Zero GPU, zero migration, zero crédito movido, zero carta nova a
aluno, zero vítima nova.

---

## 1. Passos fixos — os dois limpos, os dois com instrumento independente

**Reconciliação dos envios** (passo fixo desde 18/09):
`1098 lidas da pasta Sent · 1021 já tinham linha · 77 fora da janela (--corte) ·
0 escrituráveis`. A contagem fecha (1098 = 1098), e a própria ferramenta
declara o buraco do ledger local: *"arquivo não existe nesta máquina — é
gitignored, some com o worktree"*. É o controle compensatório funcionando, não
um defeito novo.

⚠️ As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão de escrituração.

**Percepção travada** (ordem de 17/09): **0 cartões**, mais velho 0d.
Controle positivo (#310) e negativo (#518) OK, 516 varridos.

**Fila de patches do Vigia:** 0.

---

## 2. Pendência da ronda anterior, fechada

O **PR #408** (telemetria da fronteira interna, `f8587cef`) ficou em 14hZ com o
build do worker **em andamento** e eu me recusei a declarar produção. Conferido
agora: `Build RunPod Worker` **completed / success, 31m26s**. O #408 está no ar.

---

## 3. Item serial: `#d3d8d1b2` (55,1d · 20 ocorrências · 19 alunos)

Escolhido por ser **o mais antigo com passo concreto ao meu alcance** — os mais
velhos que ele (`c726c5ae` 105,9d, `b706b32e` 40,5d) esperam palavra do Johnny,
não trabalho meu.

O passo estava nomeado pelo próprio cartão, item (6) da nota de 22/09: fazer
`setup_s` e `since_t0_s` pegarem carona no heartbeat, para que a **próxima
morte** responda (A) pico de setup × (B) worker degradado na própria row. Isso
é o **PR #403**. Mergeado: `a77c90c9`, conferido no **conteúdo** da
`origin/main` (lista branca com as 3 chaves, `_stats_para_heartbeat` presente).

### 3.1 A revisão é minha, não herdada (regra 14-B)

1. **Stale check primeiro** — a família que já queimou 5 vezes aqui. Base
   `cb7a3e40` × main: a main andou **57 commits**, e **1** tocava
   `inference.py`: o próprio **#408 que eu mergei de manhã**. Sem sobreposição
   textual (#408 mexe em `__init__` e nos 3 call sites ~563-725; #403 mexe em
   `run()` ~141-213).
2. **A interação semântica, que é a que importa.** #403 passa a copiar o
   `qa_stats` inteiro pro heartbeat, e #408 tinha acabado de **adicionar chaves
   novas nesse mesmo dict**. Conferi que `_STATS_NO_HEARTBEAT` é lista **branca
   de verdade** (itera a tupla e pesca de `stats`), então chave nova do #408
   não vaza pro heartbeat. Se fosse lista negra, o #408 teria envenenado o
   payload do #403 sem ninguém ver.
3. **Duplicação de `setup_s` checada, não suposta.** `qa_stats` é persistido
   inteiro como coluna `qa`, e `setup_s` também vai no topo do payload de
   entrega (linha 787). Os dois saem do **mesmo** `self.setup_s` (linha 183):
   não divergem. E o `0.0` da linha 78 nunca chega ao `qa_stats`, então "chave
   ausente = ainda no setup" continua verdade.
4. **Testes rodados por mim, nos DOIS lados, mesmo instrumento** (venv
   descartável com numpy), **exit code real**: merged **32/32 OK (exit 0)** ×
   main **27/27 OK (exit 0)** — +5 testes, zero regressão. Smoke **51/51** nos
   dois. Frontend **32/32 (exit 0)**, com o teste novo passando nomeado.
5. **Mutação: 3 mortos** — `since_t0_s` congelado, `setup_s` publicado cedo no
   `__init__`, `setup_s` fora da lista branca.
6. **Sonda direta** (não raciocínio): `qa_stats` **não** é poluído pelo
   snapshot e `since_t0_s` **recalcula** entre ticks (0.0 → 0.1).

### 3.2 O mutante que SOBREVIVEU — registrado como dívida, não como defeito

Trocar o snapshot `{**self.qa_stats}` por **referência viva** passa pela suite
inteira. A pureza do snapshot é a afirmação central do PR sobre concorrência e
**não está presa por teste nenhum**.

Não bloqueou o merge porque medi o comportamento real e ele está **correto**
(item 6 acima). Mas um refactor futuro pode começar a gravar `since_t0_s`
dentro do `qa` persistido em silêncio. Fica escrito.

### 3.3 Armadilha de medição NOVA — vale pra qualquer mutação em Python aqui

Depois de rodar mutantes, o **`__pycache__` fica envenenado** e a verificação de
restauração deu **falso NEGATIVO**: fonte com **md5 idêntico** ao baseline e
**zero** string `MUTANTE`, e mesmo assim `FAILED (failures=4)`. Limpar o
`__pycache__` devolveu **32/32 OK**.

Refiz os **3 mutantes do zero**, com bytecode limpo entre cada um, porque a
evidência de que "os testes mordem" era justamente o que estava contaminado.
Quem mutar sem limpar `.pyc` lê resultado inventado — **nos dois sentidos**:
pode enterrar um mutante vivo tanto quanto ressuscitar um morto.

---

## 4. A correção que vale mais que o merge

A nota de 22/09 deste cartão concluiu, em letras próprias, **"NÃO É HANG"** —
porque `running_s=1,9` no último tick significaria worker avançando.

**Esse raciocínio se apoia num número que a própria pane congela.** Se quem
trava é a thread do **heartbeat** (hang nativo segurando o GIL congela *todas*
as threads Python do processo), então `running_s` não é "acabou de entrar no
chunk": é só o **último valor escrito antes do congelamento**. O trace ao vivo
da `9555c0d0` (22/09 14h) mostra `visto_em` **e** `running_s` parando de
avançar **juntos** por ~24s+, com o worker reiniciando sozinho depois — que é
assinatura de hang, não de avanço.

Anotei no cartão que **"não é hang" está CONTESTADO**, não estabelecido: das
duas leituras, a do #404 é a que tem trace ao vivo por trás. E o #403 que
acabou de subir é exatamente o instrumento que decide isso na próxima morte,
sem precisar escolher no escuro.

> Registro isto com o mesmo peso do merge porque a nota anterior é **minha**.
> Cartão que carrega leitura errada por 1 dia manda a próxima ronda investigar
> na direção errada por 1 dia.

---

## 5. PR #404 — NÃO mergeado, e o motivo não é técnico

O #404 (vigia de heartbeat congelado: processo **filho**, imune ao GIL do pai,
mata em ~105s com erro nomeado e POST pro webhook de fase) **está parado na
palavra do Johnny** — o próprio corpo do PR diz *"❌ NÃO mergear — decisão do
Johnny"*. Não é minha decisão e não mergeei.

Medido hoje para ele decidir sem susto:

- mesmo **depois** dos merges de hoje (#408 e #403), o #404 ainda casa **limpo**
  na main — merge de ensaio **sem conflito**, e conferido no conteúdo que #403,
  #408 e #404 **coexistem** (lista branca das 3 chaves + `_stats_para_heartbeat`
  + `dur_s` nos 3 call sites + `worker_watchdog.py` + `COPY` no Dockerfile);
- no estado combinado a suite fica **verde**: watchdog **27/27**, telemetria
  **32/32**, smoke **51/51**, todos **exit 0**; `py_compile` exit 0.

**Conclusão pro Johnny, em uma linha:** está pronto pra subir no dia em que ele
disser "pode", **sem rebase**. A espera é de decisão, não de trabalho.

---

## 6. Fim de ronda

- Produção: **PR #403** (`a77c90c9`), conferido no **conteúdo** da `origin/main`.
- Build do worker (#403): **EM ANDAMENTO** (iniciado 14:47:53Z, faixa histórica
  24–47 min). ⚠️ **NÃO declaro o #403 em produção** — merge conferido, deploy
  não. Fecha na próxima ronda, como o #408 fechou nesta.
- **#408 confirmado em produção** nesta ronda (build success 31m26s).
- Cartão `d3d8d1b2`: nota gravada e **conferida na releitura** (81 → 82 notas,
  1 linha afetada). Status segue **investigating** — a causa de fundo continua
  sem nome, e #403 é instrumento, não cura. **Não marquei fixed.**
- Migration: nenhuma. DDL: nenhum. GPU: nenhuma. Crédito: nada movido.
- Aluno: nenhuma vítima nova. `rsirahata` segue estornado (+981,
  `ref_type='generation_refund'`) e avisado (uid 3186).
- Worktrees de ensaio removidos, `git worktree prune` rodado, repo limpo.

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **Frota morta, 6ª ronda seguida — agora COM causa raiz.** Os 9 operários
   respondem *"Not logged in"*. Medido hoje: `~/.claude/.credentials.json` tem
   `accessToken` **e** `refreshToken` de **comprimento zero**, `expiresAt: 0`, e
   `refreshTokenExpiresAt` = **18/09 14:15:02Z** — o token de renovação venceu
   e o arquivo foi reescrito vazio 7h depois (mtime 18/09 21:49Z). Não há
   `ANTHROPIC_API_KEY` no ambiente. **Não existe caminho não-interativo de
   volta:** só o Johnny refazendo `/login`. Postado no grupo nesta ronda.
   Enquanto isso: revisei 3 PRs sozinho em 2 rondas e **não testei tela nenhuma**.
2. ⏰ **Cobrança `GGMWWE5Q` em 26/09 — 3 dias.**
3. **PR #404** — "pode" do Johnny. Provado hoje: sem conflito, suite verde.
4. **PR #214** — "pode" + semear o dedupe na MESMA janela.
5. **10.000 cr do `b706b32e`** — código em produção, falta a decisão.
6. **`702cc916`** — decisão parada há 21d.
7. **7.455 cr do `7ed72ad0`** — resposta A/B **prometida por escrito ao aluno**.
8. **`f8587cef` passo (b)** — escuta ponto a ponto, bloqueada por falta de
   ouvido (`qa` fora do ar). Destrava junto com a frota.
9. **Hellen (`2609241a`)** — defeito de classe consertado; a entrega dela não
   aconteceu. Se passar 7d, 2ª tentativa ou WhatsApp.
10. **77 cartas anteriores a 14/09** — sem decisão de escrituração.
11. **Dívida de teste do #403** — a pureza do snapshot não está presa por
    teste (§3.2).
