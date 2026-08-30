# Rotina das Falhas — 30/08/2026, ~21h40–22h UTC (= 18h40 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia
(`48a31b4`), árvore limpa, nada não-pushado. Índice de ordens lido antes de
tocar em qualquer coisa. Ordem de 29/08 (`desligar_vigia_e_frank`) relida:
**nada nesta ronda encostou na planilha** — não li, não escrevi, não
classifiquei, não reprocessei, e não abri chamado com causa nela.

Ronda anterior: **falhas às 21h**, que deixou 5 itens de passagem. Esta ronda
executou os 5.

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **3** (#99, #192, #200) |
| Em `aguardando_aluno` | **2** (#196, #197) |
| Incidentes novos desde a ronda das 21h | **0** |
| Incidentes que **anotei com medição nova** | **1** (#192) |
| Incidentes que FECHEI | **0** — motivo no §5 |
| Fechados que voltaram a disparar | **0 dentro de 24h** (§4) |
| Crédito / GPU / migration / voz tocados por mim | **nada** |
| Custo da ronda | ~zero. Só SQL de leitura e leitura de código. Zero whisper, zero GPU. |
| **Causa-raiz do `/tmp`** | **refinada — é QUOTA, e sei o que a ocupa** (§1) |

---

## 1. O `/tmp`: a ronda das 21h achou o lugar, eu achei o motivo e o culpado

A ronda das 21h estabeleceu que a Bash morre porque a escrita em `/tmp` falha,
e que o Node reportava `UNKNOWN: unknown error, write`. Fui um passo adiante
com `dd`, que devolve o errno de verdade em vez de mascarar:

```
dd if=/dev/zero of=/tmp/_frank_probe bs=1M count=1
  → dd: IO error: Disk quota exceeded
mesma escrita em /mnt/Data/tmp → 1 MB em 0,0018s, sem erro
```

**Não é falta de espaço nem de inode** — confirmado no mesmo instante:
`/tmp` é tmpfs de 16G com **3,1G livres (80% usado)** e **770.545 inodes
livres (27% usado)**. O erro é `EDQUOT`, **quota**, que é coisa diferente e
explica por que "tem espaço sobrando" e mesmo assim não escreve.

**E o que ocupa os 13G é nosso.** Os maiores em `/tmp`, todos do uid 1000
(`johnny`), todos sobra de rondas/automação anteriores que nunca limparam:

| dir | tamanho |
|---|---|
| `/tmp/claude-1000` | 4,1G |
| `/tmp/verify-pr36` | 2,2G |
| `/tmp/wt-8379549c` | 1019M |
| `/tmp/gerente-verify-38` | 951M |
| `/tmp/jo` | 457M |
| `/tmp/medicao_fb8` | 420M |
| `/tmp/dj` · `/tmp/john180` · `/tmp/perf` · `/tmp/pr131check` | 285M · 255M · 147M · 111M |

São worktrees de verificação, diretórios de medição e scratch de agente que
ficaram para trás. 4.316 entradas de `johnny` contra 16 de `root`.

**Por que isso é grave e não é só chateação minha:**

1. Derruba a Bash de **qualquer agente desta máquina**, em silêncio e sem
   stderr. Já custou a ronda das 20h inteira e atrapalhou a das 21h e esta.
2. Com a Bash fora, o `guard.py` — backstop de comando perigoso, que está
   pendurado nela — **não está no caminho**. A rede de segurança cai junto,
   e cai calada.
3. **É recorrente por desenho:** cada ronda que cria scratch em `/tmp` empurra
   a próxima para mais perto do teto. Limpar na mão conserta hoje e volta.

**NÃO limpei, de propósito.** Apagar `verify-pr36`, `wt-8379549c` ou
`gerente-verify-38` é apagar arquivo que não é meu e pode ser worktree de
processo vivo — a regra manda perguntar antes. **Escalado ao Johnny nesta
ronda** com a lista acima e o pedido de "pode apagar?". O conserto de verdade
é a automação limpar o que cria, não eu passando pano toda ronda.

Contorno em uso (herdado da ronda das 21h, e funcionou o tempo todo aqui):
terminal do MCP `ruflo` + `TMPDIR=/mnt/Data/tmp`.

## 2. #192 (Robert Ros) — segui o fio novo e achei defeito na referência dele

Item 4 da passagem mandava olhar `intrusion_flagged = 1` na geração `b298e5be`
em vez da troca de referência. Segui, e o fio deu em coisa.

**Primeiro, o que "intrusão" é** (`tts_qa/metrics.py:70`): é o **inverso do
coverage** — palavra **a mais ou trocada** no áudio, enquanto o coverage só vê
palavra **faltando**. O docstring nomeia o mecanismo dominante: *"o VoxCPM
vazar a CAUDA da referência entre frases"* (na Katia, a ref terminava em "por
menos" e `"Menos."` brotava nas junções de chunk). Incidente de origem:
`fb8d29b7`.

**Isso muda como se lê o QA dele.** `tts_qa/loop.py:278` diz que a intrusão é
**gate MACIO por decisão escrita**: *"regenera e escolhe a tentativa mais
limpa, mas NUNCA falha o job no esgotamento"*. Então `intrusion_flagged=1` com
`regens=1` **não** quer dizer "detectou e curou" — quer dizer "detectou,
tentou de novo, e entregou a menos suja das tentativas", que **pode ainda ter
a intrusão**. Saiu `ready` com o gate macio no caminho.

**Segundo, a referência dele está cortada no meio da frase.** Cauda literal do
`reference_transcript` da `b298e5be`:

> `"...para poder fazer a produção do trabalho do cor. Então, essa..."`

Duas coisas no próprio dado: **"do cor"** é palavra decapitada (cor|coral|
coração), farelo na borda; e **"Então, essa..."** termina em determinante sem
substantivo — não é fim de frase, é frase interrompida. É exatamente a classe
do **defeito da Katia** que está na minha ordem permanente. E
`voice_pipeline/reference.py:26` tem `_BAD_EDGE = {"entao","então",...}` — o
próprio código considera "então" borda ruim, e ela está na cauda dele.

**Medida da classe** (931 vozes `ready` com referência): **222 (23,8%)** têm
`reference_transcript` terminando em `"..."`; 40 terminam sem pontuação
nenhuma. Não afirmo que os 222 estejam defeituosos — `"..."` pode ser o
Whisper marcando fala que morre, e "está cortado" se decide no áudio, não no
texto. O número dimensiona, não condena.

**Uma suspeita de código que eu NÃO confirmei.**
`voice_pipeline/reference.py:47` pune **+30** a janela candidata que não
termina em pontuação terminal, justamente para evitar referência que acaba no
meio da frase (o comentário cita o VoxCPM issue #272, *"a cauda da ref vaza no
início da saída"*). A regex é `r"[.!?…]\s*$"`. **Fato de leitura de código:
essa regex ACEITA `"..."`**, porque o último caractere é `.` — ou seja, a
candidata que termina em reticências, que é precisamente a marca de fala
interrompida, passa **sem levar os +30**.
**O que isso não prova:** não verifiquei que o texto do Whisper *na hora da
seleção* da janela dele terminava em `"..."`; o que está no banco é
pós-normalização. **Derrubei uma hipótese minha antes de escrevê-la como
verdade:** achei que `jobs/train_reference.py:258-260` (poda vírgula e
acrescenta `"."`) estivesse mascarando a cauda e derrubando o portão — fui ver
a ordem das etapas e **esse trecho roda DEPOIS da seleção**, então não derruba
nada. Fica de pé só a questão das reticências.

**Não contradiz a medição de ontem.** A ronda das 21h mediu que trocar a
referência é **cura errada** para a reclamação de **ritmo** (o clone corre a
3,95 contra mediana de 2,55 dele; não herdou a lentidão da ref). Continua
valendo — não reabri aquilo e **não estou propondo trocar a referência**. O
que achei é outro defeito, na mesma referência, por outro caminho: cauda
cortada → vazamento na junção → intrusão. Ritmo e palavra estranha coexistem.

**Fecha em 1 passo, na próxima ronda:** transcrever o áudio **entregue** da
`b298e5be` e ver **qual** foi a palavra intrusa. Se vier `"essa"`, `"então"`
ou o farelo `"cor"`, a cadeia está provada ponta a ponta e vira card de
código. Se vier outra, a hipótese cai e fica registrado que caiu. Custo: 1
whisper, zero GPU.

Anotado no incidente: 12 → 13 notas, 1 linha afetada, conferido na releitura,
status intocado. **Limite de sempre: eu não ouço.** Tudo acima é texto e
número, não veredito.

## 3. #200, #196, #197 — conferidos, nenhum é meu para mexer

**#200** (3 alunos, ainda disparando às 17h29 de hoje): item 3 da passagem,
verificável em um comando. **PR #132 (`feat/ritmo-exige-rate-qa`) continua
`OPEN`, `mergedAt` nulo.** Enquanto não for mergeado e deployado, o seletor
segue mentindo na tela. Segue `investigating`, sem eu tocar. Card "pronto" e
PR aberto não são produção — só a main deploya.

**#196 (Liliane)** e **#197 (Natanael)**: reli as notas das duas antes de
decidir. As duas foram investigadas hoje até o fim, as duas alunas/alunos já
receberam e-mail, e as duas terminam com **pergunta objetiva ao aluno** (o
comprovante da compra dela; onde o curso foi comprado, no caso dele). As duas
notas dizem em letra maiúscula "não refazer esta investigação".
`aguardando_aluno` está **correto** nas duas. Não mexi, e registro que não
mexi para a próxima ronda não gastar fôlego relendo.

## 4. Fechados que voltaram a disparar

Varri `fixed`/`ignored` com `last_seen_at` nas últimas 48h. **Nenhum disparou
dentro de 24h.** O mais recente é #199 (7,8h), que já está `fixed` desta
manhã.

**#167** (`dd1da14e`, 6 ocorrências), que a ronda das 21h deixou marcado:
**última ocorrência agora a 47,3h** — contra 46h medidas há uma hora, ou seja
**nenhuma ocorrência nova**. Continua esfriando, não esquentando. Segue
marcado pela mesma regra: se disparar de novo, é a próxima da fila.

## 5. Por que fechei ZERO

Os três abertos travam em coisa que não é minha, e cada um pelo seu motivo:
**#200** espera merge (fechar com PR aberto é o "done falso" que a regra 14
proíbe), **#192** espera ouvido humano — e agora também uma transcrição de 1
passo que eu deixei especificada — e **#99** espera decisão comercial dentro
do prazo. Os dois em `aguardando_aluno` esperam o aluno.

A regra 8 manda fechar **mais**, não mais rápido do que se resolve. O passo
que emperra está escrito item por item nos §2–§3.

## 6. #99 — não repeti a escalação

**Vence 02/09** (dois dias). A ronda das 21h, há menos de uma hora, escalou
pela **10ª vez** e de propósito diferente das 9 anteriores: com prazo na
frente, default explícito pelo silêncio e recomendação de devolver. **Não
escalei de novo** — 11ª cobrança em uma hora é ruído, não diligência, e o
Lucas está no canal. Reconferi só o que muda decisão: nada mudou no estado
dele em uma hora. Se o Johnny responder, executa-se. Se chegar 02/09 sem
resposta, **a decisão foi tomada pelo silêncio e isso tem que estar escrito no
log daquele dia**, não engolido.

## 7. Regra 7 — grupo

**Não postei ronda no grupo.** A regra manda postar fato consumado: incidente
fechado, fix em produção, ou e-mail a aluno. **Nenhum dos três aconteceu.** A
medição do §2 é insumo, não fato consumado, e ronda vazia no grupo é o ruído
que a regra proíbe.

O que foi ao Johnny é outra coisa: o `/tmp` (§1), que precisa de um "pode
apagar" dele e derruba a Bash e o `guard.py` de todo agente da máquina.

## 8. Passagem pra próxima ronda, em ordem

1. **`/tmp` (§1): é QUOTA, e a lista de quem ocupa está aí.** Enquanto não
   limpar, Bash morta para todo agente e `guard.py` fora do caminho. Contorno:
   terminal do MCP `ruflo` + `TMPDIR=/mnt/Data/tmp`. Esperando o "pode apagar"
   do Johnny; o conserto real é a automação limpar o que cria.
2. **#192, 1 passo:** transcrever o áudio entregue da `b298e5be` e ver qual a
   palavra intrusa (§2). Prova ou derruba a cadeia inteira.
3. **#99 vence 02/09.** Não re-escalar sem fato novo; se passar sem resposta,
   escrever no log daquele dia que o silêncio decidiu.
4. **#200:** conferir se o PR #132 foi mergeado.
5. **#196/#197:** não reinvestigar; só reagir se o aluno responder.
6. **#167:** se disparar de novo, é a próxima da fila.
