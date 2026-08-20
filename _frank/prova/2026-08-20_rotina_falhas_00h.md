# Rotina das falhas — 20/08 00:0x UTC (19/08 21:0x BRT)

Fila trabalhada do mais antigo pro mais novo. **Nada mudou de status**: os dois
incidentes seguem `investigating`, os dois com nota nova. Nenhum aluno esperando.

## O que eu conferi antes de qualquer coisa

Passo fixo que a lição da rodada 23:1x criou — `mission-cli list` **antes** da
varredura, porque os cards que eu mesmo abro são parte da fila:

- board sem card FastCloner novo desde a rodada anterior. O último foi o
  `d2e9122d` (@olho), fechado 22:37, **já lido e já incorporado** na nota das 23:1x.

## 1. `d3d8d1b2` — executionTimeout (o mais antigo, 30/07)

Sem fato novo. Só o contador andou:

| | 23:1x | agora |
|---|---|---|
| geracões limpas consecutivas | 128 | **139** de 470 (30%) |
| executionTimeout novos | 0 | **0** |
| última ocorrência | 18/08 20:46 | 18/08 20:46 (**27,3h**) |

- 114 gerações nas últimas 24h (109 ready / 5 failed), última 23:52 ready.
- as 5 falhas de 24h são **todas** `qa_coverage`, nenhuma de timeout, e a mais
  recente é de 19:05 — **5h limpas**. Sem reincidência disfarçada.
- GPU conferida agora: `train` inQueue=0 (6 idle) · `video` inQueue=0 ·
  `voxbr` inQueue=0. Os 3 `throttled` do vídeo são datacenter sem GPU livre,
  nada a fazer no código (03_ROTINA §5). **Não há fila que explique timeout.**

Continua valendo: silêncio não é cura (47% de chance de ver zero mesmo com o bug
intacto). Faltam ~331 gerações limpas, uns 3 dias. Fechar a causa depende da
**migration 82**, que aguarda aval.

## 2. `fb8d29b7` — QA não mede inserção/substituição

O trabalho desta rodada foi **auditar a lista de estorno antes de ela virar
decisão do Johnny**. Ninguém tinha cruzado a lista congelada (23:06) com o
veredito do @olho (22:37). Achei três coisas.

### 2-A. A lista não é um bloco só

Os 12.734 cr / 15 gerações / 9 alunos se separam em três níveis de prova:

| nível | itens | créditos | o que sustenta |
|---|---|---|---|
| **dois transcritores** | 4 | **4.478** | Whisper + Gemini concordam |
| **evidência principal caída** | 1 | 761 | ver abaixo |
| **só Whisper** | 10 | 7.495 | medidor com 20% de falso positivo |

Os 4 confirmados: `68088477` (2.000, UFRJ→"ufrota") · `f843bac4` (1.175, "ponto"
6x + BYD/GEELY) · `dc8578c8` (903, "amplia"→"é que não cria") · `1ad7121b` (400,
"Parabéns." inserido).

### 2-B. Um item da lista perdeu metade da prova e ninguém tirou

`26fbfeb9` (761 cr) entrou com 2 defeitos graves. Um deles —
"fiscalização"→"fiação" — foi **refutado** pelo Gemini às 22:37: o áudio diz
fiscalização, o erro era do Whisper. A nota das 23:1x registrou a refutação mas
**não voltou na lista**. O item hoje só se sustenta pela outra marca, uma
inserção ("o pardal de") que ninguém testou com segundo ouvido.

Isso **não derruba o incidente** — o defeito é real e está confirmado em 4 casos
independentes. Muda a leitura da *lista de dinheiro*.

### 2-C. A lista é uma foto e já envelheceu

Congelada 23:06. De lá pra cá entraram **11 gerações ready** (23:08→23:52),
nenhuma medida. Na taxa medida (piso ~38%, teto 58%), ~4 a 6 delas devem estar
contaminadas e **fora** da lista. Refazer depois custa transcrição. É argumento
pra decidir rápido, não pra decidir sozinho.

## 3. Dinheiro e acesso — reconferido, ninguém travado

gnguimaraes 168.296 · estudioelianeguedes 122.275 · vinymoras 121.481 ·
pc.sul157 89.033 · kessulyl 77.930 · miltonchristiano 75.140 ·
nucleartstudio 73.265 · zambiasitiago 68.811 · allysoncruz.nutri 8.047

⚠️ `vinymoras` aparece com `access_until = NULL`. **Não está bloqueado**: o gate
é por **saldo de crédito**, não por assinatura ativa — tanto que ele gerou às
21:54 e 22:00 de hoje. Registrado pra ninguém ler o NULL como travamento na
próxima rodada.

## 4. `ja_pagou`: reconferida, zerada, sem risco *hoje*

1.293 perfis: `ja_pagou=true` em **zero**, `null` em **zero** — false em 100% da
base. O backfill prometido "em commit separado" pela mig 79 nunca rodou.

O que eu **conferi agora** e é a parte que importa: `grep` de `ja_pagou` no repo
só acha scripts de investigação (`_Bugs/`) e o próprio SQL. **Não há leitura em
`frontend/src`** — a trava que o SQL descreve ("a trava lê SÓ estas colunas")
**não está em produção**. Não é incêndio hoje; é mina se alguém mergear a trava
sem o backfill junto. Toda a base leria como "nunca pagou".

## 5. Ponto cego da lição 2 repetiu — 8 branches fora da `main`

`main` == `origin/main` (0/0). Mas:

`chore/gitattributes` · `feat/escalacao-email-avisa-grupo` ·
`feat/estorno-zera-credito` (2) · `feat/fix-image-upload-retry` ·
**`feat/gravar-enviados-imap-append`** · `feat/persistir-respostas-fast-v2` ·
`feat/trial-expiry-cobranca-em-voo` · `feat/vigia-noturno`

A de negrito é **nova desde a rodada anterior**: card `d1baee63`, fechado 19:35,
e a tabela das 23:1x não a listava. Card "completed" ≠ "no ar", uma rodada depois.

**Não mergeei, e a razão é concreta, não preguiça.** Li o diff: o envio em si está
bem feito (o APPEND é best-effort, num `try/catch` *depois* da entrega, justamente
pra não fazer o caller reenviar pro aluno). O problema é outro: `appendToSentFolder`
**abre uma conexão IMAP nova com LOGIN a cada e-mail enviado**, e a Fast lê essa
mesma caixa de 5 em 5 minutos. Isso nunca rodou contra a caixa de produção. Se
esbarrar em limite de conexão do Private Email numa rajada do mail-sweep, o que
quebra é o canal de suporte inteiro — exatamente a falha que deixou a Fast 2 dias
muda em 08/08. Merece deploy de dia com alguém olhando, não push às 21h com nada
quebrado.

## O que eu não fiz

Não mexi em código, não mexi em saldo, não gastei GPU, não escrevi pra aluno,
não apertei portão, não fechei incidente.
