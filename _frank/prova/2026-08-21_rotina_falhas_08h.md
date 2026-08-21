# Rotina das Falhas — ronda das 08h UTC de 21/08 (Frank, dono da fila)

Ordens lidas: `_frank/ordens/README.md` (índice) → `2026-08-20_dono_da_fila_e_fila_zerada.md`
(⭐ vigente) + `2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-19_rotina_das_falhas.md`.

**Fila no início:** 6 abertos (todos `investigating`). **No fim:** 6. **Fechados: nenhum.**
**Zero incidente novo. Zero e-mail não-lido. Produção limpa. Zero preso.**

**O que esta ronda entrega:** o **tamanho real** do defeito de upload (88 arquivos, 15 pessoas,
não 2), a descoberta de **por que ele não virou 15 alunos travados** — e, com ela, a
**refutação do meu próprio alarme**: a conta de 2 do `b9c5a0d1` está certa. Mais a
**reconciliação completa do dinheiro** nas 4 superfícies (208 falhas, 0 pendurado), uma
**armadilha nova e medida no jeito de conferir estorno** que quase me pegou, e uma mina
dormente (`ja_pagou` = 0 na base inteira).

---

## 1. Comecei achando que o detector estava cego de novo. Estava errado.

O `b9c5a0d1` nasceu de um detector cego: media "pagante sem voz" só por `status=failed`, achou
3 quando eram 5. Fui conferir se ele continuava subdimensionado e medi **todas** as 24 vozes em
`rejected_too_short`, cruzando com o dono de cada uma.

**O que achei primeiro (e me assustou):** 17 das 24 têm buraco na numeração do R2. Somando os
índices ausentes: **88 arquivos** que o aluno selecionou e o sistema perdeu, espalhados por
**15 pessoas**. Onze dessas vozes, em 7 pessoas, têm **acesso vivo hoje**. Contra as 2 pessoas
que a fila acompanha.

**O que achei depois (e me derrubou):** fui aluno a aluno ver se os outros 5 estavam travados.
**Não estão.**

| aluno | vozes prontas | gerações feitas | desfecho |
|---|---|---|---|
| `natali.marcio` | 2 | 8 | reenviou, passou |
| `sidbae` | 1 | 7 | reenviou, passou |
| `dirceu.moura.cruz78` | 1 | 4 | reenviou, passou |
| `catarinacouras` | 1 | 3 | reenviou, passou |
| `fabiobragaclone` | 1 | 1 | reenviou, passou |
| **`leandro.fitoway`** | **0** | **0** | **não tentou de novo** |
| **`jrfengenhariadf`** | **0** | **1** | **não tentou de novo** |

Os 5 reenviaram por conta própria e a segunda tentativa passou, quase sempre no mesmo dia ou no
dia seguinte. **A conta de 2 está correta. Retiro o alarme que eu mesmo levantei.**

## 2. A peça que faltava: o defeito é largo E auto-curável

Isto explica a estatística que sustenta o `2c5bab42` (17 de 24 recusadas com buraco, contra 2 de
722 prontas). A leitura natural é *"a perda é rara nas prontas"*. **É leitura errada.**

> Quem reenviou **saiu** da população "recusada" e **entrou** na "pronta". A impressão digital
> não mede a raridade do defeito — mede quem desistiu.

O defeito atinge muito mais gente do que a fila mostra. Ele só não vira incidente porque **o
aluno paga o custo de refazer sem saber que a culpa foi nossa**. Os 88 arquivos são **piso, não
teto**: a objeção do Vigia (a impressão digital é cega à perda na cauda — se o último arquivo
some, não há buraco, a numeração só fica mais curta) **continua de pé**, e agora somo a ela que
a medição também é cega a quem se curou. Não tenho como medir o teto: nas 18 linhas do lote de
18/08 o `raw_audio_paths` original foi sobrescrito pela listagem do R2 e **não existe mais**.

**O que isso muda na prioridade:** não é caso de resgate em massa — 13 dos 15 já se viraram ou
já perderam o acesso. O dano que sobra é o **texto**. Mandamos *"você gravou pouco áudio"* para
15 pessoas de quem comemos 88 arquivos, e o rascunho pendente manda **"regrave"** quando a cura
provada — a que 5 pessoas descobriram sozinhas — é **"reenvie"**. Isto **reforça** o pedido da
ronda das 07h em vez de enfraquecê-lo.

## 3. Relógio novo, mais curto, de uma pessoa que não está em card nenhum

**`dirceu.moura.cruz78` perde acesso em 22/08 12:00 UTC — ~28h.** É o menor prazo do conjunto,
menor que o do `jrfengenhariadf` (25/08, ~100h) que a ronda das 07h reportou como o mais curto.

Ele é a **maior vítima individual** do defeito: perdemos **14 de 20** arquivos numa voz e **7 de
15** noutra — 21 no total — e ele tentou **6 vezes** (2 `rejected_too_short` em 15/08, 1 `ready`
em 16/08, 3 `failed` em 17–18/08).

**Não puxei o gatilho do aviso na hora, e digo por quê:** o gatilho combinado é *"aluno pagante
**travado** sem solução"*. Dirceu **não está travado** — tem voz pronta e 4 gerações feitas. É
perda de acesso de alguém que está usando o produto, não bloqueio. Vai como item do relatório da
noite, não como ping. Registro aqui para não virar surpresa amanhã.

## 4. 💰 Dinheiro: reconciliação completa, e a armadilha que quase me pegou

### A armadilha (nova, medida, não coberta pela ordem)

A ordem de 20/08 diz: *"estorno se confere por `ref_type='generation_refund'`, NUNCA por
`kind`"*. Segui **ao pé da letra** e meu primeiro script devolveu **ESTORNOS = 0** para os 3
alunos do `5c3f1f8b` — exatamente o falso negativo que quase pagou em dobro para 13 alunos, só
que entrando por outra porta.

**São SETE `ref_type` de estorno, não um.** Contados no banco inteiro (15.279 transações,
paginado): `image_video_refund` 71 · `voice_train_refund` 66 · `generation_refund` 46 · mais
`video_clone_refund`, `image_refund`, `support_refund`, `studio_scene_refund`.

**Falha de treino estorna com `voice_train_refund`.** Filtrar `generation_refund` numa voz dá
zero com toda a confiança. Só peguei porque imprimi as linhas cruas antes de acreditar no zero —
de novo, a regra do `ERRO_CRU` é o que separa medição de ficção.

A metade da regra que fala do `kind` está certa. A metade do exemplo é a armadilha. **O jeito
correto:** casar `ref_id` com o objeto que falhou e somar o **sinal** do `amount`, sem presumir
qual `ref_type` serve àquela superfície. *(Correção gravada no `04_PLAYBOOKS.md` nesta ronda — a
tabela dos 7 já existia lá embaixo, o que faltava era o aviso no ponto de uso.)*

### A reconciliação (nenhuma ronda tinha feito inteira)

| superfície | linhas | falhas | com débito casado | **pendurado** |
|---|---|---|---|---|
| `generations` | 3.193 | 38 | 29 | **0** |
| `image_generations` | 3.599 | 41 | 41 | **0** |
| `video_clones` | 1.612 | 54 | 53 | **0** |
| `voices` | 848 | 75 | 48 | **0** |
| **total** | | **208** | **171** | **0** |

**Zero dinheiro pendurado.** Os 3 do `5c3f1f8b` estão quitados um a um: ivanilde (2 vozes,
estornadas no mesmo minuto), marcelo (estornado 4 min depois), csitya (+10.000 em 15/08). O que
falta para eles não é dinheiro, é voz.

**Lacuna de ferramenta registrada:** `estorno_confere.cjs` está **correto**, mas cobre só
`generations` — 1 das 4 superfícies. O item 6 da rotina manda conferir também
`image_generations` e `video_clones`, e até hoje não havia ferramenta para elas. Conferi as três
na mão nesta ronda.

## 5. 🧨 Mina dormente: `ja_pagou` é `false` para 100% da base

Conferido no banco inteiro: **`profiles` com `ja_pagou = true` = ZERO.**

A migration **79 está aplicada** (a coluna existe, eu li o valor). O **backfill nunca rodou**,
então a coluna é `false` por `DEFAULT` para todo mundo. Grep no repo inteiro: **nenhum código em
`frontend/` lê a coluna** — só o próprio `scripts/79_profiles_ja_pagou.sql`.

**Portanto não é bug vivo, e não vou reportar como se fosse.** É uma mina dormente: a regra de
crédito vigente (`2026-08-20_REGRA_FINAL_CREDITO.md`) depende de saber quem pagou, e o primeiro
código que passar a ler `ja_pagou` antes do backfill vai ler **a base inteira como "nunca
pagou"**. É a mesma classe do erro que em 20/08 trancou aluno pagante por confusão entre duas
regras de crédito.

Sigo medindo pagante por `access_until` + saldo. **A Hotmart continua sendo a única prova real**
(playbook do `pagante_trancado.cjs`).

## 6. Os 6 incidentes — por que nenhum fechou

Pergunta 1 da rotina (*"já resolveu sozinho?"*) conferida **ao vivo** em todos. Resposta: **NÃO**
em todos os 6.

| id | o que esta ronda acrescentou | por que não fechei |
|---|---|---|
| `2c5bab42` | tamanho real (88 arquivos/15 pessoas) + o defeito é auto-curável | PR #22 sem merge = não está em produção |
| `b9c5a0d1` | raio inteiro medido; **meu alarme refutado**, a conta de 2 está certa | os 2 seguem sem voz e sem contato |
| `07745f61` | — (mesmo PR #22) | PR sem merge |
| `5c3f1f8b` | **dinheiro dos 3 quitado**, conferido item a item | seguem sem voz; ninguém respondeu |
| `ce6e157d` | — | veredito custa 1 geração = GPU = Johnny |
| `100e7ace` | — | é do Claude; PR #16 ataca a classe |

**Regra 14 respeitada: nada marcado `fixed` sem estar resolvido.**

### A observação de processo que eu devo dizer

**A fila está 6/6 `investigating` há várias rondas, e nenhum dos 6 está parado em mim.** Três
estão em decisão do Johnny (texto do e-mail, merge do #22, 1 geração de GPU) e um é do Claude.
As rondas estão produzindo medição de qualidade e **zero fechamento** — não porque falta
investigação, mas porque a fila **encostou no teto do que eu posso decidir sozinho**. Isso é
sinal para o relatório, não para mais uma ronda de medição.

## 7. Saúde da produção

Últimas 6h: **2 gerações · 11 imagens · 11 clones de vídeo · 1 voz — todos `ready`. Zero
falhas.** **0 registros presos** em estado intermediário (`uploading`/`validating`/`training`,
`pending`/`processing`/`clonando`/`montando`).

## 8. Zumbis, integridade e a caixa

- **1 zumbi, o mesmo de sempre:** `acf8acd6`, `fixed`, `last_seen` há **79,3h** e **esfriando**
  (era 78,3h às 07h). Único dos 66 fechados com `last_seen > resolved_at`.
  `fechados_sem_resolved_at = 0`.
- **`d3d8d1b2` (timeout) NÃO voltou.** Não aparece entre os fechados que dispararam. Segue
  `ignored` por decisão do Johnny. Se voltar: instrumentar o handler para logar **em qual fase**
  o chunk pendura (download da ref? whisper do QA? geração?).
- **10 fechados com `last_seen` < 24h** — todos com carimbo de **20/08**, anterior ao respectivo
  `resolved_at`. Nenhum é classe fechada que segue disparando.
- **`agent_notes`: 72 incidentes, 72 arrays, 0 strings corrompidas.** As 3 anotações desta ronda
  saíram do `anotar_incidente.cjs` (ensaio → `--confirmar`), com **"1 linha afetada"** conferido
  na releitura de cada uma. Nenhum script solto.
- **Caixa:** `--fila` = **0 não-lidos**. Nada novo de aluno. Não toquei em não-lido, não li a
  caixa para triagem (a fila de incidents é a fonte).

## 9. Armadilhas desta ronda

- 🆕 **`ref_type` de estorno são 7, não 1** — seção 4. A regra decorada me deu um zero falso.
- 🆕 **"impressão digital" que mede população recusada mede desistência, não incidência** —
  seção 2. Quem se cura sai da amostra e some da estatística.
- ✅ **Paginei tudo** (`credit_transactions` 15.279, `voices` 848). O teto de 1000 do PostgREST
  corta em silêncio.
- ✅ **Imprimi `ERRO_CRU` antes de acreditar em qualquer zero.** Foi o que pegou a armadilha do
  estorno.
- ⚠️ **Não confundir "acesso vivo + saldo alto" com "pagante".** Com `ja_pagou` zerado na base
  inteira (seção 5), a única prova de pagamento é a Hotmart. Nesta ronda **não** afirmei que
  ninguém pagou — afirmei que a coluna não serve para responder.

## 10. O que está travado no Johnny (para o relatório da noite)

1. 🔴 **Texto do e-mail — agora com o conteúdo confirmado por segunda via.** O certo é
   **"perdemos N dos seus M arquivos, reenvie"**, não "regrave": 3 de 7 no `jrfengenhariadf`,
   **8 de 14** no `leandro.fitoway`. **Reenviar é a cura que 5 alunos acharam sozinhos**
   (seção 1). Prazo: jrf perde acesso em **25/08 (~100h)**.
2. 🟡 **`dirceu.moura.cruz78` perde acesso em 22/08 12:00 UTC (~28h)** — menor prazo do conjunto,
   maior vítima individual (21 arquivos), **não está em card nenhum**. Não está travado (tem voz
   pronta), por isso não virou ping.
3. **Merge do PR #22** — e o registro de que **ele sozinho não fecha o `b9c5a0d1`**: as 18 linhas
   carimbadas em 18/08 continuam erradas depois do merge.
4. **1 geração de GPU** para o veredito do piloto da Katia, antes de **22/08 12:00 UTC**.
5. *(sem pedido, mas agora com número)* **Backfill do `ja_pagou`** — a coluna existe e é `false`
   para 100% da base. Ninguém lê hoje; quem ler primeiro quebra. Seção 5.
6. *(pendente da ronda das 07h)* `feat/incidents-resolved-guard` — gêmeo superado, numera
   migration **85** que o PR #18 já usa. **Sugestão de apagar**, não executada.
   Migrations: main na **84**; 85 e 86 **não aplicadas**.

**Nesta ronda: nenhum e-mail enviado, nenhuma GPU gasta, nenhum crédito mexido, nenhum acesso
alterado, nenhuma migration, nenhum status de voz tocado, nenhuma caixa lida para triagem.**

## 11. Por que NÃO mandei mensagem agora

O gatilho do "na hora" é **pagante travado sem solução**. Os 2 travados (leandro, jrf) já foram
ao Johnny na ronda das 05h — ele já sabe, e o que descobri hoje **confirma** o pedido em vez de
mudá-lo. O relógio novo (dirceu, ~28h) é de alguém que **não está travado**. Ping a cada ronda
mata o sinal que a regra existe para proteger. Vai como itens 1 e 2 da abertura do relatório da
noite.

## 12. Passo fixo de fim de ronda

- ✅ `git fetch origin` + **`origin/main..HEAD` vazio**.
- ✅ Estou na `main`; este log e a correção do playbook foram **direto na main**.
- ✅ Cruzei os branches locais com os PRs abertos — nenhum fix de aluno preso sem PR.
