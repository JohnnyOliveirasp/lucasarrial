# Ronda das falhas — 08/09 ~00h00–00h50Z (Frank, dono da fila)

**Card:** `#15` / `d3d8d1b2` — *"Geração de áudio: tempo de execução estourado"*
(`executionTimeout exceeded [fase: (sem fase instrumentada)]`), aberto **30/07**,
**39 dias**, 19 ocorrências, 18 alunos afetados, `investigating`.

**Escolhido por quê:** é o mais antigo da fila e o método é serial (`03_ROTINA.md` §8).

**O que NÃO fiz:** não fechei; não mexi em crédito, acesso, plano, GPU nem
migration; não escrevi para aluno (§6 explica por que nenhum precisava); não li a
caixa do `suporte@`; não ouvi áudio nenhum e não afirmo nada sobre som.

---

## §0 — A decisão de abertura: não esperar a próxima morte

A nota de 07/09 fechou com *"o que falta pra fechar: uma próxima ocorrência de
`executionTimeout` com o worker novo no ar"*. Conferi primeiro se ela tinha
chegado: **não**. Continuam **19** ocorrências, a última em **04/09 20:47:50Z** —
zero em 3 dias.

Esperar seria a 40ª diária sem medida nova. Então mudei a pergunta: **a patologia
só aparece em quem morre?** A resposta medida abaixo é **não** — ela está viva em
gerações que terminaram `ready`, com o `qa` inteiro gravado. O `#15` deixa de
depender de uma morte nova para andar.

---

## §1 — Subi a correção de telemetria de fase (PR #209 → `b55db26`)

Mergeado com squash em **`b55db26`**, branch `feat/15-fase-corrente-com-meta`
apagada. Autor: a ronda anterior. **Revisor: eu** (regra 14-B).

**Minhas verificações, rodadas do zero** — worktree limpa em `/tmp/rev209`, com
`npm ci` próprio (não confiei no que o PR reportou):

| verificação | resultado |
|---|---|
| `tsc --noEmit` | só o erro **pré-existente** de `vitest` em `resgate-audio.test.ts` (é o que o PR #185 trata) |
| `eslint` nos 4 arquivos | limpo |
| `node --test` fase-telemetria + telemetria-saida | **33/33** |

⚠️ **Armadilha do ambiente, que vale pra próxima ronda:** `NODE_ENV=production`
está setado no shell, e com ele `npm ci` **pula as devDependencies** — `typescript`
e `eslint` simplesmente não existem em `node_modules`. O `npx tsc` responde *"This
is not the tsc command you are looking for"*, que é fácil de ler como problema do
projeto. Instale com `NODE_ENV=development npm ci --include=dev`. Uma ronda com
pressa concluiria "não dá pra verificar" e mergearia no escuro.

**O que revisei de COMPORTAMENTO** (`tsc` verde não é revisão — regra 14-B):

- **A assinatura não estilhaça.** Era o risco real: sufixo variável no
  `error_message` viraria *um incidente por chunk* e destruiria a fila.
  `stripFaseSuffix` casa até o 1º `]` e o sufixo novo (`chunk=`/`attempt=`) não tem
  colchete dentro; `errorSignature` de dois sufixos diferentes bate com a do erro
  cru. Tem teste dedicado.
- **Worker antigo continua idêntico.** A rota só cria a chave quando há meta
  (`if (meta) fase.meta = meta`), então não nasce `meta: null` em row nenhuma.
- **Não vaza texto do aluno.** `META_NO_SUFIXO` é só `["chunk","attempt"]`; `chars`
  é comprimento, não conteúdo.
- **Meta velho não gruda.** A rota monta a `fase` do zero a cada heartbeat e
  `qaComFase` substitui `fase_corrente` inteira — fase sem meta não herda o meta da
  anterior.

**Observação que deixo registrada, e que não é bloqueio:** `_meta_serializavel`
aceita `float`, e `cfg=cfg_value` (`float | None`) viaja no meta de
`inference.chunk.generate`. Um `NaN` ali sairia como `NaN` no `json.dumps` e o POST
morreria no parse do lado de cá. Hoje `cfg_value` vem da config e o heartbeat é
best-effort dentro de `try/except` — não toca job nem estorno. Mas se alguém puser
float calculado no meta de um `phase()`, é aqui que quebra em silêncio.

**Deploy:** os dois workflows dispararam em `b55db26` às **00:06:02Z** —
`Deploy Frontend (production)` e `Build RunPod Worker` (este último é o que
importa: sem a **imagem nova do worker** o campo `meta` não chega e a row continua
como hoje). Resultado conferido no runner, não no card: **§7**.

---

## §2 — A régua (teto) não é a causa — agora medido com a régua honesta

Todas as contas de margem deste card, **inclusive a minha de 06/09** ("folga de
194s"), usaram `generations.elapsed_seconds`. Esse campo é **setup-cego por
desenho**, e o próprio código diz (`jobs/inference.py:64-73`): o `t0` só começa
**depois** do setup, enquanto o `executionTimeout` corre sobre o job **inteiro** —
"o p99 de 271s que calibrou o teto de 8min saiu de 1.186 linhas desse campo
setup-cego".

Agora dá pra fechar o buraco: **`qa.setup_s` existe em 123 gerações `ready`**
(desde 05/09).

| medida | valor |
|---|---|
| setup mediano | **72,6s** (p95 94,2 · máx 106,3) |
| fração do tempo real que é setup (mediana) | **37,2%** |
| ocupação do teto com `setup + trabalho` (n=123) | mediana **31,6%** · p95 54,4% · **máx 62,9%** |

Teto real: `max(480, 300 + chunks*30)` s (`execucao.ts`).

**Contraprova no histórico** — 2.781 gerações `ready` desde 01/08, perguntando
quantas caberiam no teto de HOJE:

- só com o trabalho: **0** estouram;
- somando o setup mediano (72,6s): **1** estoura, por 52,3s.

**Uma em 2.781.** Minha refutação de 06/09 **sobrevive** à correção do setup: o teto
não é o que mata. Mas a margem que eu reportei era otimista — não existem "194s de
folga"; existe um **pior caso saudável a 62,9% do teto**.

---

## §3 — A tempestade de regen (minha hipótese líder de ontem) é limitada por código

Refuto minha própria hipótese de 07/09, e o argumento é do código, não de opinião:

`tts_qa/loop.py:271` →
`max_attempts = max(start 2, echo 3, coverage 3, intrusion 3, rate 2)` = **3**
(defaults em `jobs/tts_settings.py:194-230`). O laço quebra em
`attempt >= max_attempts`, então saem **no máximo 2 regens por chunk** dele. Os
`regens` altos que eu medi ontem (31, 38, 51) vêm do **resgate de cobertura por
sub-frase**, que só existe em texto com muitos chunks.

`TTS_CHUNK_MAX_CHARS = 160` → um texto de **78 caracteres é UM chunk**. Teto de
regen ali: **2**. Esse é exatamente o caso de 23/08 (`2e2938b7`, janetecasarotto2)
que morreu em **1.812s**. Não existe laço de regen que produza isso.

**O que continua valendo:** a dose-resposta que medi ontem explica o tempo dos
**saudáveis**. Ela **não** explica as mortes.

---

## §4 — Contenção com treino: refutada como causa da cauda

Primeiro uma **correção do fato estrutural** que a nota de 07/09 registrou como "só
o endpoint A": não é só. Desde 01/08 os treinos se dividem entre os **dois**
endpoints de inferência — **400 em `-e1`, 423 em `-e2`** (n=823). Não existe grupo
de controle por endpoint.

Teste temporal, **mesmo endpoint**: geração `ready` cuja janela
`[created_at, created_at + elapsed + 120s]` cruza um treino de mesmo sufixo,
contra as que não cruzam.

| | n | mediana s/chunk | p99 | máximo |
|---|---|---|---|---|
| com treino junto | 224 | **17,4** | 72,4 | **82,6** |
| sem treino | 2.475 | **13,7** | 80,2 | **459,7** |

Treino junto deixa tudo **+27% mais lento na mediana e não produz a cauda** — o p99
e o máximo são MENORES com treino. Os casos extremos acontecem com o endpoint sem
treino nenhum rodando. Contenção é real e é pequena; não é o que mata.

---

## §5 — O achado: a patologia está viva em quem terminou bem

Sem viés de sobrevivente, porque estes **são** os sobreviventes:

- **`7dfecacd` (14/08): 35 caracteres, 1 chunk, 459,7s — e saiu `ready`.**
  Sobreviveu porque o teto ainda era de 30 min. Sob o teto de hoje (480s) somado ao
  setup, essa geração seria mais uma linha do `#15`.
- **`5de8e601` (24/08): 78 caracteres, `regens = 0`, 169,9s.** Zero regeneração e
  ainda assim 11× a mediana do tamanho dela.

Base: **609** gerações `ready` de 1 chunk desde 01/08 — mediana **15,5s**, p99
111,0s. **26 (4,3%) passam de 79s** e **2 passam de 155s** (10× a mediana).

### A armadilha que eu quase publiquei

Cheguei aqui por "segundos por chunk", e **26 dos 28 piores eram texto de 1 chunk**
— o que tem cara de artefato, porque existe custo **fixo por job** dentro do
`elapsed`. Fui medir antes de escrever: regressão `elapsed ~ chunks` nas 2.781
`ready` dá **fixo = 22,7s** e **10,2s por chunk** (r² 0,324). 22,7s **não** explica
1 chunk levando 80–460s. O achado sobrevive — mas quem repetir a conta **use a
regressão, não o s/chunk cru**, senão vai reportar como defeito o custo fixo de
todo mundo.

---

## §6 — Dinheiro e aluno: nada novo, e por isso não escrevi para ninguém

Zero ocorrência nova desde **04/09 20:47Z**. Os dois casos instrumentados
continuam com líquido **zero** (conferido na ronda anterior por `ref_type =
generation_refund`, nunca por `kind`), os dois alunos seguiram gerando sem falhar,
e ninguém está esperando resposta. Não mexi em saldo de ninguém.

---

## §7 — Resultado do deploy

_(preenchido no fecho da noite, 08/09 ~01:20Z — a ronda não voltou pra fechar esta seção)_

⚠️ **Este arquivo nasceu com o MESMO nome de outro** (`2026-09-08_rotina_falhas_00h.md`,
a ronda do `#237`), que foi commitada em `5f86946`. Renomeado para `_15` no fecho da
noite; sem isso um dos dois registros era perdido no primeiro `git add`.

| workflow | sha | conclusão | fim |
|---|---|---|---|
| Deploy Frontend (production) | `b55db26` | **success** | 00:08:48Z |
| **Build RunPod Worker** | `b55db26` | **success** | **00:35:58Z** |
| Deploy Frontend (production) | `d2dc5fa` (PR #210) | success | 00:49:46Z |

`BUILD_ID` no servidor: `g6f-cPG2G50TlGTCcV0hy`, gerado **08/09 00:48:44Z** — depois do
último merge (00:46:55Z). Conferido no Hetzner, não no card.

**Mas o campo novo ainda NÃO foi visto em produção, e n=1 não decide nada.** Desde
00:36Z (fim do build do worker) rodou **1** geração, às 00:49Z, e ela **não** traz
`qa.fase_corrente.meta`. Isso é compatível com três coisas que não sei separar com uma
linha: o endpoint ainda não trocou de imagem; a fase gravada no fim simplesmente não
tem meta (a rota só cria a chave quando há meta); ou o worker já é o novo e a amostra
é cega. **Não afirmo que a telemetria está no ar.** A próxima ronda mede com n que
preste antes de contar com o `chunk`/`attempt` pro `#15`.

---

## §8 — O que a próxima ronda faz, e não é esperar

1. **Terceira leitura do `chunk`, que não está na tabela do PR.** O PR #209
   documenta duas: `attempt` alto + `running_s` baixo = regen; `attempt` baixo +
   `running_s` alto = hang num chunk. Falta a que importa aqui: **`chunk` baixo com
   total alto = o tempo foi antes/em volta dos chunks**. Em `a07e9278` a fase já era
   `inference.chunk.generate` (setup fechado) com `running_s = 4,9` — vivo e
   progredindo. Sem o número do chunk não dá pra separar "9 chunks devagar" de
   "parou em um", e §3 e §4 já tiraram regen e contenção da mesa.
2. **Trabalho que não depende de morte nenhuma:** as **26** gerações `ready` de 1
   chunk acima de 79s têm o `qa` inteiro gravado. É o mesmo defeito num corpo que
   não morreu — comece por `7dfecacd` e `5de8e601`.
3. **Migration 82** continua não aplicada (aguarda Johnny). O `#15` **não depende
   mais dela** pra andar: ela responde fila × cold start, não a pergunta de agora.

---

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#15` fechado | **não** — de propósito. Falta a leitura de `chunk`/`attempt` numa próxima ocorrência **ou** a autópsia dos 26 sobreviventes lentos (§8) |
| Migration 82 | não aplicada, aguarda Johnny |
| `NODE_ENV=production` no shell esconde `tsc`/`eslint` | **nova** — §1 |
| `float`/`NaN` no meta do `phase()` quebraria o POST do heartbeat | **nova** — §1, observação sem bloqueio |
| "só o endpoint A tem treino" | **corrigido** — treino roda nos dois (§4) |
