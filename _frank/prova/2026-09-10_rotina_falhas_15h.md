# Ronda das falhas — 10/09/2026, ~13h30–16hZ (10h30–13h BRT)

Dono da fila (14-A). Backlog **serial**. Repo em `main`, `pull --ff-only`.
Índice de ordens lido antes de tocar em nada. Ordem de **29/08** respeitada:
nada da planilha lido, escrito, classificado, avisado ou reprocessado; nenhum
chamado de causa-planilha aberto ou reaberto. Ordem de canal de **31/08**: os
dois avisos desta ronda foram **no grupo**.

**Não fechei incidente. O resultado da ronda é uma correção: eu refutei a minha
própria medição de ontem, e ela estava sustentando uma recomendação errada ao
Johnny.**

---

## 1. Antes da fila: dois pagantes parados no Vídeo Clone

A varredura acusou 2 clones presos há ~1h25, ambos de aluno pagante. Fui atrás
porque essa é a forma exata do apagão de 05/09 (12h fora do ar, descoberto por
um aluno pagante).

**Não é apagão, e não é bug nosso — é capacidade de GPU.** Medi antes de
concluir:

| janela | jobs | prontos | presos |
|---|---|---|---|
| 29h anteriores | 102 | **102** | 0 |
| a partir de 12hZ | 4 | 1 | 3 |

O RunPod confirma a causa: `workers: {running: 1, throttled: 3, idle: 0,
ready: 0}` — três dos quatro workers sem GPU alocada. O job da Leonice registrou
`delayTime` de **4.835.684 ms (1h20) só de fila**, e depois rodou em 8,6 min.

**Desfecho:** o da Leonice **completou** (`ready`, com `result.mp4` gravado) após
1h31. O do Mastroianni entrou em execução depois de 1h25 de fila. A fila drena,
devagar, com 3 workers ainda throttled no fim da ronda.

⚠️ **Um susto que eu chequei antes de reportar como defeito:** o RunPod devolveu
`COMPLETED` com `output: {images: [], status: "success_no_images"}`, que parece
job que terminou sem produzir nada. **Não é.** Neste workflow o vídeo vai direto
pro R2 e o array `images` é de saída de imagem do ComfyUI — a linha fechou
`ready` com `video_path` gravado. Registro porque "success_no_images" assusta
quem ler o status cru na próxima vez.

**Não abri chamado, de propósito:** pela ordem de 27/08, só erro de **sistema**
vira chamado; capacidade é infraestrutura/decisão e vai pro grupo. Foi pro grupo
marcado como urgente, com o que não dá pra resolver daqui (escalar worker ou
liberar outro tipo de GPU é conta do RunPod).

---

## 2. O item serial: #226 — e a parte que interessa é que **eu estava errado**

Peguei o #226 (`702cc916`) porque é o mais antigo **acionável** com aluno
afetado: os mais velhos que ele (#15, #47, #99, #223, #254, #265) seguem
travados em decisão do Johnny, como a ronda das 12h já registrou. O #226 tinha
critério de fechamento escrito e a janela de medição tinha acabado de amadurecer.

### 2.1 A medição, com um acerto de borda

O critério dizia: `n>=68` entregas (>=40 chars) depois de 09/09 16:11Z, todas
com `abaixo_piso=0`. Usando `> 16:11:00` a própria `873fcee4` (16:11:58) cai
dentro da janela e se conta como caso novo — **ela não é nova, ela é o marco.**
Refiz com corte estrito:

| | valor |
|---|---|
| n | **70** entregas / 36 alunos / 19,1h |
| abaixo da régua 0,85 | 17 (24,3%) |
| **abaixo do piso 0,65** | **1** |
| em zero | 0 |
| gate terminal | 1 |

Volume chegou (70 ≥ 68), mas apareceu **1 abaixo do piso**. Pelo critério
escrito, **a conta reinicia e eu não fecho.** Marco novo: `> 2026-09-09
21:46:19.158105Z`.

### 2.2 O erro meu, que é o achado da ronda

Ontem eu declarei 2 entregas **completas** e usei isso pra recomendar cautela.
Usei o método errado: comparei **quantidade de palavras** do texto com a do
áudio e li "delta pequeno = completo".

**Contra-exemplo medido hoje:**

> `873fcee4` — texto 253 palavras, áudio **255** palavras (+2) — e mesmo assim
> **falta a palavra "Fé"** no mp3 entregue.

O áudio pode ter **mais** palavras que o texto e ainda ter perdido uma: o
whisper insere/divide em outro ponto e o saldo fecha. E o delta de −1 da
`ea11989a`, que eu li como "completo", **era literalmente a palavra que faltou**.

### 2.3 Revertendo o veredito, com os vizinhos como testemunha

As duas entregas do ibccoaching têm a lista *"Amor. Dinheiro. Família. Sucesso.
Fé."* — e nas duas o "Fé" some com os quatro vizinhos presentes **e na ordem**:

| entrega | amor | dinheiro | família | sucesso | fé |
|---|---|---|---|---|---|
| `ea11989a` | 24,30s | 25,38s | 26,80s | 27,76s | **AUSENTE** |
| `873fcee4` | 22,44s | 23,60s | 24,76s | 25,44s | **AUSENTE** |

O QA tinha razão nas duas (`faltantes_amostra = ["fe"]`). **Quem errou fui eu**,
ao chamar de alucinação do instrumento o que era acerto do instrumento.

### 2.4 O caso novo da janela

`8062ac72` — Gustavo Sperandio, 09/09 21h46, cobertura 0,600, faltantes
`["processa","treina"]`. Controle por palavra: **as duas ausentes** no mp3. O
aluno recebeu *"O cérebro ___ o que repetimos. Repetir cuidado ___ resiliência."*
Os dois verbos sumiram; as duas frases quebraram.

### 2.5 O que isso faz com a decisão que está com o Johnny

Ontem eu escrevi que fazer o gate reprovar abaixo do piso **mataria 2 áudios
completos e dispararia 2 estornos indevidos** — o mecanismo da tempestade de
19/08. **Esse argumento morreu**: os 2 áudios não eram completos.

Placar real, conferido palavra a palavra nas duas rondas:

- **abaixo do piso: 4 de 4 eram dano real** (`8488dc5e`, `ea11989a`, `873fcee4`,
  `8062ac72`). Zero falso alarme. Ontem eu disse "1 de 3"; o certo é **3 de 3**.
- **acima do piso: 1 de 1 testado era falso alarme** — `ec985b5a` (cobertura
  0,667), escolhida de propósito porque o faltante nomeado ("idosa") aparece
  **exatamente 1 vez** no texto, então presença/ausência é inequívoca. A palavra
  **está lá**, em 3,64s.

Ou seja: **o piso é justamente a faixa onde o QA acerta.** Isso reforça o item
(c), não enfraquece.

⚠️ **Limite honesto:** n=1 acima do piso. Eu **não** provei que a faixa
0,65–0,85 está limpa. A minha própria suspeita (de que a régua também entrega
palavra faltando) **não se sustentou no primeiro teste inequívoco** — e eu
registro isso mesmo indo contra o que eu esperava achar. A `33613211` segue sem
veredito porque "mental" aparece 3× no texto dela e a ferramenta casa só a
primeira ocorrência.

---

## 3. Alunos avisados (nenhum dos dois tinha reclamado)

| aluno | o que houve | pago | prova do envio |
|---|---|---|---|
| Luis Felipe (`ibccoaching`) | "Fé" ausente em 2 entregas | **3.844 cr** | Enviados **uid 1610** |
| Gustavo Sperandio | "processa"/"treina" ausentes | **1.269 cr** (3 tentativas) | Enviados **uid 1609** |

Conferi antes: `ler_caixa --de` = nada nos dois. Escrevi mesmo assim porque os
dois **pagaram a repetição de um defeito nosso sem saber que era nosso** — os
dois regeraram por conta própria logo depois de receber o áudio quebrado, que é
a forma exata do caso Marcio que abriu este card.

**O que eu me recusei a prometer:** devolução de crédito. Disse a cada um, com
estas palavras, que não ia dar data nem valor porque não está na minha mão, e
que basta responder pra eu levar na hora.

**O que eu ofereci e posso cumprir:** refazer por conta da casa, sem descontar
crédito, **se o aluno pedir**. Não rodei nada — nada gasta GPU sem o aluno pedir.

---

## 4. Precisa de DECISÃO (não é minha)

1. 🔴 **#226 item (c)** — agora com o número certo na mão: abaixo do piso,
   entregar assim mesmo (hoje) ou falhar? O argumento que segurava a decisão era
   um erro meu de medição e **caiu**. 4 de 4 abaixo do piso eram defeito real.
2. 🔴 **5.113 créditos** dos dois alunos acima. Medido, encaminhado, não devolvido.
3. 🟡 **Capacidade de GPU do Vídeo Clone** — 3 de 4 workers throttled. Fila drena
   devagar; enquanto durar, aluno pagante espera >1h20 sem nenhum aviso na tela.
4. 🔴 Herdados sem mudança: Marcelo (#337, prazo fechou 11/09), reembolso do
   mastroianni (#331), 4 PRs do teto de anexo (#41, #42, #187, #230), 15
   vitalícios (#313), Victor (#309), DDL `104_avisos_enviados.sql`, política da
   janela de garantia (#265).

---

## 5. Pra próxima ronda (o que não refazer)

- **(a)** Marco do #226: `> 2026-09-09 21:46:19.158105Z`, n≥68, abaixo_piso=0.
- **(b)** **NUNCA** use contagem de palavras como controle de completude —
  provado inválido em 2.2. Só `--palavras`.
- **(c)** Pra medir a faixa acima do piso, escolha alvo cujo faltante tenha
  **ocorrência única** no texto. É o único jeito de não ficar em dúvida no fim.
- **(d)** A linha ANTES (184/76/32/8/4) segue conferida; não remeça.
- **(e)** Se Gustavo ou Luis Felipe responderem "pode refazer", execute
  `refazer_audio_conta_da_casa.cjs`.

## 6. Higiene

`git log origin/main..HEAD` vazio no fim da ronda e nenhum fix preso em branch.
A árvore local segue com os arquivos não commitados do `/sgp` (rotas,
`retomada`, `destino`, `messages/*.json`): **não são meus, não toquei.** Commitei
só o meu log.

Não mexi em código, crédito, GPU, migration, acesso, PR nem plano nesta ronda.
