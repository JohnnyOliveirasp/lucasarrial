# Ronda das falhas — 04/09/2026, 01:49Z (22:49 BRT de 03/09)

Serial: peguei o **#246** (`933fd9d6`). **Não fechei** — o que falta nele é
decisão comercial do Johnny, não trabalho técnico. Mas o incidente mudou de
natureza: a hipótese que ele carregava estava errada, e no caminho apareceu um
defeito novo com um aluno pagante trancado.

Canal: um aviso foi pro **grupo** (`notify-grupo.sh`), ordem de 31/08. Ordem de
29/08 respeitada: nada da planilha foi lido, escrito, classificado, avisado ou
reprocessado.

---

## 0. Primeiro consertei o fim da ronda anterior

`git log origin/main..HEAD` saiu com **1 commit preso**: `f80df19` (o fecho do
dia 03/09) estava commitado e **não empurrado**. É exatamente a falha que a
ordem manda conferir no passo fixo — registro que ninguém enxerga é registro que
não existe, e em 19/08 um fix de aluno ficou 9h preso assim.

Empurrado: `76a5e7d..f80df19`. Conferido depois: `origin/main..HEAD` **vazio**.

---

## 1. Fila conferida antes de escolher

`varredura_travados.cjs`: **6 incidentes abertos**, 12 em `aguardando_aluno`, 2
presos. Nenhum incidente novo de sistema desde a ronda das 00:49Z.

**Por que não peguei os mais antigos** — todos travados em decisão que não é
minha, e nenhuma mudou desde a última ronda:

| # | assunto | trava |
|---|---|---|
| 47 | Katia, palavra cortada | depende do #234; refazer áudio = GPU sem aval |
| 222 | 5 alunos, compra órfã | dinheiro (cancelar/estornar) — prazo **06/09** |
| 226 | áudio reprovado pelo QA | mesma família do #234 |
| 234 | palavra decapitada | `TTS_TAIL_QA_INTERNO_MODO`, +16-19% de GPU |
| 237 | "não conta nada" | 0 alunos afetados |

**Não repiquei o #222 no grupo.** O pedido com a data do 06/09 foi postado às
00:49Z, há uma hora. Repetir agora seria ruído, e ruído mata o canal (regra 7).
A data continua de pé e o pedido continua aberto.

---

## 2. Os 2 "presos" da varredura: os dois estão certos onde estão

Conferi antes de agir, em vez de escrever de novo por cima:

- **`marcelopersonalthe32@`** — 3 e-mails já enviados (uid 58, 182, 341). O
  último, de 29/08, já continha a análise manual do áudio (são duas pessoas na
  gravação, confirmado de ouvido em 8 pontos) **e já avisava do prazo de
  05/09**. Sem resposta dele desde então. `PAGOU` confirmado. Entitlement
  `active` até 05/09 12:00Z.
- **`luanmarcal.com@`** — e-mail de 30/08 (uid 347) explicando que o link do
  Drive está fechado, que o retomar automático foi desligado em 29/08, e como
  reenviar. Sem resposta.

Nos dois casos a bola está com o aluno (regra 8: isso **não** é estar travado).
Não reescrevi: aviso repetido é ruído, e nenhum dos dois bateu os 7 dias que
pedem segunda tentativa.

**Também conferi o #99 e o #172**, que a varredura mostra parados há 11 e 6
dias, porque a descrição dos dois sugeria que a bola era nossa. **Não era**: os
dois receberam resposta técnica longa e específica (Luciano: uid 314, 323, 365;
José Ricardo: uid 275, 287, 420, 424 — incluindo o protocolo de gravação e uma
correção nossa). Estão parados corretamente.

---

## 3. 🔴 O que encontrei: a premissa do #246 estava errada

A ronda anterior fechou o raciocínio do jutai com "o produto do curso não gera
entitlement nenhum" e mandou a ele um e-mail dizendo que **curso e assinatura
são produtos separados**. Fui medir e **não é o que a produção faz.**

O curso "Fábrica de Conteúdo Invisível" é o produto Hotmart **7283335**. Os
**12** `PURCHASE_APPROVED` dele geraram **12 entitlements automaticamente** —
`created_at` cai ~1s depois do `received_at` de cada webhook, status `active`.
O curso **concede acesso em produção**. A afirmação que foi pro aluno conflita
com o comportamento do sistema, e isso é uma correção que devo a ele assim que
a decisão sair.

## 4. 🔴 E o defeito novo: um pagante trancado com 100k de crédito parado

`drfabiovilhena29@gmail.com`. Comprou o curso (HP0654935468, 09/06), criou
conta em 30/08. O claim **funcionou**: vinculou o entitlement, gravou
`plan='pro'`, `access_source='hotmart'` e creditou **100.000 créditos**.

E ele está **SEM ACESSO há 5 dias**, porque `profiles.access_until` ficou
**NULL**.

**Cadeia lida no código, não inferida:** `frontend/src/lib/credits/access.ts`,
`hasActiveAccess()` faz `if (!accessUntil) return false` — e o docstring da
própria função já diz "NULL/passado = sem acesso". O gate que as telas leem é
`profiles.access_until` (`app/layout.tsx:59`, roteiro, videos/clone,
videos/studio, videos/edicao, images, credits, voice-cloning), **não**
`entitlements.access_until`.

**O padrão que explica a causa:** 100% dos **752** entitlements ativos da
assinatura (7851642) têm `access_until` preenchido. 100% dos entitlements de
produto **não-assinatura** têm `access_until` **NULL** (7283335: 11 ativos +
1 chargeback; 7283229: 4 ativos). O caminho da assinatura carimba a data; o
caminho do produto avulso nunca carimba.

**Raio medido, sem inflar — é 1 aluno, não uma enxurrada:**
`profiles` com `access_until` NULL = **1.034**; desses com crédito > 0 = **101**;
desses com `plan='pro'` = **1**, o Fabio.

Os outros 11 compradores do curso **não são vítimas**: nenhum chegou a criar
conta. Esse zero foi conferido com **controle positivo** — a mesma query enxerga
`marcelo` e `jutai`, e `profiles` tem 1.832 linhas. O zero enxerga.

---

## 5. O que eu NÃO fiz, e por quê

**Não preenchi o `access_until` do Fabio.** Fazer isso *é* responder na prática
a pergunta comercial que está parada com o Johnny (curso dá acesso à
plataforma?) — a mesma do jutai e do Jesus Peres. Não é minha alçada.

O argumento a favor está medido e é forte, e foi assim que subiu pro grupo: o
sistema **já concedeu sozinho** a ele `plan='pro'` e 100.000 créditos; o que
falta é só a data que faz o gate funcionar. O que trava o Fabio é um campo em
branco, não uma regra.

**Não escrevi ao Fabio.** Ele não reclamou, e o que eu teria a dizer depende
inteiramente dessa decisão. Prometer antes de saber seria criar expectativa.

Também não cancelei assinatura, não estornei, não mexi em crédito, não gastei
GPU, não refiz áudio, não virei a chave do #234, não apliquei migration, não
mergeei PR e não toquei em nada da planilha.

---

## 6. Pendências com o Johnny

1. **Liberar o acesso do Fabio** — 1 pagante trancado agora. Pedido no grupo.
2. **A pergunta de fundo:** curso dá acesso? Agora com o dado de que a produção
   **já responde "sim"** sozinha. Destrava jutai e Jesus Peres junto.
3. **Cancelar + estornar as duplicadas do #222** — prazo real **06/09**.
4. **#234:** virar o `TTS_TAIL_QA_INTERNO_MODO` (+16-19% de GPU)? Trava o #47.
5. **Migration 102** (`102_incidents_resolved_guard.sql`) segue não aplicada.

## 7. Registro

Nota gravada no #246 (`agent_notes` 9 → 10, 1 linha afetada, conferida na
releitura). Nenhum incidente fechado nesta ronda — e não fechei nenhum porque
nenhum estava resolvido, não para fechar mais rápido do que resolvo.
