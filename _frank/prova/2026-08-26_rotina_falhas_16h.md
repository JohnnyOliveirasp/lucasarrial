# Rotina das Falhas — 26/08/2026, ronda das 16h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido. Ronda anterior: 15h UTC (fechou o `144`).

---

## 1. Incidente que peguei: `52` / `37bacb68` — qa_coverage. NÃO fechei.

Peguei pela regra 8 sem exceção nenhuma: é o **mais antigo aberto com aluno
afetado** (19/08, 17 e-mails na lista) e **reabriu sozinho às 15:06:57Z**,
enquanto eu entrava. Os outros 3 abertos (`97`, `99`, `143`) seguem parados em
decisão do Johnny — mesmo quadro da ronda das 15h, sem novidade.

### Quem levou a reincidência — o Executor não sabia, e é um pagante do 1º dia

**Alessandro Godoy** (`godoyalessandroadv@gmail.com`), conta de 24/08, acesso
até 02/09, voz `4b0e315d` treinada **hoje às 14:42**. Duas falhas no mesmo texto
de 63 chars: `17cd7665` (15:01) e `2ba45f4e` (15:06).

**Dinheiro conferido, e está certo:** os dois débitos de 400 têm estorno de +400
(15:06 e 15:08), por `ref_type='generation_refund'` — nunca por `kind`. Ele não
pagou pela falha. **E não ficou travado:** voltou sozinho e emplacou 3 áudios
`ready` (15:09, 15:12, 15:26) e 1 vídeo clone (15:31).

### A causa, medida

`coverage_best` **0,077 e 0,0**. Não é régua apertada: 0,077 é **exatamente 1 de
13 palavras**. O áudio saiu errado mesmo.

O diferencial estava na entrada e é quase bonito de ver: as duas falhas carregam
**"para fazer póust"** — o normalizador reescreve o inglês *post* → *póust*, por
instrução explícita em `frontend/src/lib/llm/normalize.ts` — e o sucesso de
15:09 é a **mesma frase sem esse pedaço**.

Mas o `póust` é o gatilho, não a doença. A doença é a **referência da voz**:

| medida | valor |
|---|---|
| duração do `auto.wav` | 28,76s |
| fim da última palavra | **28,74s** — o corte pegou a frase no meio |
| cauda gravada em `reference_transcript` | "…San Diego **com minha filha e meu filho**." |
| cauda que o áudio tem | "…San Diego **com**\|" (cortado) |

São **5 palavras que não estão no áudio**. O VoxCPM continua o TEXTO da
referência, então tenta "terminar" as palavras fantasma → intrusão. Bate com a
telemetria: `intrusion_flagged` 2/3 nas duas falhas, e o próprio sucesso de
15:09 só passou com **6 regens e 7 intrusões**. Classe Katia/Negrini `#124`.

### O que eu fiz

Reescrevi `reference_transcript` cortando **só** a cauda fantasma, terminando em
"…no aeroporto de San Diego." Gravado, **1 linha afetada**, relido do banco e
confere. Sem GPU, sem crédito, sem retreino. Aluno avisado por e-mail (§3).

---

## 2. O erro que eu cometi no meio do caminho — e que virou o achado da ronda

Antes de chegar no texto certo eu rodei
`conferir_transcript_referencia.cjs --curar`, que reescreve o transcript com o
whisper do clipe **inteiro**. Isso **apagou uma frase válida**: o original
começava com *"Ficaram necessárias mais duas impressões."* e o whisper do clipe
inteiro simplesmente **não transcreve essa frase** (a 1ª palavra que ele acha
começa em 4,00s).

Fui conferir se era silêncio. **Não é**, e medi de três jeitos:

- `0-4s`: `mean_volume` **-25,4 dB** contra **-25,0 dB** do resto do clipe
- `silencedetect` não acha silêncio nenhum antes de **4,15s**
- transcrevendo **só a cabeça** (0-4,6s), o whisper devolve a frase inteira:
  *"Foram necessárias mais duas impressões."*

A frase está no áudio. **O instrumento é que a engole.** Revertí e gravei o
texto correto (cabeça preservada + cauda fantasma removida).

Registro isto com todas as letras porque foi erro meu, eu peguei sozinho, e se
tivesse passado batido eu teria "curado" o aluno degradando a voz dele.

### O instrumento não serve para cura em massa — e isto está MEDIDO

Rodei `--medir` em **40 vozes** desde 01/08. Ele acusa **"18 de 40 divergentes
(45%)"**. Esse 45% **não é a taxa do defeito**:

- **6 dos 18** acusados têm **menos** palavras no texto do que no áudio (até
  **-15** em `82849009`). Texto mais curto que o áudio não pode ser texto
  fantasma — é whisper ouvindo diferente.
- **24 das 40** estão dentro de ±1 palavra: ruído de transcrição, não defeito.
- **Falso negativo grave:** `16c34e6a` tem **+10 palavras a mais** no texto e foi
  marcada **"ok"** — porque a 1ª e a última palavra casaram por acaso.

O discriminador útil não é "as pontas batem", é **quantas palavras a mais o
texto reivindica**. Por esse critério (+4 ou mais) sobram **5 de 40 = 12,5%**
candidatas reais: `6ce4f84c` (+12), `16c34e6a` (+10), `3a601c63` (+9),
`ac48e09e` (+6), `65e8c7d4` (+5). **Não curei nenhuma** — ficam anotadas.

Se alguém rodar `--curar` em lote nessas 18, **apaga texto válido em várias**.
É a **3ª vez** que automação de referência sai errada neste repo (a ordem de
20/08 já reprovou a heurística por energia duas vezes). Não subir cura em massa
com este instrumento.

---

## 3. Aluno avisado

E-mail individual para o Alessandro (regra 8: caso que eu estava tratando, decido
sozinho), bcc `suporte@`. Disse o que aconteceu, que **o crédito já voltou**, que
**a falha foi nossa e não dele**, que **já corrigi e ele não precisa regravar
nada** — e, sem enfeitar, que **não prometo que nunca mais falha**, porque a
família de erro segue em investigação; o que garanto é o crédito de volta.
Pedi que, se repetir, ele me responda com a hora em vez de ficar repetindo a
geração.

---

## 4. Por que fica `investigating` e não `fixed`

Curei **um aluno**, não a **classe**. Marcar `fixed` aqui seria exatamente o que
a regra 14 proíbe.

O que eu **descartei** (para a próxima ronda não refazer):

- **não é régua apertada** — coverage 0,0/0,077 é áudio errado de verdade
- **não é falta de estorno** — conferido por `ref_type`
- **não é aluno travado** — ele produziu 3 áudios e 1 vídeo depois
- **a cura automática do worker ESTÁ na imagem** — conferido por `merge-base`:
  `d912809` é ancestral de `d2381956`, a imagem construída em 25/08 18:41Z.
  Conferi a ancestralidade, não o commit solto.

**O que falta, e é a pergunta que fecha a classe:** o código da cura está na
imagem e **mesmo assim** uma voz treinada hoje às 14:42 nasceu com o defeito.
Duas leituras, e eu **não escolhi nenhuma sem prova**:

- **(a)** o worker quente do RunPod ainda serve imagem antiga — **não consigo
  conferir daqui**: `training_jobs` não guarda imagem nem digest. É a armadilha
  que já mordeu este mesmo incidente em 20/08.
- **(b)** `transcricao_fiel` rodou e não adiantou, porque ela re-transcreve o
  **clipe inteiro** — exatamente o método que acabei de provar que engole a
  cabeça. Se for (b), a cura automática carrega o mesmo ponto cego do instrumento
  e pode estar gravando transcript **sem a 1ª frase** em outras vozes, ou seja
  piorando em vez de curar.

Card **`7a20c24b`** aberto no `coder` com as duas tarefas: consertar o
instrumento (alinhamento em vez de pontas, conferir borda isolada, tratar
timestamp de duração zero como alucinação, `--curar` preservando o texto bom) e
decidir entre (a) e (b) **gravando a identificação da imagem do worker** para
essa dúvida nunca mais custar uma ronda.

---

## 5. Fila conferida

- **Abertos: 4** (`52`, `97`, `99`, `143`) — mesmo número da entrada. O `52`
  reabriu sozinho às 15:06 e é o que eu trabalhei.
- **`97`, `99`, `143`:** parados em decisão do Johnny, quadro idêntico ao das
  15h. Não reescrevi o que a ronda anterior já escalou; o `99` (Luciano) tem
  relógio até **02/09**.
- **`aguardando_aluno`: 7** — inalterado.
- **Presos no painel: 4** — os mesmos 4 de acesso vivo sem voz pronta.

---

## 6. Placar da ronda, sem inflar

- **0 incidente fechado.** O que peguei não estava resolvido e eu não fecho o que
  não resolvi.
- **1 aluno pagante curado** (`4b0e315d`), com o banco conferido depois de gravar.
- **1 aluno avisado** por e-mail.
- **1 erro meu cometido, pego por mim e revertido** antes de virar dano.
- **1 instrumento reprovado com medição** (45% acusado × 12,5% real, mais 1 falso
  negativo de +10 palavras) — impede uma cura em massa que estragaria vozes.
- **5 candidatas reais anotadas e NÃO tocadas.**
- **1 card** pro `coder` (`7a20c24b`).
- **0 crédito, 0 GPU, 0 migration.**

O gasto foi ~R$1 de whisper em leitura (40 vozes + as aferições), nada de GPU.
