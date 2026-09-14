# 14/09 ~15hZ — Rotina das falhas

Método serial (regra 8, ordem de 21/08): peguei **um** incidente e levei até
onde dava, em vez de varrer a fila.

## Qual peguei, e por que não foi o mais velho

Fila: **82 abertos** (1 com 30d+, 4 entre 15-30d, 26 entre 7-15d).

O mais velho é o `d3d8d1b2` (46,1d, timeout de geração). **Não peguei**, por
dois motivos que estão escritos na própria ordem de 20/08: ele está parado por
**decisão do Johnny com aceite de risco**, todos os alunos seguem cobertos por
estorno automático (ninguém esperando resposta), e o próximo passo declarado
— instrumentar o handler pra saber em que fase o chunk pendura — **exige
observação de dias, não de uma sessão**. Pegá-lo garantiria não fechar nada.

Peguei o **`ce6e157d` (Katia, 26,1d)**: é o mais antigo com **aluno esperando
de verdade**, ela já tinha desistido por escrito, e o relógio dela vencia em
21 horas. Prioridade declarada: aluno esperando vem antes da limpeza da fila.

## O que era, de verdade

A queixa dela desde 19/08 é sempre a mesma: *"as frases terminam como se
estivessem no meio, não há finalização"*. A casa tratou isso **três vezes**
como dois defeitos que não eram o dela:

1. **Pacing** (21/08) — a voz nascer com a pausa de quem gravou.
2. **Palavra decapitada / `#234`** (02/09 em diante) — corte na fronteira.

**Os dois estavam errados para o caso dela**, e dá pra provar:

Rodei o `cauda_decepada.cjs` (com `--ensaio` aprovado nos 3 arquivos de
referência antes de apontar pra base) nas gerações dela de 09/09 e 13/09.
A régua do `#234` **não marca nenhuma**. Cada arquivo tem **uma** fronteira, a
do fim, e todas limpas:

| geração | data | release | platô |
|---|---|---|---|
| `ed61d09c` | 13/09 | 125 ms | -49,4 dB |
| `60cf27fa` | 13/09 | 175 ms | -56,4 dB |
| `b6df1a7e` | 09/09 | 190 ms | -51,5 dB |

Não há decapitação interna nem terminal. O passo 2 do recado (*"se não marcar,
então é fim-de-áudio"*) também dá negativo: o fim decai normal.

**O defeito é a pausa que não existe.** Contei corridas de silêncio digital
(piso -90 dB, janela 20 ms) e a previsão feita a partir do **texto** bate com o
**áudio** nos quatro casos:

| geração | texto | pausas medidas |
|---|---|---|
| `1498fbe5` Katia 02/09 | 5 quebras de parágrafo | **5**, de ~760 ms |
| `ed61d09c` Katia 13/09 | 4 frases em linha única | **0** |
| `879a9a0e` outro aluno 14/09 | 2 frases, sem quebra | **0** |
| `06e8c51e` outro aluno 14/09 | 2 frases, sem quebra | **0** |

`pausas = número de quebras de parágrafo`. Nada mais no sistema produz pausa.

## Por que, no código

1. `tts_text.py:split_text_for_tts(max_chars=160)` **emenda frases**: enquanto
   couber em 160 chars, gruda a próxima no mesmo chunk. O texto dela tem 121
   chars → **1 chunk só** → nenhuma junção → nenhuma pausa.
2. `jobs/inference.py:561` — o silêncio entre chunks exige
   `silence_ms > 0 AND crossfade_samples == 0`. Em produção `silence_ms=0` e
   `crossfade_ms=60` (`tts_settings.py:236-237`). **O ramo nunca dispara.**
   Consequência: o pacing por voz (`080dd74`, `voice_pipeline/pacing.py`,
   `train.py:86`) é **código morto em produção** — nenhuma voz consegue pausa
   por esse caminho, tenha `tts_silence_ms` medido ou não. Todo o trabalho de
   21/08 não podia ter efeito nenhum.
3. `jobs/inference.py:555` (`par_pause_ms`) é o **único** mecanismo vivo, e só
   dispara em `ends_paragraph`.

Detalhe conferido no banco: a voz dela (`c127b74e`) está com `tts_silence_ms`
**NULO** hoje, apesar da nota de 21/08 afirmar ajuste manual de 220 → 466. O
ajuste não está lá. Mesmo que estivesse, pelo item 2 não teria efeito.

Rodei o splitter **real** (execução, não leitura de código) no texto dela:

| como digitar | chunks | pausas |
|---|---|---|
| linha única (como ela fez) | 1 | 0 |
| quebra de linha simples `\n` | 1 | 0 |
| **linha em branco `\n\n`** | **4** | **3** |

Quebra simples **não resolve** — parágrafo é separado antes do empacotamento
guloso. Isso importa porque é o contorno que se passa ao aluno: dizer "quebre a
linha" seria instrução errada.

## Alcance: não é o caso de uma aluna

Rodei o splitter real sobre as **2.041** gerações `ready` com texto desde 15/08
(paginado de 1000 em 1000 — o PostgREST corta em 1000 em silêncio):

- **1.671 gerações = 81,9%** com ao menos uma fronteira de frase sem pausa
- **441 de 489 alunos = 90,2%**
- **8.434** fronteiras de frase mudas

O `#234`, que a casa vinha perseguindo, pega 14,3% e 237 alunos. Este é ~6x
mais amplo e é o que de fato sustenta a queixa histórica de "áudio corrido".

Alunos já tentaram contornar sozinhos, e está no dado: há texto com `[pausa]`
digitado no meio e há texto com quebra de linha simples (que não funciona).

## O que fiz

- **Escrevi pra aluna** (14/09, uid 2250 confirmado nos enviados) com a causa
  real, o contorno que funciona hoje (linha em branco), o aviso explícito de
  que quebra simples não serve, e a ressalva de que isso **não** corrige
  `Bem-vinda` → `Bem-vindo` nem `para` → `pra`. Não prometi prazo nem dinheiro.
- **Anotei o `ce6e157d`** com a medição inteira (66 notas, gravação conferida
  na releitura, 1 linha afetada).
- **Abri o `#393`** (`a75b68cd`) para o defeito de produto, com as duas opções
  de conserto descritas.
- **Apaguei o recado** `para_frank_ce6e157d` com `DELETE` e conferi a releitura
  em 0 (o `update value=null` volta 23502 e deixa a chave).
- **Postei no grupo**: causa, alcance e as duas decisões do Johnny.

## O que NÃO fiz, e por quê

- **Não mexi no splitter.** Parar de emendar frases multiplica chamadas de
  `generate` (o texto dela vai de 1 para 4). Em 2.041 gerações isso é decisão
  de custo de GPU e de tempo de resposta — do Johnny, não minha.
- **Não gastei GPU** refazendo áudio dela.
- **Não marquei `fixed`.** O defeito de produto segue em produção. Contorno
  entregue não é conserto (regra 14).
- **Não prometi** extensão de acesso nem compensação: é dinheiro, é do Johnny.

## Pendente, com relógio

O acesso da Katia vence **15/09 12:00Z** (21h a partir desta ronda). Status
`canceled`, **176.820 créditos** parados (174.665 assinatura + 2.155 extra),
315,90 GBP pagos, 26 dias de queixa num defeito nosso diagnosticado errado três
vezes. Se for pra estender ou compensar, é hoje. Levado ao grupo.

## Lição

Três diagnósticos seguidos erraram porque mediram **o defeito que a casa já
sabia procurar** (decapitação, pacing) em vez do que a aluna descreveu
(*"não há finalização"* = ausência de pausa). O que desempatou foi medir a
coisa mais boba possível: **contar os silêncios** do arquivo dela e comparar com
o texto. O `#234` é real e continua real — só não era o caso dela.

Segundo: um conserto pode ser **estruturalmente incapaz** de funcionar e ainda
assim ser reportado como entregue. O pacing de 21/08 está no código, tem módulo,
tem teste e tem commit — e nunca pôde produzir uma pausa sequer, porque um `if`
duas camadas abaixo exige `crossfade == 0`. Commit não é produção, e código vivo
não é código com efeito.

## Estado do repo ao fim da ronda

`git log origin/main..HEAD` vazio, `main` = `origin/main` = `bb44654`, e este
log conferido dentro do `origin/main`. Havia mudanças **não commitadas** no
diretório (SGP: `painel.ts`, `types.ts`, `cobranca.ts`, `compradores.ts`,
`route.ts`, `page.tsx`) que **não eram minhas** e que eu **não toquei**.

## Adendo: caí na MESMA armadilha que o vigia caiu 1h antes

Registro porque é erro meu e porque é a segunda vez no mesmo dia.

Abri a ronda com `git checkout main` e conferi `origin/main..HEAD` vazio. No
meio da ronda o clone compartilhado foi parar em **`feat/sgp-concluir-atendimento`**
(outro agente commitou `7102524` ali enquanto eu media áudio). Commitei meu log
sem reconferir a branch: ele foi parar **em cima do trabalho do outro agente**, e
o `git push origin main` empurrou o ref local `main`, que não tinha meu commit.
**O log não chegou no origin.** O `echo PUSHED` saiu, o que torna o erro pior:
o comando "deu certo" e mesmo assim a entrega não aconteceu.

Quem pegou foi exatamente a conferência que a ordem manda fazer no fim
(`origin/main..HEAD` tinha que sair vazio e saiu com 2 linhas). É a segunda vez
hoje que essa conferência é a única coisa entre "ronda registrada" e "ronda
perdida" — o vigia documentou o mesmo em `fd8aacf`, às 14hZ.

Correção, sem `reset --hard` e sem tocar em working tree alheio:
1. `git worktree add /tmp/wt-main-ronda main` e **cherry-pick** do meu commit
   lá dentro, pra não disputar o checkout com o outro agente → `bb44654`.
2. `push origin main` e reconferência (`origin/main..main` vazio).
3. Worktree removida e `feat/sgp-concluir-atendimento` devolvida com
   `branch -f` pro `7102524` que o origin já tinha. Conferido: local e origin
   batem, e o trabalho do outro agente está intacto.

**Lição, reforçando a do vigia:** `checkout main` no início da ronda não vale
nada num clone compartilhado com ~100 worktrees e outros agentes commitando. A
branch se reconfere **no instante do commit**, e `push` que imprime sucesso não
é prova de entrega — a prova é `origin/main..HEAD` vazio **e** o arquivo lido de
dentro do `origin/main`.
