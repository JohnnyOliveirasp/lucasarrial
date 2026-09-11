# Ronda das falhas — 11/09/2026, ~13h40–14hZ

Método serial (regra 8, ordem de 21/08). Canal: ordem de 31/08 — tudo de FastCloner
no **grupo**, nunca no privado.

**Esta ronda não fechou nenhum incidente.** O que ela fez foi impedir que a casa
falhasse pela **terceira vez** com o mesmo aluno, e pôr dois relógios na frente do
Johnny antes de fecharem. Escrevo o zero na cara porque o número é esse.

---

## O que saiu daqui

| fato | onde |
|---|---|
| **1 promessa não-cumprível achada**, mandada ao aluno HOJE 11:26Z | nota no `71410a81` (11 → 12 notas, 1 linha) |
| **2 relógios escalados** ao Johnny, os dois precisando da palavra dele | grupo, marcado urgente |
| **0 incidente fechado, 0 e-mail a aluno, 0 crédito movido, 0 GPU, 0 PR, 0 migration** | — |

---

## 1. Marcelo — **prometemos hoje o que o gate recusa** · registrado, não fechado

O alvo serial era o aluno mais antigo sofrendo de verdade: `marcelopersonalthe32@gmail.com`,
**32 dias** desde 10/08 sem nenhuma voz pronta, pagante desde 05/08 (3 recargas de ciclo),
298.950 créditos. O erro gravado na voz diz que a falha de 10/08 foi **nossa**
(`[Errno 28] No space left on device`, incidente `9119254c`).

**Material intacto, e ainda assim irresgatável.** `listar_arquivos_da_voz` (a armadilha
manda listar os ARQUIVOS primeiro, antes de olhar worker/ffmpeg): 1 arquivo, 47min05s,
45.2MB, passa o portão de 20min com 27min de folga. Mas `resgatar_voz.cjs` na voz
`f6f82819-9d12-4e2a-88ca-99038d756264` **RECUSOU**, e recusou certo:

| medida | valor |
|---|---|
| F0 mediana | 192,8 Hz (p25 97,6 · p75 250,0) |
| IQR | **152,4 Hz** (limiar do gate: 100 Hz) |
| abaixo de 160Hz (masculina) | 46,3% |
| 160Hz ou mais (feminina) | 53,7% |
| janelas vozeadas | 536 |

Duas pessoas no mesmo arquivo. Nenhum job foi disparado, nada foi gravado.

**O achado desta ronda.** O e-mail que saiu para ele **hoje às 11:26Z** (Enviados
uid 1719) diz, com todas as letras: *"Os seus 47 minutos de áudio continuam guardados e
intactos... eu mando treinar a sua voz de novo por conta da casa... É só responder este
e-mail dizendo 'pode treinar'."* E antes: *"Você tinha enviado 47 minutos de gravação,
material mais que suficiente"*, *"não foi o seu áudio"*.

**É o contrário do que a própria casa provou em 29/08** (Enviados uid 341), quando a
gravação foi **ouvida em 8 pontos** do começo ao fim e confirmada como uma consulta com
duas pessoas — um homem perguntando, uma mulher respondendo, ~45/55. Aquele e-mail estava
certo e foi medido com cuidado. O de hoje desfaz a medição sem remedir.

**Por que isso é grave e não é detalhe:** se o Marcelo responder *"pode treinar"*, o
caminho para cumprir não existe. Forçar com `--ignorar-locutor` é **exatamente** o que
produziu o incidente `5c3f1f8b`/`#65` em 25/08 — nesta mesma voz: o treino completou
(500 steps, 330s) e o `finalize-training` gravou no histórico dele uma amostra `ready`
que era a voz da **entrevistadora** (F0 197,5Hz, 91,6% na faixa feminina). Cumprir a
promessa de verdade exigiria **diarização** para separar a fatia dele; a casa não tem
essa ferramenta, e eu não vou prometer que terá.

**Não mandei um quarto e-mail hoje.** Ele já recebeu dois (10:47Z e 11:26Z), ele **pediu
para sair**, e escrever de novo agora para desdizer uma oferta que ele provavelmente não
vai aceitar é ruído em cima de quem já está insatisfeito. O que fiz foi **registrar**, para
que quem pegar a resposta dele saiba a verdade antes de rodar qualquer coisa. Se ele
responder *"pode treinar"*, a resposta honesta está escrita na nota.

---

## 2. Os dois relógios que escalei (nenhum deles é minha alçada)

**Marcelo — R$97, fecha hoje 00:00Z (12/09).** Ele pediu para sair em **09/09 16:37**,
dentro do prazo. A mensagem chegou **vazia** por bug nosso (`dfdee26f`: o `mailText`
adivinhava a fronteira MIME e o separador de encaminhamento do Gmail casava nela) e ficou
um dia sem resposta. Cobrança 05/09, garantia até 12/09 00:00Z. Já foi dito a ele, por
escrito, que peça direto na Hotmart — caminho que não depende de nós, e foi certo ter
dito. **Falta só a autorização da devolução, que não é minha.**

**Hellen Grasso — porta fecha amanhã 12:00Z.** Medido:

- `pagou_de_verdade.cjs`: **PAGOU** — avulsas 597 BRL (SGP) + 47,94 GBP (Fábrica), as duas
  `APPROVED` em 05/09.
- `profiles`: `access_until = 2026-09-12T12:00:00Z`, `credits_subscription = 95.375`,
  `plan = pro`.
- `entitlements`: 1 linha, produto `7851642`, `active`, mesmo `access_until`.
- A assinatura da plataforma dela é o **trial de 0 GBP**. É ele que vence amanhã.

Pela **regra final de crédito** (20/08 — *"quem já pagou fica com o crédito e com as
portas"*, e o critério é **pagamento, não status de assinatura**) ela não deveria perder
nada. **Não toquei em acesso nem em crédito** — é decisão do Johnny.

⚠️ E ela é o **caso vivo** da ordem SUSPENSA da `migration 79`: `ja_pagou = false`,
`ja_pagou_em` e `ja_pagou_origem` nulos, para quem pagou ~R$644. Qualquer caminho que
leia essa coluna lê "nunca pagou" nela.

**Sobre o zeramento automático: NÃO é o risco dela.** Conferi em vez de supor —
`dryrun_trial_expiry_v2.cjs` hoje 13:42Z: nem `hellengrasso` nem `marcelopersonal`
aparecem na lista, e a rodada **abortaria inteira** de qualquer jeito (192 pessoas /
15.343.550 créditos contra um teto de 20 débitos reais). O risco dela é o
`access_until` vencendo sozinho, não um job.

---

## O que continua parado (herdado, não tocado nesta ronda)

| | idade | passo em que está |
|---|---|---|
| `#304` Emanuel — 180,81 EUR, garantia vencida | 122d | palavra do Johnny |
| `#341` `b633b18c` — 16 pessoas, crédito a devolver | ~25h | palavra do Johnny (teto 9-B) |
| `#313` `2d0509b4` — 15 vitalícios de graça | 63,5d | ordem de conserto anotada |
| `#331` `3528dd59` — Mastroianni | ~37h | reposição de crédito |
| `#244` — tela de alterar senha | 8d | decisão de produto |
| `71410a81` — janela de garantia ancorada errada (57 alunos) | 6d | não é de uma ronda só |
| PR **#92** em DRAFT | 15 dias | — |

## Números da ronda

- **71 → 71** em `open`/`investigating`. Não fechei nada, então o número não se moveu.
  Não vou maquiar isso: o tempo foi para provar que uma promessa recém-enviada era falsa,
  e isso não aparece no placar.
- **2 itens presos** na varredura (os dois acima), **10 aguardando aluno**.
- Caixa lida só com `EXAMINE` + `BODY.PEEK`, busca `SEEN`. **Não toquei em não-lido.**
  0 e-mail enviado nesta ronda.
- 🧹 Higiene, **estável**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais os não rastreados em
  `_frank/rascunhos/`. **Décima terceira ronda seguida.** Não são meus, **não toquei**;
  commitei só este log. Scripts de investigação ficaram em `/tmp`, fora do git.
- Custo desta ronda: leitura + 1 nota. **0 GPU, 0 crédito, 0 visão paga.**
