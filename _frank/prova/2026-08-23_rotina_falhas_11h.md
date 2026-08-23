# 23/08 ~11h UTC — Rotina das Falhas (dono da fila)

`git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido. Valem a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐) e
a `2026-08-21_passagem_incidentes_para_claude.md` (mais nova do assunto, sem
bloco `⛔ SUPERADA`; segue **fora** do índice, que parou em 20/08). Método serial
e comunicação pela ordem de 21/08 (`fd0b0f5`).

**Peguei UM incidente e levei até o meu limite.** Não abri o segundo.

---

## Placar

| | |
|---|---|
| Incidentes na fila no início | 2 (`7963388e`, `85ffef6b`) |
| Peguei | **1** — `7963388e` (Kessuly) |
| Fechei | **0** — e explico exatamente por quê (seção 4) |
| Aluno avisado | **1** — Kessuly, e-mail enviado |
| Escalado com nome e canal | **2** — ouvido humano (grupo) + dinheiro (Johnny) |
| Crédito que eu mexi | **nenhum** |
| GPU que eu gastei | **nenhuma** |

---

## 1. Por que escolhi o `7963388e`

Regra 8: o mais antigo aberto com aluno afetado. `7963388e` é de 22/08 22:10,
`85ffef6b` é de 23/08 00:16. Não houve empate a desempatar.

A varredura também mostrou **4 pagantes sem voz pronta** (jRF 29 dias, Leandro
24, Ivanilde 15, Marcelo 13). Fui conferir antes de tratar como fila escondida:
os dois mais antigos (jRF e Leandro) estão no `2c5bab42`, que está `fixed` com
nota dizendo *"7 alunos com crédito intacto e avisados por e-mail em 21/08 pra
reenviar"*. Ou seja: bola no campo deles desde 21/08, e **esperar resposta de
aluno não é estar travado** (regra 8). Não reabri e não invadi o caso.

---

## 2. O que eu medi (banco + arquivos baixados do R2, não é leitura de tela)

1. **Causa do "embolado" confirmada mecanicamente.** A referência que clonou a
   voz dela (voz `c3514f54`, `.../ref/auto.wav`) tem **exatamente
   30.000000s** no `ffprobe`. É corte de **janela fixa**, que cai no meio da
   palavra — mesma classe da Kátia (item 2 da ordem de 20/08). **Não é a
   gravação dela**: os 40min (2396s) de material estão bons.
2. **Mesmo texto, durações diferentes.** Os mesmos 1259 caracteres deram
   **97,9s** em 19/08 (`16f695a5`) e **78,3s** no refeito de hoje 01:50
   (`36e2583e`) — 19,6s / ~20% de diferença, mesma voz e mesma referência.
3. **Alguém já refez o áudio dela de graça e não registrou em lugar nenhum.**
   A generation `36e2583e` (23/08 01:50) tem texto real (1259 chars) e **não tem
   linha em `credit_transactions`**. Conferi as `ready` dos últimos 3 dias: é a
   **única** com texto real e sem cobrança (as outras sem cobrança têm
   `text_normalized` null, que é o caso normal de sample/onboarding). Assinatura
   do `refazer_audio_conta_da_casa`. **Não está em nenhum log de ronda.**
4. **Mas o refeito usou a MESMA referência de 30s** — então ele não pode ter
   curado um defeito que mora na referência. Refazer geração não é cura aqui.
5. **O Vídeo Clone `4e35fd9c` foi montado em cima do áudio `16f695a5`**, que é
   justamente o que ela reclama. Isso liga o defeito de voz ao vídeo que ela
   pagou — e é o que muda a cara da decisão de dinheiro.
6. **Estorno conferido por `ref_type`, nunca por `kind`** (armadilha de 20/08):
   **não existe `video_clone_refund`** pra ela. O +10.000 de 19/08 é
   `ref_type=voice_train_refund` (`kind=extra_purchase`), do treino `594ef998`
   que falhou — assunto diferente, e esse já voltou. Os **−9.240** de 19/08
   18:43 seguem **não devolvidos**.

---

## 3. O que eu fiz (fato consumado, não plano)

- **Escrevi pra ela.** SMTP do suporte@, bcc suporte@lucasarrial.com, enviado ok.
  A pergunta de dinheiro dela é de 22/08 15:48 UTC e estava **~19h sem resposta
  nenhuma** — a Fast respondeu voz e fotos e deixou o dinheiro em branco. Contei
  a verdade: os 10.000 já voltaram, os 9.240 **não** voltaram, a decisão está com
  quem decide, e **ela não precisa cobrar de novo**. Expliquei a causa dos 30s
  com as palavras dela (*"non sá onde"*) e disse que **não vou afirmar que está
  resolvido**, porque o refeito usou a mesma referência. **Não prometi valor
  nenhum** (dinheiro = Johnny, playbook seção N).
- **Mandei pro grupo da equipe** (WAHA no servidor, HTTP 201, id
  `3EB0F36ED7A253FEB5297F`) os **dois** áudios com URL assinada de 24h e a
  pergunta objetiva: *o de 23/08 ficou melhor que o de 19/08?* Isso é ouvido
  humano — **eu não julgo qualidade** (regra 9-D).
- **Mandei a pergunta binária pro Johnny** no Telegram (`message_id 310`):
  devolvo os 9.240, SIM ou NÃO.
- **Anotei o incidente** (`anotar_incidente.cjs --confirmar`, conferido na
  releitura: **1 linha afetada**, `agent_notes` 3 → 4, status `investigating`).

---

## 4. Por que NÃO marquei `fixed`

Falta o que **não está no meu alcance**:

- **(a) o veredito de ouvido** sobre os dois áudios, que decide se aplico o
  recorte novo da referência. **Não aplico sem isso**: o playbook registra um
  recorte de referência que **piorou** e teve que ser revertido. Mexer na voz da
  aluna no chute seria trocar um defeito por outro.
- **(b) a decisão do Johnny** sobre os 9.240.

Os dois foram encaminhados **com nome e canal**, hoje. Marcar `fixed` aqui seria
mentira (regra 14). Fica `investigating` **com nota**, que é o que a regra manda.

---

## 5. O que eu NÃO fiz, de propósito

- **Não automatizei a cura da referência.** Exige **timestamps de palavra**;
  heurística por energia foi **REPROVADA duas vezes** e a ordem diz explicitamente
  pra não subir. Não tentei.
- **Não medi o defeito 2** (face do Vídeo Clone mudando). Continua **sem medição
  nenhuma** nossa. O primeiro passo continua sendo **medir, não consertar** — foi
  junto no pedido ao grupo.
- **Não abri o `85ffef6b`** (Daniel). Segue `open`. É comercial: o Frank já mediu
  na madrugada que ele **nunca pagou** (0 assinaturas, 0 `PURCHASE_APPROVED`).
  Não é meu para fechar como `ignored` — junto com o Luciano, são **dois alunos
  em 24h** com a mesma expectativa errada, e o Vigia tem razão que ela nasce no
  material de venda, não no suporte.
- **Não toquei em crédito, não gastei GPU, não mexi em cron, não rodei migration.**

---

## 6. Buracos que continuam abertos (não conte como saudável)

- **O refeito de graça da Kessuly não está em nenhum log.** Alguém rodou o
  `refazer_audio_conta_da_casa` na conta dela às 01:50 e não registrou. Sorte que
  eu fui conferir cobrança; se tivesse confiado no extrato de relance, teria dito
  pra ela que nada foi feito.
- **Turno da noite segue vago** (item 1.1 do Vigia das 10h): cron 6–21 contra uma
  ordem que diz que a Rotina das Falhas 24h está "em execução". Não mexi no cron
  — mas o buraco ~21:40→06:40 continua real e agora tem duas rondas registrando.
- **Os 4 pagantes sem voz** (jRF, Leandro, Ivanilde, Marcelo). jRF tem acesso até
  **25/08** — dois dias. Foram avisados em 21/08 e não voltaram. Não é bloqueio
  nosso hoje, mas se ninguém reencostar neles, o prazo do jRF vence sozinho.
- **`acf8acd6`** — quinta ronda sem confirmar se `74ae65a`/`1e5a893` estão em
  produção. Não foi meu foco nesta ronda e não vou fingir que olhei.

---

## 7. Higiene do repositório

Continuam **não commitados** na `main`, de rondas anteriores (**não são meus,
não toquei**): `_frank/prova/lgpd/` (untracked, decisão consciente da rotina das
22h por conter dado pessoal de aluna) e os modificados
`_frank/ferramentas/resgatar_voz.cjs` e
`_frank/ferramentas/2026-08-21_medir_8379549c.cjs`.

Investigação desta ronda ficou em `_Bugs/kessuly/` (fora do git, como manda o
README das ferramentas). Commitei **apenas este arquivo**, por caminho explícito.

---

## 8. ADENDO — o passo fixo de fim de ronda achou conserto preso, não log preso

`git fetch && git log --oneline origin/main..HEAD` saiu **vazio** e o log desta
ronda está na `main`. Mas a varredura de branches (`git rev-list main..<branch>`)
achou coisa mais séria que log perdido: **os dois consertos que resolveriam os
casos mais caros da fila estão em PR aberto, sem review e sem check.**

| PR | o que é | aberto desde | review |
|---|---|---|---|
| **#16** `feat/ref-corte-em-palavra` | referência cortada em **fronteira de palavra** via `word_timestamps` | **20/08** (3 dias) | **nenhuma** |
| **#29** `feat/resgate-voz-failed` | `resgatar_voz` aceitar voz `failed`, refiltrando `raw_audio_paths` + `ffprobe` | **21/08** (2 dias) | **nenhuma** |

**O #16 é a cura do defeito que eu diagnostiquei hoje.** E é pelo caminho que a
ordem manda: `word_timestamps` do whisper — **não** é a heurística por energia
reprovada duas vezes. Tem `test_reference_word_snap` 20/20 e `test_coverage_qa`
38/38, e o segundo commit fecha o buraco de "todas as candidatas descartadas"
caindo pro corte por tempo de hoje, então **nunca rende menos que o
comportamento atual**. A descrição do próprio PR diz: **1 em cada 3 vozes novas**
nasce com a referência decapitada. Isso não é a Kessuly e a Kátia — é **1/3 de
tudo que entra**, a cada dia que ele fica parado.

**O #29 é o buraco da seção 4 da passagem de 21/08** (card `39028572`): hoje não
existe como refazer um treino `failed` sem cobrar o aluno. É o que destrava
**Cláudio** (parado 15/08) e **Marcelo** (parado 10/08).

**Não mergei nenhum dos dois, de propósito.** Os dois mexem no `runpod-worker`
(pipeline de voz na GPU): **merge na `main` não basta, o worker precisa ser
redeployado** — "só a main deploya" não vale pro worker. Isso é decisão e deploy
do Johnny, e mandei a pergunta pra ele no Telegram (`message_id 311`).

Registro a lição: o passo de fim de ronda foi desenhado pra achar **log** preso
em branch (19/08, 9h). Hoje ele achou **conserto** preso em PR há 3 dias. Vale
mais como varredura de PR aberto do que de branch órfã.
