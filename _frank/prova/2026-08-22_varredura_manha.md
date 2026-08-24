# 22/08 — Varredura da manhã

`git pull` na main: `927698a..b8a6214` (5 commits de onboarding da madrugada).

## 1. Os zeros são zeros de verdade

`varredura_travados.cjs` → 1 preso. Reconferido com um script que imprime o
`error` **e** a contagem crua de cada tabela: **nenhuma consulta falhou**.

| tabela | erro | linhas |
|---|---|---|
| voices (uploading/validating/training) | none | 0 |
| training_jobs (queued/running) | none | 0 |
| generations (pending/processing) | none | 0 |
| image_generations (pending) | none | **1** |
| video_clones (pending/generating) | none | 0 |
| react_jobs (fila/baixando/clonando/montando) | none | 0 |

⚠️ **Caí na armadilha 1 duas vezes durante a própria conferência** e só peguei
porque imprimo o `error`: pedi `credit_transactions.description`,
`generations.updated_at`, `video_clones.updated_at` e `incidents.notes` — todas
colunas que não existem. Cada uma teria virado um zero silencioso. Colunas
certas: `credit_transactions.note`, `incidents.resolution_note`, e
`generations`/`video_clones`/`image_generations` **não têm `updated_at`**.

## 2. Os 102 — o número continua medindo a coisa errada

`prova_raio.cjs` → **102** (147 em 18/08). Não reporto isso como queda de 45,
pelo mesmo motivo de `2026-08-19_os_147_nao_eram_pagantes.md`.

`pagante_trancado.cjs` (cruza com a Hotmart, um a um):

| | quantos |
|---|---|
| 🔴 pagou de verdade e está sem acesso | **0** |
| 🟡 fronteira das 12:00 (cobrança devida hoje) | 28 |
| ⚪ inadimplentes | 41 |
| ⚪ cancelaram | 31 |
| ⚪ trial que nunca virou pagamento | 2 |

28+41+31+2 = **102 exatos**. O número fecha inteiro sem sobrar vítima.

Dois detalhes do `prova_raio.cjs` que enganam quem lê a saída crua:
1. a última linha é `>>> DESSES, EXPIRARAM HOJE (18/08)` com a **data chumbada**
   no código (linha 31). Em 22/08 ela compara com `2026-08-18` e imprime 0.
   O número real de hoje é **40**.
2. ele lista só os 25 primeiros, então a saída parece menor que o total.

## 3. Saldo negativo: 34 alunos — NÃO é bug

Achei 34 perfis com saldo negativo (18× `-11575`, 7× `-10000`, 9× `-1575`),
todos com a primeira transação **hoje**, começando 00:27, ainda crescendo às
12:05. Parecia incidente de dinheiro em curso.

É a feature do Johnny de ontem: `b01b7fc`, migration 88,
`debit_credits_onboarding` — função nova **sem** a trava de `insufficient`, de
propósito, pra planilha de onboarding rodar até o fim. A dívida cai em
`credits_extra` porque a recarga da assinatura é um RESET de
`credits_subscription`. `-11575` = 10.000 (treino) + 3×525 (avatares).

**Lição:** antes de abrir incidente de dinheiro, `git log` das últimas 24h. O
comportamento "novo e assustador" era release da véspera, e o próprio título do
commit dizia "aluno fica negativo".

## 4. Dinheiro pendurado: 0

`estorno_confere.cjs` apontou 2 "sem estorno casado". Os dois são falso positivo
— **nunca foram debitados** (0 linhas em `credit_transactions` para aqueles
`ref_id`). A ferramenta compara falha×estorno sem checar se houve débito.

agshortcut@gmail.com (incidente `eef3d4b1`): 40 clones hoje, 31 prontos e
9 falhos — **os 9 estornados automaticamente**, 23.630 créditos. Não é vazamento
de dinheiro; é usuário pesado com ~22% de falha.

## 5. Incidentes: 5 abertos, nenhum de véspera

0,6d Rafael · 0,3d onboarding imagens · 0,2d rajada agshortcut · 0,1d áudio no
Drive · 0,1d Kelly (remoção de conta). O mais antigo tem 14h — o backlog não
envelheceu.

## 6. Recados (`tell_frank`): 4 pendentes, todos já resolvidos → limpos

`para_frank_edc50dc6` (Ketty, incidente `fixed` 21/08 17:45),
`para_frank_5be62ae4` (Eder, `ignored` 17:54),
`para_frank_8379549c_medicao...` (`fixed` 18:38), `para_frank_17873181` (teste).
Nenhum `patch_` esperando.

⚠️ **Bug na própria rotina.** `03_ROTINA.md` (1-B e 1-C) manda apagar a chave com
"`set_state` com value null". `agent_state.value` é **NOT NULL** — o UPDATE
falha nas 4. Tem que ser `DELETE` na linha. Enquanto isso não for corrigido no
manual, todo recado tratado volta na varredura do dia seguinte.

## 7. O que fica pra hoje

1. `image_generations` `e1f7269f` — robson@soulsolucoes.com.br, **8,8h** em
   `pending`, 525 créditos debitados, `kie_task_id` presente
   (`bece80815f...`) e `error_message` vazio. Tem task_id, então **não** é o bug
   da Ketty (aquele era cena *sem* task_id); aqui o teto de 10min simplesmente
   não fecha `image_generations`. Único item preso do sistema.
2. 5 pagantes com crédito e nenhuma voz pronta: jrfengenhariadf (28d),
   leandro.fitoway (23d), ivanildezuca (14d), marcelopersonalthe32 (12d),
   csitya100 (7d).

## 8. O que eu NÃO verifiquei (não conte como saudável)

- **Sweep pelo SSH** — o guard bloqueou: o comando lê `AGENT_MONITOR_TOKEN` do
  `.env.local` e faz `curl`, e isso casa com o padrão "fonte de segredo + canal
  de saída". Prova indireta de que a automação está viva: o estorno automático
  do agshortcut disparou hoje 08:14/08:16.
- **Saúde da GPU** — não consultei os endpoints.

Produção: `fastcloner.com` → HTTP 200 em 0,78s.
