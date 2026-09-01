# Rotina das Falhas — ronda das 00h UTC de 28/08/2026 (dono da fila)

Janela real: 27/08 23:15Z → 28/08 00:00Z (20h15–21h BRT, dentro do turno
08h–23h BRT). Método serial (regra 8, ordem de 21/08 `fd0b0f5`): um incidente
por vez, até o fim. Papéis (14-A): o Vigia abre e anota; eu investigo, decido
e fecho. `git checkout main && git pull --ff-only origin main` → já estava em
dia. Índice de ordens lido antes de tocar em qualquer coisa; ordem vigente do
assunto: `2026-08-27_vigia_so_erro_de_sistema.md` (14-C).

## Placar

| | |
|---|---|
| `investigating` no início / no fim | **6** / **7** |
| `aguardando_aluno` no início / no fim | **8** / **8** |
| Incidentes **fechados** nesta ronda | **0** — e explico o porquê no §5 |
| Classe **reaberta** por medição | **1** (`#108`) |
| Alunos que passaram a ter resposta | **1** (Vinicius, pagante) |
| Defeito de dado corrigido em produção | **1** (referência da voz `367282e9`) |
| Áudio refeito por conta da casa | **1** (sem débito, conferido) |
| Hipótese minha derrubada antes de virar acusação | **1** (§4) |
| Crédito estornado / migration / merge / e-mail em massa | **nada** |

---

## 1. Qual peguei, e por que não foi o mais velho

A regra 8 manda pegar o mais antigo **com aluno afetado**. Conferi um a um em
vez de herdar o veredito da ronda anterior — e a checagem valeu a pena.

**Os 6 `investigating`: em 5 a bola não é minha.**

- **`#11`** (37,1 dias) — travado no aval da migration `scripts/97`. Passo em
  que emperrou: **decisão do Johnny**. Sem novidade desde as 23h.
- **`#120`** (Sandra) — reembolso **do curso**, alçada do Lucas/Johnny.
- **`#151`** e **`#164`** — conserto está no **PR #75**, aberto, esperando aval.
- **`#153`** — conserto está no **PR #73**, aberto, esperando aval.
- **`#165`** — aberto por mim ontem; não se mexe antes do A/B ouvido.

**Nos 8 `aguardando_aluno` fui conferir se a espera era real**, porque "aguardando
aluno" sem e-mail enviado é mentira — foi o que pegou a Telma ontem (`#160`) e o
que fez a Viviana explodir. Abri a pasta de **Enviados** um a um:

| incidente | aluno | e-mail já enviado? |
|---|---|---|
| `#47` | Katia | **sim**, substantivo |
| `#124` | Leonardo | **sim**, substantivo |
| `#133` | Giovanna | **sim**, substantivo |
| `#139` | ycarlosk / definidameta | só o disparo genérico *"Sua plataforma está pronta"* |
| **`#162`** | **Vinicius** | **NENHUM** |

**Peguei o `#162`.** Vinicius Ponce (`vinioliveiraponce1@`), **pagante que comprou
HOJE** (`subscription_grant` 15:53Z, acesso até 03/09, 82.760 créditos), treinou a
voz 18:12, reclamou 19:08Z pelo chat do app — e **ninguém nunca escreveu pra ele**.
O status `aguardando_aluno` estava mentindo: a bola era nossa.

**Onde eu me afasto da letra da regra 8, e assumo:** o `#139` é mais velho (26/08).
Não peguei ele porque os dois de lá são **trial que nunca reclamou** e o relógio que
motivou aquele chamado **já venceu** (o acesso do ycarlosk morreu 26/08 12:00Z). O
`#162` é o único da fila com **pagante ativo esperando resposta que não existe**, e
a ordem diz que aluno esperando vem antes da limpeza da fila. Decisão minha,
registrada aqui para poder ser contestada.

## 2. O defeito era nosso, e tem número

`voices.reference_transcript` da voz `367282e9` **terminava** em:

> *"...Vou dar um tiro ali **E...**"*

O áudio de referência (`ref/auto.wav`) **não diz isso**. Ele termina em
*"...vou fazer um pouco mais rápido, vou."* (whisper-1 sobre o próprio clipe).

Cauda **fantasma**: o texto promete uma continuação que o som não tem. É
exatamente o mecanismo do **Negrini `#124`** — o VoxCPM continua o **TEXTO** da
referência, então lixo na cauda vira artefato no **COMEÇO de cada geração**. Bate
ao pé da letra com a queixa dele (*"ruim no começo da fala"*). A ponta inicial
batia: o comparador acusou só `cauda_diverge`.

## 3. O que eu fiz, com a prova

1. **Curei a referência** (`conferir_transcript_referencia.cjs --curar --confirmar`).
   Ensaiei sem `--confirmar` antes. **Reli o banco depois de gravar**: 568 chars,
   cauda agora `"...vou fazer um pouco mais rápido, vou."` Sem GPU, sem retreino,
   sem tocar nos 38 min dele.
2. **Refiz o áudio por conta da casa** (`refazer_audio_conta_da_casa.cjs`) →
   geração `9bf43e77`, `ready`, 4,263s. **Conferido: ZERO linhas em
   `credit_transactions` com `ref_id=9bf43e77`** — não houve débito **nem** o
   estorno-fantasma que a ferramenta avisa que pode acontecer quando o job falha.
3. **Escrevi pra ele** — e-mail individual (regra 8, decido sozinho), **uid 225,
   23:50:25Z**, bcc suporte@, **conferido na pasta Enviados depois do envio**.
   Conferi também que o `enviar_email.cjs` manda `text/html` puro, **sem parte
   text/plain** — então as entidades HTML renderizam certo no cliente dele e ele
   não recebe `&eacute;` na cara.
4. **Áudios ANTES × DEPOIS pro grupo** (msgs 515/516), porque o veredito de som
   não é meu.
5. Grupo msg 517 (fato consumado) e Johnny msg 518 (a decisão nova).

## 4. Uma hipótese minha, derrubada por medição antes de virar acusação

Como a voz é de **hoje** — depois de todos os fixes — levantei a hipótese de que o
corte por palavra estivesse **implementado e não ligado**, que é a família do
`#165` (lido em 3 pontos, escrito em zero) e do `2c5bab42`. O teste do worker
alimenta essa leitura: *"sem `transcribe_words_fn` o comportamento antigo segue
intacto"*.

**Fui olhar antes de escrever: está ligado.** `runpod-worker/jobs/train_reference.py:100`
passa `transcribe_words_fn=lambda p: transcrever_palavras_seguro(...)`. A hipótese
morreu ali. Registro porque a ordem de hoje cobra exatamente isso do Vigia (§3:
"abrir o arquivo antes de acusar") e não faria sentido eu me isentar.

Também **derrubei o PR #54 como solução**: apesar do título dizer *"transcript que
o áudio não diz"*, ele toca **só** `_frank/ferramentas/fabricar_referencia.cjs` e
`refazer_audio_conta_da_casa.cjs` — as ferramentas **manuais**. Não encosta em
`runpod-worker/`. **Mergear o #54 não impede voz nova de nascer com cauda fantasma.**

## 5. Por que NÃO fechei o `#162` (regra 14)

Corrigi uma causa medida. **Não confirmei o sintoma audível** — e não vou dizer que
confirmei. Eu não ouço, e a telemetria **não decide isto**; a prova está no próprio
caso:

| | `c971bebc` (original, que ele reclamou) | `9bf43e77` (depois da cura) |
|---|---|---|
| regens | **0** | 2 |
| `echo_flagged` / `intrusion_flagged` | 0 / **0** | 0 / **1** |
| `coverage_medio` | 1.0 | 1.0 |
| wps global | 3.65 | 3.07 |

O QA **não viu nada** no áudio original **e o aluno estava certo**. Logo o QA é cego
pra este defeito, e ler esses números como "melhorou" ou "piorou" seria inventar.
Quem julga é o ouvido dele. Fechar como `fixed` aqui seria fechar mais rápido do que
resolvo, que é o que a regra 14 proíbe — a ordem de 21/08 pede fechar **mais**, não
fechar **falso**. Fica `aguardando_aluno`, e agora essa palavra é **verdade**:
escrevi 23:50Z e a bola é dele.

**Crédito:** conferido por `ref_type`, **nunca por `kind`**. Débitos: `-10.000`
(`voice`, treino) e `-400` (`generation`, `c971bebc`). **Zero** linhas
`generation_refund`. **Não estornei** — o áudio refeito de graça cobre em espécie os
400 do áudio defeituoso, e o treino de 10.000 fica de pé porque a voz **não foi
retreinada, foi curada**. Compensar além disso é decisão do Johnny.

## 6. O achado que passa do Vinicius — `#108` reaberto

Se voz treinada **hoje** nasce com cauda fantasma, não é só falta de backfill.
Medi 40 vozes `ready` treinadas de 25 a 27/08: **19 acusaram divergência (48%)**.

**O limite do método, e ele importa mais que o número:** comparo o transcript
gravado (whisper do worker) com uma transcrição **whisper-1 da API** — **motores
diferentes**, então parte da divergência é variação de ASR, não defeito. Separando
na mão:

- **5 de 19** divergem só na **primeira palavra** e têm cauda **idêntica**
  (`66e7a0cc`, `105d9b9d`, `d738731c`, `a648e9d5`, `552be5d4`) → variação de ASR,
  **sem dano demonstrado**;
- **~9** têm cauda que o áudio **não sustenta**. Três são alucinação clássica de
  whisper em silêncio final, implausíveis como fala do aluno:
  `a12d737d` *"obrigado por assistir"* × áudio *"evolução dos sintomas"*;
  `098cceb2` *"que el necesita"* (**espanhol**) × *"sua própria vida"*;
  `f5c13d55` *"making fantastic progress"* (**inglês**) × *"um ótimo trabalho"*.
  `acdcd52b` termina em *"música"* (tag `[música]` virando texto) e `6ce4f84c` tem
  **12 palavras a mais** que o áudio.

**Não afirmo que 48% estão defeituosas.** Afirmo que ~9 em 40 carregam texto que o
clipe não diz, e que isso é o mecanismo do `#124`.

Por que **reabri o `#108`** em vez de abrir chamado novo: a checagem 1 da 14-C manda
procurar a classe na fila **aberta e fechada** antes de abrir — e o `#108` **é** esta
classe, fechado `ignored` com a nota *"Fix de seleção + transcript fiel em prod"*. É
a metade **"transcript fiel em prod"** que a medição de hoje não sustenta. Abrir um
`#166` seria o erro do `#112` (duplicata).

**O que eu não fiz, de propósito:** cura em massa. Alcança ~900 vozes `ready`, e
mudar o som de todo mundo às cegas é o erro do Kessuly (24/08, 93 vozes "muito
pior"). Curei **uma**, a do aluno que reclamou. Varredura em massa é decisão do
Johnny — escalada na msg 518.

## 7. Decisões que continuam sendo do Johnny

1. **Migration `scripts/97`** — trava o `#11` há **37 dias**. Reconferida: segue não
   aplicada.
2. **`#108`** — varrer/curar as vozes com cauda fantasma exige aval (≈900 vozes) e,
   idealmente, A/B ouvido antes.
3. **22 PRs abertos**, o mais velho de 18/08. Três destravam chamado aberto
   (#73 → `#153`, #74 → `#157`, #75 → `#151`/`#164`).
4. **`#165`** — nada de mexer na régua de ritmo antes do A/B ouvido.
5. **Luciano (`#99`)**, **Sandra (`#120`)**, **Marlon (`#154`)** — sem mudança.

## 8. O que eu NÃO fiz

Não mergeei PR nenhum. **Não apliquei migration** — em particular não a 97. Não
retreinei voz, não gerei amostra, não curei referência em massa: a única GPU que
gastei foi **uma** geração de 88 chars, por conta da casa, pra um aluno que
reclamou — que é o uso que a própria ferramenta autoriza ("compensação por erro
nosso"). **Não estornei crédito.** Não mandei e-mail em massa: **um** individual, do
caso que eu estava tratando. **Não li a caixa do suporte@ para triagem** — só
`--enviados --para` nos endereços dos alunos que eu estava conferindo, que é leitura
da nossa própria saída, não da fila da Fast. Não mexi em cron nem em ordem.

## 9. Para a próxima ronda

1. **Vinicius (`#162`)**: respondeu? Se disse que melhorou → `fixed` com a nota. Se
   disse que continua ruim → a causa é outra, reabrir a investigação **sem** ele
   gastar nada testando.
2. **`#108`**: não curar em massa sem o aval. Se o aval vier, **medir antes e depois
   com ouvido humano** numa amostra, não confiar na régua (§5 mostra por quê).
3. **`#139`**: os 2 trials seguem sem ninguém ter falado com eles; o acesso do
   ycarlosk já venceu. Decidir se vale escrever ou se o chamado deve ser encerrado
   como perda assumida.
4. **`#11`**: se a 97 for liberada, aplicar e **conferir a coluna no banco** — DDL
   commitado não é DDL aplicado.
5. `mission-cli.js` continua quebrado nesta máquina (`DB_ENCRYPTION_KEY is missing
   or too short`), então esta ronda **também não tem card no Mission Board**. Registro
   de novo em vez de deixar passar em silêncio.
