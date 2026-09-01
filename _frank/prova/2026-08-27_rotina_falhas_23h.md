# Rotina das Falhas — 27/08/2026, ronda das 23h UTC (dono da fila)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Papéis (regra 14-A): o Vigia abre e anota; eu investigo, decido e fecho.
`git checkout main && git pull --ff-only origin main` → trouxe 3 commits.
Índice de ordens lido antes de tocar em qualquer coisa. Ordem vigente do
assunto: `2026-08-27_vigia_so_erro_de_sistema.md` (14-C).

## Placar

| | |
|---|---|
| Abertos no início (sem `aguardando_aluno`) | **7** |
| Abertos no fim | **7** (fechei o `#160`, abri o `#165`) |
| **Fechados nesta ronda** | **1** — `#160` |
| **Alunos que passaram a ter resposta** | **1** (Telma) |
| **Chamado novo com causa no código** | **1** (`#165`) |
| **Afirmação de ronda anterior derrubada por medição** | **2** (as duas no `#156`) |
| Escalado ao Johnny na hora | **2** (migration 97, `#165`) |
| Crédito / GPU / migration / merge / e-mail em massa | **nada tocado** |

---

## 1. Qual incidente peguei, e por que não foi um dos mais velhos

A regra 8 manda pegar o mais antigo **com aluno afetado**. Conferi um a um em
vez de herdar o veredito da ronda anterior — e a lição das 22h é exatamente
essa (nesta base, 5h bastam pra uma afirmação virar mentira):

- **`#11`** (37,0 dias, 3 alunos) — os 3 afetados estão apurados e **nenhum
  espera**. Reconferi a trava: `trainer_returncode`, `trainer_stderr` e
  `trainer_stdout` **continuam não existindo** em `training_jobs`
  (`information_schema` devolveu zero linhas). Migration `scripts/97` segue não
  aplicada. **Passo em que travou: aval do Johnny.** Escalei de novo (§6).
- **`#99`** (Luciano) — parou às 22:25Z esperando o **Johnny ouvir** os dois
  áudios que foram mandados pro Telegram (msgs 505/506). A bola não é minha.
- **`#120`** (Sandra) — respondida hoje 16:49Z (Enviados uid 195, conferido). O
  que falta é decisão de reembolso **do curso**, que é do Lucas/Johnny.
- **`#151`** (Zethe) — tratada às 22h, respondida 21:48Z, PR #75 em aval.
- **`#153`** (5 alunos) — causa medida, **PR #73** em aval.
- **`#161`** — **saiu da fila**: fechado 22:23Z, backfill `scripts/98` aplicado
  com aval do Johnny. Um a menos, e não fui eu.

Sobrou **`#160`**: aberto 18:41Z, **`open`**, **zero notas**, **sem dono
nenhum** desde que nasceu, com aluna esperando. Peguei este. É o único da fila
em que a bola estava inteiramente comigo.

## 2. A primeira coisa que conferi foi o estado da aluna — e ela não está travada

Regra: *"já resolveu sozinho? é o caso mais comum"*. Aqui foi meio caso.

Telma (`telma@centia.com.br`, acesso ativo até 20/09, 101.607 créditos)
**passou a tarde inteira produzindo**: 5 áudios, 5 imagens, 2 Vídeos Clone,
2 lotes de cenas, o último entregue **20:16Z**. O produto funciona pra ela e
ela não está bloqueada por defeito nenhum.

**O que estava travado era só a resposta.** E aí achei o que ninguém tinha
olhado:

| | |
|---|---|
| e-mails já enviados pra ela | **ZERO** — `ler_caixa --enviados --para` devolveu *"nada encontrado"* |
| promessas de e-mail feitas pelo bot do app | **2** — 15:25Z (*"Eles vão te responder por e-mail"*) e 18:41Z (*"Chamei a equipe pra te dar uma resposta mais completa"*) |
| espera até o meu e-mail | **~7h30** |

Dois chamados abertos (`#156` e `#160`), duas promessas de e-mail, e nenhum
e-mail. É o mesmo padrão que fez a Viviana explodir.

## 3. A pergunta dela tinha resposta definitiva, e a resposta é "não existe"

Palavras dela, 18:40Z, em `/app/videos/clone`:

> *"beleza, mas meu clone não se movimenta, preciso dele com mais energia"*

**Abri o código antes de responder**, em vez de mandar dica genérica:

- `api/v1/video-clone/route.ts` — o POST aceita `{ image_key, audio_key, tier }`
  e nada mais;
- `lib/video-clone/config` — `tier` mexe em **qualidade e custo**
  (`cloneCreditsCost` / `getCloneTier`), não em movimento;
- `lib/video-clone/workflow.ts` — **não existe** parâmetro de movimento,
  expressão ou pose. O único "motion" é um colchão **fixo** de frames
  (`duração × 25 + 25`, linhas 79-80).

**Não existe controle de movimento corporal ou energia no Vídeo Clone.** É foto
parada + lip-sync (InfiniteTalk). Disse isso a ela com estas palavras, sem
inventar configuração escondida — que é justamente o defeito do `#164`, onde
seis caminhos foram inventados pra um botão que existe com outro nome.

**Conferi o bot antes de contradizer, e não contradisse:** a resposta que ele
deu às 18:40 ("o Vídeo Clone foca no lip-sync, o movimento é mais sutil") estava
**certa no mérito**. O erro dele não foi o conteúdo, foi prometer e-mail que
ninguém mandou.

Pelo teste da 14-C — *"se o código estivesse certo, isso não teria acontecido?"*
— a resposta é **não**. É limitação de produto, respondida. Não é bug.

## 4. Investigando a metade de VOZ, derrubei a causa que estava no `#156`

O `#156` é da **mesma aluna** (e o `description` dele carrega literalmente o
mesmo texto de movimento corporal do `#160` — a Fast cruzou os dois). Fui olhar
a queixa de voz dela e a nota das 17:58Z afirmava:

> *"o QA reprovou 8 a 14 vezes, esgotou, e entregou com 7-12% do texto faltando.
> É a classe do `#52`"*

**Dois pedaços disso não se sustentam.** Li o payload `qa` inteiro:

| geração | regens | `coverage_flagged` | `rate_flagged` | stretch | wps | fator |
|---|---|---|---|---|---|---|
| 13:25 `a8238484` | 14 | **0** | 14/14 | 1 | 3.35 | **0.90** |
| 14:22 `36aa5638` | 8 | **0** | 8/9 | 1 | 2.97 | **0.90** |
| 14:40 `b9de82a6` | 11 | **0** | 11/12 | 1 | 3.22 | **0.90** |
| 19:18 `2c7f425a` | 2 | **0** | 2/2 | 1 | 4.09 | **0.90** |
| 19:24 `1dcc56cf` | 2 | **0** | 2/2 | 1 | 3.28 | **0.90** |

**(a) A cobertura nunca reprovou.** `coverage_flagged = 0` nas cinco. Nenhuma
regeneração foi por texto faltando — todas foram do **QA de ritmo**. Logo **este
caso não é a classe do `#52`**, e mandar quem for tratar isso pro `#52` é mandar
pro lugar errado.

**(b) "7-12% do texto faltando" infla o que o campo diz.** `coverage_min_visto`
é o **pior pedaço**, não o áudio inteiro — está escrito na fonte
(`tts_qa/loop.py:114-117`). Na `b9de82a6` o `coverage_medio` é **0.9807** com
`coverage_medido_n = 6`. Ler o mínimo como se fosse o total é a mesma família de
erro do `#152` (casar por timestamp): o número existe, a leitura é que estava
larga. **Eu mesmo quase repeti essa leitura** antes de abrir o payload.

**A causa que eu cravo, com `arquivo:linha`:** `inference.py:167-168` faz
`fator = max(rate_qa_max_stretch, target/medido)`, e o teto
`TTS_RATE_QA_MAX_STRETCH` é **0.90** (`tts_settings.py:194`). Fator **0.90
cravado nas cinco** significa que `target/medido` era **menor** que 0,90 em
todas: o sistema desacelerou até o limite que tem permissão e **ainda** achou
rápido. O *"come palavras"* dela **tem número por trás** e não é impressão.

**O que eu não afirmo:** que é isso que faz soar "sem expressão". **Não ouvi os
áudios**, e ouvido humano não é veredito meu.

## 5. O achado que é maior que ela — chamado `#165`

A régua primária do QA de ritmo é `voices.speech_rate_wps`, e a docstring do
`tts_qa/rate.py:8` diz que ela é *"medida no treino"*. Na voz da Telma
(`9d753bec`, treinada hoje 12:17) ela é **NULL**. Fui medir a base:

| | |
|---|---|
| vozes no total | **1.012** |
| com `speech_rate_wps` | **2** (0,2%) |
| **NULL** | **1.010** (99,8%) |
| entre as `ready` | **911 de 913** NULL |
| treinadas desde 25/08 | 57, das quais **2** têm |

E as 2 que têm foram gravadas em **25/08 03:19 e 03:20** — janela de 1 minuto,
cara de preenchimento manual, não de pipeline.

**Motivo: nenhum código escreve a coluna.** Varredura no repo (`.ts`/`.py`/
`.sql`, fora de `node_modules` e testes): **3 leituras**
(`generate/route.ts:123` e `:217`, `tts_settings.py:196`) e **ZERO escritas**.

Consequência, lida em `inference.py:133-136`: sem a coluna, o alvo vira
`measure_file_rate(...)`, que remede a referência com **whisper a cada job**.
Ou seja **o caminho principal nunca existiu na prática** — 100% das gerações
rodam no plano B, e ninguém sabia.

**População** (desde 24/08, `ready` com telemetria): 189 gerações, **176 (93%)**
com `rate_flagged`, **129 (68%)** com time-stretch, wps médio 3.04, 8-9 regens
por geração. Por dia: 25/08 60,6% · 26/08 69,7% · 27/08 70,2%.

**Limite honesto, e ele importa:** essa telemetria **só existe desde 25/08** (o
instrumento nasceu em 26/08, `loop.py:107-112`). **Não tenho linha de base
anterior**, então **não afirmo** que isso é regressão nem que piorou. E **não
afirmo** que o fallback está errado: ele é caminho desenhado. O que está errado
é rodar 100% no plano B sem ninguém perceber.

**As 3 checagens da 14-C, feitas antes de abrir:** (1) classe nova — na fila só
existe o `#155`, `ignored`, e é outro assunto; (2) `git log origin/main` e os
**22 PRs abertos** — nenhum toca a coluna; (3) não envolve dinheiro.

## 6. O que eu fiz, com a prova

1. **E-mail à aluna** — uid **219**, **22:49:35Z**, bcc suporte@, **conferido na
   pasta Enviados depois do envio**. Cobre as 3 perguntas dela do dia. Dei a
   alavanca **real** com o nome exato da tela (lição do `#164`, não inventar
   rótulo): controle **"Ritmo" → "Mais calmo"** (`pt-BR.json:1451-1454`), que
   aplica `speech_rate_factor` 0.85 (`generate/route.ts:96`) e baixa a régua em
   15%. As 5 gerações dela foram todas no "Normal". **Não prometi data, não
   prometi correção, não prometi reembolso.**
2. **`#160` fechado** `fixed`, com `resolution_note` dizendo o que era e o que
   fiz. **Sem commit: não houve mudança de código** — e por isso não inventei um.
3. **`#156` anotado** (4ª nota) com a correção das duas afirmações e a causa
   nova. Status mantido `aguardando_aluno` — a bola virou dela.
4. **`#165` aberto** (`8347af4b`), pelo script
   `_Bugs/2026-08-27_frank_23h_abre_speech_rate_wps.cjs`, **ensaiado antes de
   gravar** (rodei sem `--confirmar` primeiro e li o que ele ia inserir).
   ⚠️ **Correção de uma frase que eu já tinha escrito errada:** eu tinha posto
   aqui que o script estava "versionado". **Não está** — `_Bugs/` é
   `.gitignore`, o `git add` recusou, e eu só descobri na hora do commit. É a
   mesma família do §8 da ronda das 22h (ferramenta que existia só num working
   tree). O prejuízo é baixo **porque o conteúdo inteiro do script está na
   `description` do `#165`, no banco** — que é o que alguém vai ler de qualquer
   jeito. Registro em vez de calar, e não deixei a frase falsa entrar no commit.
5. **Telegram msg 512** (grupo, regra 7, só fato consumado) e **msg 513**
   (Johnny, as duas decisões).

## 7. Decisões que são do Johnny

1. **Migration `scripts/97`** — trava o `#11` há **37 dias**. Reconferida hoje:
   segue não aplicada. DDL puramente aditivo. A `98` foi liberada hoje às 22h; a
   97 é mais velha e mais barata.
2. **`#165`** — consertar a régua muda o **som entregue a 913 vozes de uma vez**.
   Pedi ciente, **não pedi execução**: sem um A/B ouvido por gente, isso é
   exatamente a mudança às cegas que deu errado no Kessuly (24/08, 93 vozes
   "muito pior").
3. **22 PRs abertos**, o mais velho de 18/08. Três destravam chamado aberto
   (#73 → `#153`, #74 → `#157`, #75 → `#151`/`#164`).
4. **Luciano (`#99`)** — os 2 áudios estão no Telegram desde 22:25Z esperando o
   ouvido dele.
5. **Sandra (`#120`)** — reembolso do curso, prazo alegado **30/08**.
6. **Marlon (`#154`)** — promessa de reembolso feita 14:30Z, chamado fechado,
   sem dono (objeção do Vigia às 22h).

## 8. O que eu NÃO fiz

Não mergeei PR nenhum. **Não apliquei migration** — em particular **não a 97**.
Não gastei GPU, não retreinei voz, não gerei amostra, não refiz áudio. **Não
toquei em crédito**: conferi o extrato da Telma por `ref_type` (nunca por
`kind`) — débitos 786 + 664 + 808 = **2.258** nas três longas e **zero** linhas
`generation_refund` — e **não estornei**, porque não há crédito indevido: as
cinco entregaram áudio e passaram a régua de cobertura (`coverage_qa_min` 0.85,
`coverage_flagged` 0). Se o Johnny quiser compensar por qualidade, é decisão
dele. Não mandei e-mail em massa — **um** e-mail individual, do caso que eu
estava tratando (regra 8). Não li a caixa do suporte@ para triagem: só
`--enviados --para` nos endereços da Telma e da Sandra. Não mexi em cron nem em
ordem. Não fechei o `#160` como duplicata do `#156` — responder e depois fechar
foi o contrário do buraco que quase orfanou o Luciano em 23/08.

## 9. Uma falha de ferramenta, registrada

`mission-cli.js` **não roda nesta máquina**: aborta com `DB_ENCRYPTION_KEY is
missing or too short` (`FrankClaw/dist/db.js:17`). Ou seja o card desta ronda
**não foi criado no Mission Board** — registro aqui em vez de deixar passar em
silêncio, que é o padrão que a ordem cobra. O log e os incidentes seguem sendo
a fonte de verdade da ronda.

## 10. Para a próxima ronda

1. **Telma (`#156`)**: ela testou o "Mais calmo"? Se ainda soar sem emoção
   **depois** disso, é outro caminho — e aí precisa de ouvido humano, não de
   mais medição minha.
2. **`#165`**: ninguém deve mexer na régua antes do A/B ouvido. Se alguém for
   tocar, ler o §5 inteiro primeiro, principalmente o limite de linha de base.
3. **`#11`**: se a 97 for liberada, aplicar e **conferir a coluna no banco** —
   DDL commitado não é DDL aplicado.
4. Conferir se **Ronald, Cássio, Sandra e Luziélia** responderam.
5. O `#52` continua devendo a prova real: refazer o texto do **Ronald** por conta
   da casa. Gasta GPU, não é minha alçada.
