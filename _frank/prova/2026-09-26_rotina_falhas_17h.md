# Ronda das falhas — 26/09/2026, ~17hZ (rodou 16:40–17:0xZ)

> **Nome do arquivo:** conferi a primeira linha dos vizinhos antes de escolher.
> Hoje já existem `01h`, `11h`, `12h`, `13h`, `15h40` de ronda das falhas,
> `00h`/`10h`/`12h30`/`14h`/`16h` do Vigia, e um `qa_coverage` de 15:19Z. Não
> havia `17h`.

**Método: serial (regra 8).** Peguei o `#452` (o mais velho com aluno nomeado e
sem carta, descontado o `#426` que é decisão do Johnny) e levei até o fim. Com
ele fechado, fui pro seguinte — e o seguinte era um **cluster de 3 cartões**
(`#457`, `#458`, `#461`) que estava preso 9 dias por um motivo que vale mais que
os cartões em si.

**O que esta ronda entregou, em fato consumado:**

| o que | prova |
|---|---|
| **`#452` FECHADO** (`investigating` → `ignored`) | decisão medida: SubprocException **não entra** em TRANSITORIAS. `resolved_at` 16:51:08Z, releitura confirmou 1 linha |
| **`#457`, `#458`, `#461` FECHADOS** (`investigating` → `fixed`) | `resolved_commit=f9f296d6`, conferido no CONTEÚDO da `origin/main` e ancestral do sha deployado. 16:58:5xZ, 1 linha cada |
| **hipótese principal do `#452` REFUTADA** | ficou 9 dias no cartão como "causa provável"; não tem mecanismo (§4.2) |
| **truncagem que destrói evidência, achada e medida** | `fase-telemetria.ts:205` decapita traceback; despachada no card `49add4ec` |
| **critério de fechamento impossível, trocado** | o do `#457` só se cumpria por **reincidência** (§5) |
| 2 avisos no grupo | `notify-grupo.sh`, um por fechamento |

**Produção tocada:** nenhuma. Zero GPU, zero migration, zero DDL, zero crédito
movido, zero código de produção alterado **por mim**. As escritas foram: **4
cartões fechados**, **4 notas**, **1 card de conserto despachado**.

**Carta pra aluno: nenhuma, e o motivo está escrito em cada cartão** (§6) — não
foi esquecimento.

**Ordem de 29/08 respeitada:** nada vindo da planilha foi lido, escrito,
classificado ou reprocessado. **Canal (ordem de 31/08):** os dois avisos saíram
**no grupo**, nada no privado do Johnny.

---

## §1. Passo fixo — reconciliar os envios (ordem de 18/09)

```
1336  lidas da pasta "Sent"       (15h40: 1330 · +6 na janela)
   0  + registro local (#210 — gitignored, não existe nesta máquina)
1336  = TOTAL
1259    já tinham linha           (15h40: 1253 · +6)
   0    repetidas · 77 fora da janela (--corte) · 0 recusadas
   0    DENTRO DA JANELA — escrituráveis
✔ 1336 = 1336: nenhuma carta sumiu na classificação
🕳️ CARTAS SEM LINHA, DENTRO DA JANELA: 0
```

Buraco **PASSIVO**. As 6 cartas novas da janela entraram no livro sozinhas. ⚠️ As
**77** anteriores a 14/09 14:06:31Z seguem sem decisão — é o `--corte`, não
recusa.

## §2. Passo fixo — percepção travada (ordem de 17/09)

```
controle positivo OK (#310) · controle negativo OK (#518 descontado) · 584 varridos
👁 SÓ PARAM POR FALTA DE VER/OUVIR/ASSISTIR: 0 · mais velho 0d
```

Zero. Rodei o **instrumento**, não o SQL, como a correção de 21/09 manda.

## §3. Passo fixo — estado da fila e aluno em silêncio

```
fila: 584 = 337 fixed + 119 investigating + 67 ignored + 41 aguard. + 20 open
diff contra o snapshot de 16:10:55Z (583 cartões):
  MUDOU DE STATUS: 0 · NASCEU: 1 (#600, em investigating) · DESAPARECEU: 0
```

```
cartas lidas: 1259/1259 (paginado, conferido) · controle positivo OK
🔇 ALUNO NOMEADO E NENHUMA CARTA NOSSA: 12  (mais velho 10d)
🕳️ NÃO-CONCLUSIVO (anterior ao piso): 19
```

Os **4 fechamentos desta ronda saem desta lista** (`#452`, `#458`, `#461` eram
dela; `#457` não, por ter 3 e-mails). O contador da próxima ronda deve cair para
~9 — **e isso não é a lista "melhorando"**: é o efeito de fechar cartão. Registro
porque contador que cai por fechamento parece progresso de atendimento e não é.

---

## §4. O caso serial: `#452` — decidido, e a hipótese que morava nele era falsa

Aluno **Flávio** (`flavio@menosvintesete.com`). Cartão de 17/09 16:23Z:
*"Geração de áudio: SubprocException"*. **9 dias** em `investigating`. A pergunta
que ele deixou aberta era exatamente uma: **esse erro entra na lista
TRANSITORIAS** (reenvio automático 1x, sem cobrar)? A nota de 17/09 escreveu a
condição com honestidade rara: *"se o placar não sustentar, a resposta certa é
NÃO ENTRA"*. Medi o placar. **Não sustenta.**

### 4.1 O censo, agora na história inteira (a nota de 17/09 mediu 14 dias)

SubprocException, casamento **estrito**: **1 ocorrência em 6.077 gerações** — a
tabela inteira, desde 22/05, 127 dias. Não é população.

Ampliando pra família `inductor`/`triton` dá 3 linhas, e **as outras 2 são outra
coisa**: 10/08, `[Errno 28] No space left on device` em
**`/tmp/torchinductor_root`** (`74100070` sendzapoficial@, `7153b782` jpdias3@).
São o `#33`/`#31`, `fixed`, e estão no caminho **default** do cache — não no
`/workspace/tmp/inductor` que o `TORCHINDUCTOR_CACHE_DIR` aponta hoje. Depois que
o cache mudou de lugar: **zero** disco-cheio no caminho do inductor. Quem
filtrar por "inductor" e somar os 3 infla o alarme — é a mesma soma-de-classes
que a nota de 17/09 já corrigiu uma vez.

### 4.2 A hipótese que ficou 9 dias no cartão como "causa provável" está REFUTADA

O recado do Executor propunha: `faxina()` purga o `INDUCTOR_CACHE` acima de
`DISK_ALERT_PERCENT=75` e *"o job seguinte cai num cache meio-apagado"*. Fui ler
o código, e **não há mecanismo**:

- `faxina()` roda no **FIM** do job (`handler.py:92`), nunca durante.
- `runpod.serverless.start({"handler": handler})` (`handler.py:100`) é chamado
  **sem `concurrency_modifier`** → a concorrência default do RunPod é **1 job por
  worker**. A purga não pode rodar por baixo de um job que está compilando no
  mesmo worker.
- Recompilação fria depois da purga é comportamento **desenhado**: o próprio
  docstring do `faxina()` diz *"que se refaz sozinho, custando alguns segundos no
  próximo job"*.

Sobra: o subprocesso de compilação morreu durante uma recompilação fria (65,9s,
fase `inference.setup.model`). **Não confirmei nem refutei** o disco ≥75% às
16:00Z — exige o log do worker, que eu não leio, e 9 dias depois o log do job
`f63599b6` não existe mais. Declaro como **não-medido**, não como descartado.

### 4.3 Por que não entra na lista, em duas razões independentes

**(a) n=1 em 6.077.** O próprio `execucao.ts` exige medição antes de alargar, e
foi assim que a `qa_coverage` entrou (8 reenvios do texto idêntico, 7 `ready`).
Aqui existe **um** reenvio: o aluno refez às 16:08:36 o MESMO texto (md5
`8f55000f`, 1.983 chars) e saiu `ready`. **1/1 não é placar** — é o mesmo evento
que gerou a pergunta.

**(b) `"subprocexception"` é ENVELOPE, não causa.** A string diz literalmente
*"An exception occurred in a subprocess:"* e carrega **qualquer** traceback que o
`job()` levantou (`subproc_pool.py:340`, `result = job()`). Um **OOM/CUDA** dentro
do compile worker chega vestindo esse mesmo envelope — e OOM/CUDA está
**explicitamente fora** da lista (*"repetir só faria o aluno esperar em dobro pelo
mesmo erro"*). É a mesma razão pela qual o arquivo **proíbe `"unknown"`**.

E não existe recorte mais estreito defensável hoje, porque a parte que
distinguiria as causas é justamente a que **nós** destruímos — §4.4.

### 4.4 O achado que vale mais que o fechamento: destruímos a nossa testemunha

O `error_message` dessa geração tem **500 chars EXATOS** e termina cortado no
meio da palavra: `...runtime/triton_heu`. **Não foi o worker que truncou, fomos
nós:** `errorMessageComFase()` em `fase-telemetria.ts:205` faz
`(rawError||"").slice(0, 500)`. A truncagem é **head-first**, e num traceback do
Python o tipo/mensagem da exceção fica **no FIM**. Guardamos o boilerplate e
jogamos fora a causa.

Censo da truncagem: **7 de 85** falhas com erro batem no teto de 500. **6** são
`Failed to download <URL presigned longa>`, onde a causa está na **cabeça** e nada
se perde. A **7ª** é esta. O teto morde pouco — e **a única vez que mordeu apagou
a prova de um cartão**, que por isso passou 9 dias sem diagnóstico possível.

Família do **`#425`** (fechado na ronda das 15h40): lá a frase de conforto
sobrescrevia o erro cru; aqui o teto de 500 o decapita. Duas maneiras diferentes
de o chamado nascer sem a evidência.

**Despachado, não feito por mim:** card **`49add4ec`** no Mission Board, dono
`coder` — preservar **cabeça + cauda**, entrega por PR com base `main`. Conferi
**antes** de despachar que é seguro: a assinatura lê só os primeiros **120** chars
normalizados (`classify.ts:426-434`) e o título só a 1ª linha (`classify.ts:441`),
então acrescentar cauda depois do char 500 **não racha incidente** — que é a
patologia do "detector cego" de 24/08. **Estado no fim desta ronda: `running`,
sem entrega.** Não afirmo conserto nenhum aqui.

---

## §5. O cluster `#457`/`#458`/`#461` — e o critério que só se cumpria se o bug voltasse

Este é o item da ronda que eu levaria adiante mesmo se o resto tivesse dado em
nada.

Os três cartões são a **mesma noite** (17/09, 20:01→22:13Z): RunPod responde
`COMPLETED` e não vem arquivo. O `#457` (9 ocorrências, 3 alunos), o `#458`
(rajada do semeador) e o `#461` (a ocorrência que o **poll** viu e batizou de
`"unknown"`). Todos `investigating` há **9 dias**.

**O conserto está no ar desde 17/09.** O que segurava os cartões era o critério
que a ronda daquele dia escreveu neste próprio cartão:

> *"o que fecha este cartão: uma ocorrência de 'RunPod COMPLETED' criada DEPOIS
> de 2026-09-17T22:29:50Z com `request_attempts >= 2`"*

Rodei o instrumento da casa (`2026-09-17_runpod_completed_curou.cjs`) e ele diz,
**corretamente**: `INCONCLUSIVO — zero ocorrências novas desde o deploy`.

**Esse critério é uma armadilha.** Ele só pode ser satisfeito se o bug
**reincidir**. Um conserto que funciona perfeitamente mantém o cartão aberto
**para sempre** — e manteve, por 9 dias. É exatamente a patologia que a ronda das
15h40 acabou de fechar no `#425`: conserto **NO AR** e cartão dizendo
`investigating`, esperando alguém que nunca vinha.

**Troquei por prova POSITIVA, em três pernas independentes:**

| perna | medição |
|---|---|
| **a string casa** | `node --test src/lib/generations/erro-runpod-pure.test.ts` → **11/11 pass, 0 fail**, executado por mim, incluindo nominalmente *"(D1) o POLL grava a string compartilhada, não mais 'unknown'"* |
| **o reenvio DISPARA em produção** | **15** gerações com `request_attempts >= 2`, de 29/08 a **24/09 15:06Z**, **10** terminando `ready`. Exercitado por **irmãos da mesma lista** (`qa_coverage`, `executionTimeout`) pelo **mesmo caminho de código** |
| **os dois consertos estão no ar** | `execucao.ts:294` tem `"runpod completed"` (`95f36a67`) e `route.ts:167` chama `mensagemFalhaRunpod` (`f9f296d6`) — conferidos por `git cat-file -p origin/main:…`, **não** no working tree, **não** na mensagem do commit. Ambos **ancestrais** de `26623aad`, headSha do último deploy de produção com `success` (25/09 20:30:29Z) |

(a)+(b)+(c) = a string casa, o mecanismo que ela aciona funciona, e os dois estão
em produção. **A cura fica provada sem o bug precisar voltar.**

**Isto não é afrouxar a regra 14.** É substituir uma prova impossível por uma
prova positiva, e trocar o gatilho de reabertura para disparar em **evidência de
falha** em vez de exigir evidência de sucesso: *reabre se nascer ocorrência
casando `"runpod completed"` ou `"unknown"` com `request_attempts = 1`* — isto é,
a rede não pegou. Ocorrência nova **com** `attempts >= 2` **não** reabre: é a rede
funcionando.

### 5.1 O limite, dito na cara

Nenhuma ocorrência viva de `"RunPod COMPLETED"` exercitou o reenvio **para esta
string específica**. A perna (b) é por **composição** — irmãos da mesma lista,
mesmo caminho de código — não por um caso vivo desta string. Quem quiser chamar
isso de inferência está certo em chamar; eu chamo de suficiente, e deixo o
desacordo **registrado em vez de escondido**. O que não é defensável é manter 3
cartões abertos 9 dias esperando um bug reincidir.

**A causa de fundo não foi consertada, e não finjo que foi:** *cold start morrendo
antes de trabalhar* — falhas em **10,3–16,2s** contra sucessos em **135–223s**,
separação limpa, sem sobreposição. O que subiu foi a **rede** (reenvio automático
1x sem cobrar), não a eliminação do cold start.

### 5.2 Aluno e dinheiro — conferido um por um, não por amostra

- **`roseni.pimentel@gmail.com`** era a vítima real (2 gerações na vida, as 2
  falhadas, **zero áudio**, conta nova). **Ela voltou: 6 gerações `ready`**, a
  primeira em **18/09 19:00Z — no dia seguinte à carta** (uid 2733), a última em
  21/09 21:39Z. A nota de 17/09 deixou pendente *"se ela não voltar e não
  responder até 19/09, a ronda daquele dia cobra de novo"*. **Não precisa cobrar:
  o comportamento dela respondeu.** Esse laço fica fechado aqui — estava aberto
  há 7 dias.
- **`semeadorriquezas@gmail.com`**: **7 gerações `ready`** depois do episódio.
- **Dinheiro**: re-conferido pelo instrumento, que soma por `ref_id` **com sinal**
  e nunca por `kind` (armadilha de 20/08). Todo `ref` de soma negativa dos dois é
  **ENTREGUE** (row `ready` com arquivo) ou **débito órfão** (row apagada pelo
  próprio aluno — ordem de 20/08: **não é detector de bug**). **Zero crédito
  devido.** Mantive o NÃO ESTORNAR dos 425 do `b54c8045` e dos 623 do `27e9d0e5`.
- **Zero reincidência**: 0 ocorrências de `"RunPod COMPLETED"` e 0 linhas
  `error_message='unknown'` criadas depois do deploy, na tabela inteira.

---

## §6. Carta pra aluno: nenhuma, e por escolha medida

O `aluno_em_silencio` apontava `#452`, `#458` e `#461` por não terem carta. **Não
escrevi, e registrei o motivo em cada cartão** para ninguém achar que foi
esquecimento:

- **Flávio (`#452`)**: dinheiro de volta em **82 segundos** (conferido por
  `ref_type='generation_refund'` **casado com `ref_id`**, nunca por `kind`) e ele
  mesmo refez em **8 minutos** e recebeu o áudio. Carta 9 dias depois sobre um
  tropeço de 8 minutos que ele já resolveu é **ruído, não atendimento**.
- **Semeador (`#458`/`#461`)**: 7 áudios prontos desde então, dinheiro quite.
- **Roseni** já tinha carta em 17/09 e **voltou a usar o produto**.

A resposta certa aqui é **o motivo escrito**, não uma carta para zerar contador.

---

## §7. Pendências nomeadas (com dono e passo exato)

As do Johnny seguem **inalteradas** por esta ronda — não avancei nenhuma e não
finjo que avancei: `#439` (182 alunos / ~1.002.280 cr), `#426` (SGP: 3 decisões,
incl. e-mail em massa pras 349), `#551` (vence **03/10 12:00Z**), `#594`, `#263`,
`#249`/`#250`/`#589` (o *"pode"* do WhatsApp — **três** pedidos na mesma
pergunta), `#590`.

| # | o que falta | dono |
|---|---|---|
| `49add4ec` | o PR da truncagem cabeça+cauda. **`running`, sem entrega no fim desta ronda** | `coder` → revisão minha |
| — | **trava de concorrência na fila**: hoje não houve colisão, mas o desenho segue sem dono (4ª ronda nomeando) | Frank + **Johnny** |
| — | `2026-09-20_estornar_clipe_de_cena.cjs`: teto soma **menos** que o devolvido (diagnosticado em 15h40) | Frank |
| — | teto da 9-B virar **função única** no `_estornos.cjs` em vez de 3 implementações | Frank |
| — | classe *"a voz não parece comigo"*: **8 abertos**, parou de fechar em 13/09, e a casa **não mede fidelidade de identidade** (Vigia 16hZ §1.1). Não é cartão, é decisão de produto | **Johnny** |
| — | **70 PRs abertos**, o mais velho de 19/08 (38 dias); `#427` parado ~52h. Merge não é alçada de ronda | **Johnny** |
| — | os ~9 restantes do `aluno_em_silencio` | Frank (próximas rondas) |
| — | 8 reincidentes com aluno em cartão fechado — **estável há sete rondas, ninguém pegou** | Frank |
| — | instrumento `2026-09-23_referencia_de_despedida.cjs` **cego** desde 24/09 (Vigia 16hZ §3) | Frank |

## §8. Limite desta ronda, dito na cara

**Fechei 4 cartões, e 3 deles fecharam porque o conserto já estava no ar há 9
dias — o mérito é de quem consertou em 17/09, não meu.** Meu trabalho real foram
**a cadeia de prova** que permitiu fechar sem esperar reincidência, **a troca do
critério**, a **refutação** da hipótese do `#452`, e **achar a truncagem** que
destrói evidência.

O `#452` fechou como `ignored` (não-defeito acionável), não como `fixed`: não
consertei nada no caminho de geração, e marcar `fixed` seria mentira pela regra
14. O conserto que esta ronda produziu — a truncagem — **não é meu e não está
entregue**: está num card `running` do `coder` e vira PR, não commit meu na main.

E o padrão que aparece pela **segunda ronda seguida** merece nome: das 5 classes
que fecharam hoje (`#425` às 15h40 e as 4 daqui), **4 já estavam consertadas e só
não estavam fechadas**. O gargalo da casa não é consertar — é **fechar**. O
caçador de conserto parado (`#579`) **continua sem funcionar**, e por três rondas
seguidas quem achou foi a mão.

---

## §9. Passo fixo de fim de ronda — nada preso em branch

```
branch atual: main
git fetch origin && git log --oneline origin/main..HEAD  → conferido no commit desta ronda
```

Esta ronda **não criou branch nenhuma** — não toquei em código de produção. O
conserto da truncagem sai por branch `feat/erro-cru-preserva-cauda` + PR **pela
mão do `coder`**, com base `main`, como manda a ordem. Só o log vai direto na
main.

⚠️ Mesmo limite das rondas anteriores: a varredura cobre a **janela de 48h**, não
as ~300 branches locais. As STALE já documentadas no índice de ordens
(`feat/onedrive-401`, `fix/trava-foto-nova-8379549c`,
`fix/ritmo-da-referencia-porta-73a60bb`, `fix/estorno-treino-por-saldo-pendente`,
as 2 da cura de referência) seguem **não-mergeáveis**. Auditar as ~300 é tarefa
própria, não passo de ronda.
