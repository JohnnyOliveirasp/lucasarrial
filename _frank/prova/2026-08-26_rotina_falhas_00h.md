# Rotina das Falhas — 26/08/2026, ~00h15–00h50 UTC (dono da fila)

`git checkout main && git pull --ff-only origin main` → em dia. Índice de ordens lido.
Valem a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐), a `2026-08-20_REGRA_FINAL_CREDITO.md`
e a de 21/08 (`fd0b0f5`: método serial, regra 7 de fato consumado, regra 8 de e-mail
individual).

## Placar

| | |
|---|---|
| Fila no início | **4** abertos — `97`, `137`, `138`, `139` |
| Fila no fim | **3** abertos — `97`, `137`, `139` |
| Incidente **fechado** | **1** — `138` (`fixed`, commit `9cd5e82`, na main) |
| Incidente que trabalhei e **não** fechei | **2** — `97` (§1) e `137` (§2), com o passo do travamento escrito |
| Fix em produção | **1** — `9cd5e82` (`_frank/`, direto na main) |
| PR aberto, **não** mergeado | **1** — [#57](https://github.com/JohnnyOliveirasp/lucasarrial/pull/57) |
| Aluno avisado por mim | **nenhum** — e digo por quê em §2.3 |
| Crédito indevido devolvido | **nada devido** — conferido, §2 |
| GPU que eu queimei | **nenhuma** |
| Crédito / acesso / `entitlements` que toquei | **nenhum** |
| **Causa que levantei e derrubei com medição** | **1, e é a principal desta ronda** (§2) |
| Post no grupo (regra 7) | **NÃO SAIU** — §4, segunda ronda seguida |

---

## 1. `97` (vídeo clone, drift do rosto) — peguei primeiro, e travou

É o mais antigo com aluno afetado (23/08, 3 alunos), então foi o primeiro pela regra 8.
**Não avancei, e não é por falta de trabalho meu.**

Não há trabalho técnico disponível: o drift em áudio longo é limitação do InfiniteTalk,
medida nos dois tiers, e os três alunos da lista (`rafapaga`, `kessulyl`,
`viniciusramon2009`) **já foram estornados e já foram respondidos**.

**O passo que falta é uma decisão de PRODUTO do Johnny** — formulada na nota [5] de 24/08,
repetida na [8] de 25/08, **sem resposta há ~36h**: ou limita/segmenta a geração longa
(re-ancorar na foto a cada trecho, ou teto de duração por geração), ou segue só avisando
na UI. Muda comportamento e custo do produto; não é triagem e não é minha.

Não reabri, não fechei, não toquei em crédito, não gastei GPU, não escrevi pra aluno.
Segui pro próximo, como a regra 8 manda quando trava.

---

## 2. `137` — **a população do chamado não se confirma, e isso cancela o e-mail em lote**

Este é o achado da ronda. O chamado foi aberto às 23h51 de 25/08 e re-medido pelo Vigia
às 00h19, os dois contando **vozes em `awaiting_training`** — e **nenhum dos dois perguntou
se o dono já tem outra voz pronta**. Perguntei.

### 2.1. O que a medição diz (paginado, 17 vozes / 16 donos)

| grupo | quantos |
|---|---|
| **Já tem pelo menos 1 voz `ready`** — não está preso, não perdeu nada | **14** |
| **Realmente preso** (0 `ready` + passou o portão de 20min) | **1** |
| 0 `ready` e sem `duration` — barrados no portão **com aviso** | 2 |

O único caso real é `oliver_humberto@hotmail.com` (23,3min, saldo 100.000, acesso 155h) —
e ele está parado há **0,4 dia**: entrou hoje e simplesmente ainda não clicou.

Os 2 restantes (`superaspen22`, `emanuelfmguerreiro`) **não são desta classe**: têm
`error_message` dizendo *"seu áudio tem cerca de 2min/5min de fala"*, foram barrados no
portão **com aviso**, e estão com saldo 0 e −1.575.

### 2.2. Os dois relógios de 36h eram falso alarme — conferidos um a um

Foram eles que justificaram abrir o chamado e escalar urgência. `aluno.cjs` nos dois:

- **`danielvsferreira`** tem **3 vozes**. Criou "Voz 2" (`awaiting`, 35min) às **13:50** de
  22/08 e "Voz 3" (**`ready`**, 41min) às **13:54** — **quatro minutos depois**. Abandonou a
  primeira de propósito e segue gerando áudio.
- **`anderferri85`** criou a de 30min em 17/08 e no dia seguinte "MInha Voz de 1 hora"
  (**`ready`**, 59min). Trocou por uma gravação melhor. (Ele **pagou** R$97 em 03/08.)
- **`institutoforumpublico`**, que o Vigia deu como *"prejuízo consumado"*, tem **DEIZI 2.0 e
  DEIZI 3.0 prontas** e usou a plataforma até 21/08.

**O padrão real da classe, que ninguém tinha nomeado:** `awaiting_training` é
majoritariamente **entulho de primeira tentativa** — o aluno grava, não gosta ou quer mais
longo, grava de novo e treina a segunda. A velha fica parada pra sempre. Isso é
comportamento normal do produto, **não aluno abandonado**.

### 2.3. Consequência prática: **retiro o pedido de "pode" do e-mail em lote**

As rondas de 23h40 e 00h escalaram ao Johnny um pedido de permissão pra escrever aos 12.
**Esse e-mail não deve sair.** Mandar *"sua voz está esperando você treinar"* significaria
escrever pra **14 pessoas que já têm voz funcionando**, sobre um rascunho que elas mesmas
descartaram — inclusive pra pagante. É ruído mandado pra cliente satisfeito; o custo é o
oposto do pretendido.

Também **não mandei individual**: o único caso real tem 0,4 dia parado e pode clicar
amanhã. Cutucar alguém 10h depois do upload é barulho, não socorro. Fica pra próxima ronda
conferir se ele passou de 3 dias.

### 2.4. O que segue valendo, e o fix que subiu

O rótulo da lista **é** ambíguo ("Pronta pra treinar" ao lado de "Pronta"), e quem entra
novo na classe não tem sinal nenhum de que falta um clique dele. Revisei o patch do Vigia
(`patch_a3ced7ac`) linha a linha e conferi as três coisas que quebrariam **em silêncio**:

- `--status-warn` existe (`globals.css:56`)
- variante `solid` existe (`ui/badge.tsx:13`)
- o `t` é `namespace:"app"`, então `t("voiceCloning.awaitingHint")` resolve
  `app.voiceCloning.awaitingHint` — **presente nos 3 locales** (conferido lendo o JSON)

`tsc --noEmit`: 0 erros. `eslint` no arquivo: limpo. Branch `feat/awaiting-training-visivel`,
**PR [#57](https://github.com/JohnnyOliveirasp/lucasarrial/pull/57)** com base `main`.

**NÃO mergeei**, por dois motivos: falta o olho humano que o próprio Vigia pediu (ver a
lista com uma voz `awaiting` ao lado de uma `ready`) — eu não abri a app — e merge pra
produção é decisão do Johnny. **Status fica `investigating`: PR aberto não é produção.**

---

## 3. `138` — **FECHADO** (`fixed`, `9cd5e82`)

**Era:** o bloco imprimia `🚨 PAGANTE COM CRÉDITO E SEM NENHUMA VOZ PRONTA`, mas o filtro
(linha 191) é `access_until > now` + saldo — **nunca mediu pagamento**. Trial R$0 tem acesso
vivo igual a assinante, então **4 dos 5 nomes rotulados "PAGANTE" nunca pagaram**. O
`leandro.fitoway` é o mais traiçoeiro: ele *tem* R$97, só que **OVERDUE**, e "existe R$97"
lê como assinante numa passada de olho.

É o mesmo modo de falha que fez o índice **SUSPENDER** a `migration_ja_pagou`, na direção
oposta: lá a coluna lia "nunca pagou" pra todo mundo e **negaria crédito a quem pagou**;
aqui a lista lia "pagante" pra quem nunca pagou e **daria proteção de assinante a trial R$0**.

**Fiz:** rótulo virou `ACESSO VIVO, COM CRÉDITO E SEM NENHUMA VOZ PRONTA`, com a linha
seguinte avisando que acesso vivo ≠ pagou e mandando cruzar com `pagou_de_verdade.cjs`
antes de decidir crédito, mais comentário no filtro explicando a simetria com a migration
suspensa.

**Conferido DEPOIS de gravar**, rodando a varredura: imprime o rótulo novo e **a mesma
população de 5** — mudou só o texto, nenhum critério, nenhuma consulta, ninguém entrou nem
saiu. Nenhum aluno afetado (defeito de rótulo interno), nada a devolver.

---

## 4. O que eu **não** consegui fazer

**O post no grupo (regra 7) não saiu — segunda ronda seguida.** A WAHA só escuta em
`127.0.0.1` no servidor e eu rodo fora dele; não há `~/.ssh/config` nem host conhecido
nesta máquina. Montei a mensagem, rodei `--seco` (texto pronto, §6), e **não vou registrar
como feito o que não saiu**.

A ronda de 25/08 21h registrou exatamente isto e avisou que a regra 7 ia **"falhar calada
toda ronda"**. Falhou de novo. **Isso precisa de decisão do Johnny**: ou abre um caminho
(túnel/SSH/token local), ou a regra 7 muda de canal — senão ela é uma regra que ninguém
consegue cumprir.

**`139` não foi trabalhado.** Cheguei nele com o tempo da ronda no fim. O que já sei da
medição desta ronda, pra próxima não recomeçar do zero: os dois são trial que **nunca
pagou**, a mensagem de recusa que receberam está **correta** (diz "mínimo de 20min" — a
armadilha do texto "10min" da ordem de 21/08 **não** está presente), e o `ycarlosk` gravou
**1,2min** de 20 exigidos. Não há defeito nosso aparente; o que há é a pergunta do Vigia
("ninguém nunca fala com essas pessoas"), que é de produto, não de bug.

---

## 5. Achado de passagem: **20 PRs abertos, o mais velho de 174h**

Não é da minha fila, mas afeta diretamente o significado de "fim" na regra 8 — *fix em
produção*. Medido agora: **20 PRs abertos**, idades de 5h a **174h (7,3 dias)**.

O mais relevante pro `137`: **PR #15** (aberto há **143h**) adiciona `awaiting_training` aos
alvos da varredura. Conferido: `origin/main` **não** tem o estado (o arquivo o exclui de
propósito) e o PR **tem** (`["voices", ["awaiting_training"], 24, ...]`). Ou seja, a
ferramenta que teria mostrado essa classe **6 dias antes** está parada num PR — a classe só
apareceu porque alguém foi procurar à mão em 25/08.

⚠️ **PR #15 não mergeia limpo hoje**: conflito em `varredura_travados.cjs` e no README
(testei o merge e abortei). Precisa de rebase — e agora conflita também com o `9cd5e82`
desta ronda. Registro pra quem for pegar não descobrir no meio.

---

## 6. Texto que deveria ter ido pro grupo

> *Incidente 138 fechado — a varredura dizia PAGANTE pra quem nunca pagou*
>
> A lista diária de "sem nenhuma voz pronta" imprimia a palavra PAGANTE, mas o critério
> dela era só acesso vivo — e trial R$0 tem acesso vivo igual a assinante. Dos 5 nomes de
> ontem, 4 nunca pagaram (um deles com R$97 OVERDUE, que engana a leitura rápida). Trocado
> para ACESSO VIVO, com aviso na própria linha pra cruzar com o `pagou_de_verdade` antes de
> decidir crédito. Nenhum aluno foi afetado: o erro era de rótulo interno. Commit `9cd5e82`.

---

## 7. Perguntas pro Johnny (as três estão travando fila)

1. **`97`** — a decisão de produto do vídeo clone longo está parada há ~36h: limita/segmenta
   a geração, ou segue só avisando na UI?
2. **PR #57** — merge? É rótulo de UI + um render condicional, sem migration e sem crédito.
   Falta o olho de 10s na tela que o Vigia pediu.
3. **Regra 7** — qual o caminho pro grupo a partir desta máquina? Duas rondas seguidas sem
   conseguir postar.
