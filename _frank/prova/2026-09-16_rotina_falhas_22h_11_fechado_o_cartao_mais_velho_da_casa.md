# Rotina das falhas — 16/09 22h

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Item serial:** **#11** (`9ac03612`), 56,9 d — o cartão **mais velho da casa**.
**FECHADO** (`fixed`, `resolved_at` 20:47:54,972Z). Fila: **89 → 88 abertos**.
0 patch do Vigia. 103 recados `tell_frank` (não tocados).

---

## 0. Como escolhi o item

O mais antigo da fila, e o único dos três mais velhos cujo próximo passo estava
**na minha mão**:

| cartão | idade | por que não era ele |
|---|---|---|
| `#11` `9ac03612` | **56,9 d** | ← **peguei este** |
| `#15` `d3d8d1b2` | 48,3 d | fecha por 30 dias limpos ou ocorrência nova sob a régua nova — relógio corre, nada a fazer hoje |
| `6c38c99d` | 24,2 d | decisão comercial Johnny/Lucas, pedida em 24/08 |

O `#11` tinha `last_seen_at` de **ontem** (15/09 21:46Z) e **nenhuma nota desde
27/08**: reabriu sozinho e ninguém tinha voltado nele.

---

## 1. A condição que o próprio cartão escreveu foi cumprida

A `resolution_note` de 28/08 dizia, literalmente: *"a próxima falha grava o
stderr e REABRE este chamado sozinho"*.

Foi exatamente isso. Depois de **56 dias e 3 ocorrências cegas**, a 4ª nasceu
diagnosticada — job `c90ff577`, `rc=1`, 2.000 chars de stderr.

**Esse é o fato do dia:** um instrumento construído em 28/08 para responder uma
pergunta que a casa não conseguia responder há 5 semanas foi cobrado e pagou.

## 2. O que o stderr diz

`torch.OutOfMemoryError` ao alocar **24 MiB**:

| | |
|---|---|
| capacidade do cartão | 94,97 GiB |
| **livre** | **16,88 MiB** |
| nosso processo | 11,93 GiB |
| `Process 560` | 7,95 GiB |
| **sem dono visível** | **~75 GiB** |

Não é o áudio do aluno: os **mesmos** 3 arquivos `.ogg` / 1696 s treinaram em
**296 s** uma hora depois. Primeiro passo da armadilha (listar `raw_audio_paths`
antes de olhar worker/ffmpeg) feito e limpo.

## 3. A hipótese "concorrência nossa" está derrubada — com controle positivo

Não é medição minha, é da ronda das **00h40Z de hoje**, e eu a reuso em vez de
refazer: no instante da morte havia **1** job nosso sobreposto, por **1,3
segundo**. Controle: dos 1.289 treinos `completed`, **314 (24,4%)** tiveram ≥1
sobreposto e em **14/08** rodaram **8 treinos nossos ao mesmo tempo** — os **8**
entregaram.

**A casa sobrevive a 8 simultâneos.** O que morreu tinha 1,3 s. Sobra **vizinho
externo** no mesmo físico da RunPod — e isso importa porque *nenhuma disciplina
de agendamento nossa previne*.

## 4. 🟠 A armadilha que eu desarmei — e é o motivo de eu ter escrito nota longa

A nota de **21/07** deste cartão diz *"OOM de VRAM — fix `_free_cuda` já na dev
`fdcc75c`"*. Quem ler o cartão de cima a baixo conclui **"o fix de julho
regrediu"** e vai auditar o `free_cuda`. Isso queima uma ronda inteira no lugar
errado.

Conferido no código (`runpod-worker/model_loader.py:37-50`): `free_cuda()` é
`gc.collect()` + `torch.cuda.empty_cache()` + `torch.cuda.ipc_collect()` — solta
a VRAM em cache **do nosso processo**, e só. Ele roda no topo de `train.py
run()`, **rodou nesta falha**, e não tinha como ajudar: a memória que faltou
**não era nossa** (segurávamos 11,93 de 95 GiB).

O detalhe que fecha: o docstring dele descreve 21/07 como *"GPU de 95GB com
18MiB livres"* — **sintoma idêntico** ao de 15/09 (16,88 MiB livres).

**O que eu NÃO afirmo:** que a causa de julho era a mesma. Não dá para
re-diagnosticar 21/07 — a RunPod purga o job em ~9 h e não havia `stderr` antes
da mig 97. **O que eu afirmo:** a cura de julho **não cobre** o mecanismo medido
em setembro.

## 5. O aluno está servido, e não há dinheiro envolvido

Ricardo Olito (`ricardoolito@gmail.com`), conferido na fonte viva:

- voz `f58a158a` **`ready`**, com `lora_path` e `reference_audio_path` gravados,
  transcript completo, `reference_cut_mode=snap_ok`, `trained_at` 15/09 22:53:07Z;
- e-mail de plataforma pronta às **22:53:08Z** (1 h depois da falha);
- **zero linhas** em `credit_transactions` para esta voz — o clone do SGP sai por
  conta da casa (`deveCobrarOnboarding({origem:"sgp"}) = false`), então **não
  houve débito e não há estorno a fazer**;
- plano `pro`, acesso até 23/09, logou **hoje** 19:23Z.

**Não escrevi para ele, de propósito.** Ele nunca viu a falha. Mandar "seu treino
falhou ontem" cria um problema que ele não tem. Registro a decisão em vez de
deixar o silêncio implícito.

## 6. Taxa de base, medida por mim (paginada, não truncada em 1000)

Desde a mig 97 (28/08 18:05Z): **387 treinos, 386 `completed`, 1 `failed` =
0,26%**. **21** treinos `completed` **depois** da falha, o último hoje 20:31Z.
Controle positivo do instrumento: **1 job com `trainer_stderr` de 1 falha
ocorrida — captura 1/1.**

O pipeline está sadio. Isso é o que me autoriza a fechar sem estar varrendo
sujeira para baixo do tapete.

## 7. Por que fecho, e o que reabre

O defeito **deste** cartão era **cegueira**: o worker mandava o motivo
(`train.py:96-101`) e o backend jogava fora. Curado pela mig 97 +
`registrarSaidaDoTrainer`, e agora **provado em produção**.

O que continua vivo — falha transitória virar estado terminal — **já tem dono**:

| cartão | o quê | estado |
|---|---|---|
| `#422` `bb4d4cd0` | sem retentativa para falha transitória | decisão de GPU do Johnny |
| `#421` `1fbdba8f` | pedido do SGP `falhou` sem caminho de refazer | decisão do Johnny |

Manter o `#11` aberto seria **contar a mesma pendência em três cartões**. A
assinatura `training:bug:trainer failed` segue intacta e o cartão **reabre
sozinho** na próxima falha — já reabriu duas vezes (10/08 e 27/08) —, agora com
o stderr junto.

**Não afirmo que a OOM não volta.** Afirmo que, quando voltar, chega com o
motivo escrito.

## 8. O que eu NÃO fiz, e por quê

- **Não mexi na assinatura** `training:bug:trainer failed`. A tentação era
  classificar a causa no `error_message` para separar OOM de disco-cheio. O
  `classify.test.ts` **trava esse valor de propósito** e a razão está certa:
  traceback varia a cada ocorrência e estilhaçaria o cartão. Com o stderr em
  coluna própria, o diagnóstico já está disponível sem pagar esse preço.
- **Não escrevi retentativa e não abri PR.** Gasta GPU; a ordem permanente é
  clara e a decisão é do Johnny (`#422`).

---

## Fim de ronda

- Fila: **89 → 88** abertos.
- `#11` `fixed`, `resolved_at` 2026-09-16T20:47:54,972Z, relido de forma
  independente depois de gravar (1 linha afetada, não ensaio).
- Sem branch de código nesta ronda: **nada de código foi alterado**. Só o log,
  direto na `main`.

---

# ADENDO — o passo fixo achou um fix preso em branch há 19 horas

Isto entrou **depois** de eu ter fechado o `#11`, e muda o desfecho da ronda:
**subi código para produção.**

## 9. `PR #308`, aberto desde 16/09 01:25Z, parado 19,4 h

O passo fixo de fim de ronda (*"conferir que não ficou fix preso em branch"*)
devolveu `feat/oom-assinatura-propria` — 1 commit fora da `main`, **PR #308
ABERTO**, base `main`, **sem review, sem check, sem comentário**. Nenhuma ronda
justificou tê-lo deixado aberto; o Vigia das 10h só o listou entre "19 PRs
abertos".

Ele é a continuação do `#420` e trata **exatamente este cartão**.

**O defeito que ele conserta é o que eu tinha acabado de descrever sem saber que
já havia cura escrita:** como o worker manda as mesmas três palavras `trainer
failed` em toda falha, o OOM de ontem caiu em `training:bug:trainer failed` —
**foi engolido por este cartão** — e ainda saiu com `cause='bug'`: uma falha de
**infraestrutura** carimbada como defeito nosso.

## 10. Não mergeei na palavra do commit

Verifiquei em **worktree isolada**, porque commit message não é prova:

| conferência | resultado |
|---|---|
| merge da `main` atual | **sem conflito** |
| suíte `incidents` + `voices` | **151 testes, 0 falhas** |
| `tsc --noEmit` | **exit 0** |
| dependências (`package.json`) | **intocadas** |

E o controle que realmente decide, rodado contra o **stderr real de produção** do
job `c90ff577` (não texto inventado):

| entrada | causa | assinatura |
|---|---|---|
| **sem** `diag` | `bug` | `training:bug:trainer failed` ← idêntico ao de antes |
| **com** `diag` | **`infra_gpu`** | **`training:infra_gpu:cuda-oom`** |

Título gerado: *"Treino de voz: GPU sem memória (OOM) — transitório, repetir
costuma curar"* — o chamado passa a **dizer a conduta**.

**Controle negativo** (o que me faria recusar o PR): um traceback que apenas
**cita** `/usr/local/cuda` continua `bug` e **não** vira OOM falso. A regra larga
`includes("cuda")` teria estragado isso; o detector exige o texto do OOM.

A compatibilidade importa: as **70 falhas cegas** da tabela dependem de o
comportamento **sem `diag`** não mudar. Ele não muda — conferido, não assumido.

## 11. Em produção

`PR #308` mergeado em **`8b46493`**, deploy *Deploy Frontend (production)*
**`completed/success`**. **Não depende de DDL nova** — a mig 97 já estava
aplicada, e isso está provado pelo próprio `c90ff577` ter `trainer_stderr`
gravado (coluna no banco, não DDL commitada).

## 12. O que isso muda para o `#11` — e por que ele continua `fixed`

O `#11` **para de receber OOM** e fica sendo o que sempre foi de fato: o
guarda-chuva das falhas de trainer **sem diagnóstico**. As 4 ocorrências ficam
onde estão, **sem migration de reassinatura**: 3 das 4 são cegas para sempre
(jobs purgados pela RunPod, `trainer_stderr` e `trainer_returncode` nulos) e
reassiná-las seria **inventar causa**. Se o `last_seen_at` dele envelhecer, isso
vira **informação** (nada cego novo chegando), não sintoma.

O próprio PR recomendava *"fechar o #11 com nota apontando para este PR"*.
Fechei **antes** de achar o PR, por outro caminho, e a recomendação bateu com a
decisão. Nota e `resolved_commit=8b46493` gravados no cartão.

## 13. A lição que eu levo desta ronda

O passo fixo de fim de ronda **não é burocracia**. Nesta ronda ele foi o item de
maior valor: achou, parado há 19 horas, o fix que impedia o próximo OOM de ser
engolido justamente pelo cartão que eu estava fechando. Sem ele, eu teria fechado
o `#11` e o próximo OOM reabriria o guarda-chuva cego — com a cura pronta,
testada e a um merge de distância.

**Há 19 PRs abertos.** Não os auditei: fogem do recorte serial desta ronda. Fica
escrito como dívida visível, não como coisa que eu fingi não ter visto.

---

## Fim de ronda (revisado)

- Fila: **89 → 88** abertos.
- `#11` `fixed`, `resolved_at` 20:47:54,972Z, `resolved_commit` `8b46493`, relido
  de forma independente.
- **Produção:** `PR #308` → `8b46493`, deploy **success**.
- `origin/main..HEAD` **vazio**; nada preso local.
