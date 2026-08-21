# Rotina das Falhas — ronda das 07h UTC de 21/08 (Frank, dono da fila)

Ordens lidas: `_frank/ordens/README.md` (índice) → `2026-08-20_dono_da_fila_e_fila_zerada.md`
(⭐ vigente) + `2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-20_correcoes_da_ronda.md`.

**Fila no início:** 6 abertos (todos `investigating`). **No fim:** 6. **Fechados: nenhum.**
**Zero incidente novo. Zero e-mail novo de aluno. Produção limpa.**

**O que esta ronda entrega:** o **mecanismo** do `2c5bab42` — a linha de código que converte
perda nossa em acusação ao aluno —, **prova por aluno** nos 2 pagantes do `b9c5a0d1` com os
índices do R2, uma **fronteira de classe** medida (os 3 `failed` NÃO entram), **três hipóteses
minhas refutadas** antes de virarem teoria, e um aviso que muda o pedido pendente ao Johnny:
**mergear o PR #22 não fecha o `b9c5a0d1`.**

---

## 1. 🔴 O achado: quem escreveu `rejected_too_short` foi o NOSSO SWEEP, retroativamente

Até agora o `2c5bab42` tinha **correlação** (17 de 24 recusadas com buraco na numeração, contra
2 de 722 prontas). Agora tem **mecanismo**.

**Medido:** 18 das 24 vozes em `rejected_too_short` foram atualizadas num **único lote em
2026-08-18, entre 10:40:13 e 10:50:44 UTC** (~10 minutos). O gap criação→update vai de **0h a
716h** — linhas de até **30 dias** antes foram carimbadas naquele lote. Não é coincidência de
horário: é o `rescueStuckVoiceUploads()` varrendo pela primeira vez o acervo preso em
`uploading` (playbook A).

**O que o sweep faz** (`lib/voices/rescue-stuck-uploads.ts`, main hoje):

1. `audiosNoR2()` **lista o R2** e devolve só o que sobreviveu;
2. `.update({ raw_audio_paths: chaves, duration_seconds: total, ... })` — **sobrescreve**
   `raw_audio_paths` com a listagem do R2;
3. `total < 20min` → `status='rejected_too_short'` + `Áudio total ${min}min < mínimo de 20min`
   (linha 116).

> A duração e a mensagem são calculadas sobre os arquivos **que chegaram**, nunca sobre os que
> o aluno **selecionou**. O sistema perde os arquivos e depois avisa o aluno que **ele** mandou
> pouco áudio.

E o sweep **não avisa ninguém**: o "avise o aluno por e-mail" do playbook A é passo manual. Em
18/08, 18 vozes mudaram de estado em silêncio. É por isso que os 2 pagantes constam como
"nunca contatados" — não houve a quem contar.

## 2. Prova por aluno, conferida no R2 ao vivo (não só no banco)

| aluno | índices presentes no R2 | buraco | selecionou ≥ | perdemos | mensagem que ele vê |
|---|---|---|---|---|---|
| `jrfengenhariadf` | [0, 2, 3, 6] | [1, 4, 5] | **7** | **3** | "Áudio total 10min < mínimo de 20min" |
| `leandro.fitoway` | [6, 7, 8, 10, 12, 13] | [0,1,2,3,4,5,9,11] | **14** | **8** | "Áudio total 10min < mínimo de 20min" |

O carimbo do `jrfengenhariadf` é de **18/08 10:42:49Z** — 24 dias depois do envio dele (25/07).
O do `leandro.fitoway` é de **18/08 10:48:21Z** — 19 dias depois (30/07). No caso do leandro
**comemos mais da metade do envio** e devolvemos uma frase dizendo que ele gravou pouco.

## 3. Três hipóteses minhas, levantadas e DERRUBADAS nesta ronda

Registro as refutações porque hipótese não testada vira teoria e este incidente já teve **duas
causas cravadas errado** por dois agentes.

1. **"O sweep mede FALA e compara com régua de áudio TOTAL"** — seria bug grave (rejeitaria
   quem tinha 20min). **REFUTADA:** o sweep usa `est.totalSeconds`, que vem do `Duration:` do
   ffmpeg (áudio bruto), não `speechSeconds`. A régua está correta nesse ponto.
2. **"A provenance de `raw_audio_paths` difere entre recusadas (sweep) e prontas (cliente),
   logo o 17-de-24 × 2-de-722 é artefato"** — isto anularia a impressão digital inteira.
   **REFUTADA:** `uploads-complete` grava `body.uploaded_keys` (o que o browser conseguiu
   subir) e o sweep grava a listagem do R2; as duas refletem **ausência real no R2**. A
   comparação sobrevive nos dois caminhos.
3. **"Nosso sanitizador corrompe o nome do arquivo"** — as 6 chaves do leandro têm dígito solto
   no meio do nome (`WhatsA2pp`, `_2Audio`, `a2t`, `20262`, `Whats4App`, `WhatsApp42`).
   **REFUTADA:** `buildRawAudioKey` usa `filename.replace(/[^a-zA-Z0-9._-]/g,"_")`, que
   **substitui** e nunca **insere** caractere. Vem do lado do cliente. **Não cravo causa** —
   registro para não virar teoria alheia na próxima ronda.

## 4. Fronteira da classe, medida (resultado negativo que fecha uma porta)

Os 3 pagantes em `failed` — `ivanildezuca`, `csitya100`, `marcelopersonalthe32` — têm numeração
**contígua, buraco ZERO** (`[0,1,2,3]`×2, `[0..19]`, `[0]`), conferido no banco **e** no R2.

Consequência que importa: os e-mails **já enviados** a ivanilde e csitya (uid 202/203, 01:09),
que afirmam *"não foi defeito do sistema"*, **não ficaram falsos** com este achado. A tentação
de esticar a classe existia; a medição a barra.

## 5. ⚠️ Isto muda o pedido pendente ao Johnny

**a) O rascunho de e-mail dos 2 pagantes está errado para eles.** O texto que espera o "pode"
manda **regravar** até somar 20–25min. O leandro mandou **14 arquivos** e nós comemos **8**.
Eles não precisam gravar mais — precisam **reenviar**. Mandar "regrave" é repetir por e-mail a
mesma acusação que o sweep já fez no painel. A ronda das 05h marcou o texto como perigoso;
agora está **quantificado por aluno**.

**b) Mergear o PR #22 NÃO fecha o `b9c5a0d1`.** Conferi a cobertura do fix (`gh pr view 22
--json files`, não deduzido do título): ele toca os **3** pontos que escrevem a régua —
`uploads-complete/route.ts:81`, `onboarding/import.ts:424`, `rescue-stuck-uploads.ts:116` —
mais `finalize-training.ts`, e centraliza em `lib/voices/regua-audio.ts` com teste. É o fix
certo e a cobertura é completa. **Mas é para a frente:** não regrava as 18 linhas carimbadas em
18/08. Depois do merge, os 2 pagantes continuam em `rejected_too_short` com a mensagem errada.

*Ressalva honesta contra o meu próprio alívio:* cobertura dos 3 pontos **não é** fix verificado.
Li os arquivos tocados, não rodei o teste nem exercitei o caminho.

## 6. Os 6 incidentes — por que nenhum fechou

Pergunta 1 da rotina (*"já resolveu sozinho?"*) conferida **ao vivo** em todos. Resposta: NÃO
em todos.

| id | o que mudou nesta ronda | por que não fechei |
|---|---|---|
| `2c5bab42` | **mecanismo achado** (sweep, lote de 18/08); 3 hipóteses refutadas | PR #22 sem merge = não está em produção |
| `b9c5a0d1` | **prova por aluno** (3 e 8 arquivos perdidos); o merge não os resolve | seguem sem voz e sem contato |
| `07745f61` | cobertura do #22 conferida nos 3 pontos | mesmo motivo: PR sem merge |
| `5c3f1f8b` | numeração contígua nos 3 → classe do `2c5bab42` não os alcança | ninguém respondeu; sem estorno pendente |
| `ce6e157d` | **relógio: 29,3h**; última geração há 33,6h, anterior à cura | veredito custa 1 geração = GPU = Johnny |
| `100e7ace` | 5ª ronda sem material; premissa segue refutada | é do Claude; PR #16 ataca a classe |

**Regra 14 respeitada: nada marcado `fixed` sem estar resolvido.**

## 7. Saúde da produção

Últimas 6h: **9 gerações, 9 `ready`. 2 vozes, 2 `ready`. 17 imagens, 17 `ready`. Zero falhas.**
**0 registros presos** em estado intermediário agora (`uploading`/`validating`/`training`,
`pending`/`processing`).

## 8. Zumbis, integridade e a caixa

- **1 zumbi, o mesmo de sempre:** `acf8acd6`, `fixed`, `last_seen` há **78,3h** e **esfriando**.
  Medido **sem janela de tempo** sobre os 66 fechados: é o único com `last_seen > resolved_at`.
  `fechados_sem_resolved_at = 0`.
- **`d3d8d1b2` (timeout) NÃO voltou** — não aparece na lista de fechados que dispararam. Segue
  `ignored` por decisão do Johnny. Se voltar, o combinado é instrumentar o handler para logar
  **em qual fase** o chunk pendura.
- **`agent_notes`: 72 incidentes, 72 arrays, 0 strings corrompidas.** As 6 anotações desta ronda
  foram feitas com `anotar_incidente.cjs` (ensaio → `--confirmar`), e conferi **"1 linha
  afetada"** na releitura de cada uma. Nenhum script solto.
- **Caixa:** `--fila` = **0 não-lidos**. Nada novo desde a ronda das 06h; o último e-mail de
  aluno continua sendo o do Victor (20/08 20:55), já respondido. Não toquei em não-lido.

## 9. Armadilhas — a de 06h me pegou, e uma nova

- ⚠️ **A armadilha da coluna inexistente me pegou nesta ronda, exatamente como previsto às 06h.**
  Pedi `profiles.credits_balance` (não existe; são `credits_subscription` + `credits_extra`) e o
  Supabase derrubou a **query inteira**, devolvendo 0 linhas. Só não virou "a Katia não existe"
  porque o `ERRO_CRU` estava impresso e o script aborta no erro em vez de seguir com vazio.
  **Imprimir o `error` cru não é zelo, é o que separa medição de ficção.**
- 🆕 **`raw_audio_paths` tem DUAS provenances** e elas não são intercambiáveis: no caminho normal
  é o que o **browser** reportou; nas linhas tocadas pelo sweep é uma **listagem do R2**. Para a
  impressão digital dá no mesmo (ambas refletem ausência real), mas **qualquer medição que trate
  o campo como "o que o aluno selecionou" está errada nas 18 linhas do lote de 18/08** — ali o
  original foi sobrescrito e **não existe mais**.
- 🆕 **Sweep que corrige dado e não avisa ninguém produz vítima silenciosa.** O `rescue` mudou 18
  vozes de estado em 10 minutos sem uma linha de e-mail. A objeção do Vigia (a impressão digital
  é cega à perda na cauda) **continua de pé** e não foi respondida nesta ronda.

## 10. O que está travado no Johnny (para o relatório da noite)

1. 🔴 **Texto do e-mail dos 2 pagantes — agora com conteúdo CORRIGIDO e com prazo.** O
   `jrfengenhariadf` perde acesso em **25/08 (~101h)**. O texto pendente manda "regrave"; o
   certo é **"perdemos N dos seus M arquivos, reenvie"** — 3 de 7 no jrf, **8 de 14** no leandro.
2. **Merge do PR #22** — e o registro de que **ele sozinho não fecha o `b9c5a0d1`**: as 18
   linhas carimbadas em 18/08 continuam erradas depois do merge.
3. **1 geração de GPU** para o veredito do piloto da Katia, antes de **22/08 12:00 UTC (29,3h)**.
4. *(sem pedido)* Backfill do `ja_pagou` segue inexistente. `feat/incidents-resolved-at` segue
   sem PR. Migrations: main na **84**; 85 e 86 **não aplicadas**.

**Nesta ronda: nenhum e-mail enviado, nenhuma GPU gasta, nenhum crédito mexido, nenhum acesso
alterado, nenhuma migration, nenhum status de voz tocado.**

## 11. Por que NÃO mandei mensagem agora

O gatilho do "na hora" (pagante travado sem solução) **já foi honrado na ronda das 05h** e o
Johnny já sabe dos 2 pagantes. O que descobri hoje não muda **o que** ele precisa decidir, muda
**o conteúdo do texto** que ele vai aprovar — e o prazo mais curto é de ~101h. Ping a cada ronda
mata o sinal que a regra existe para proteger. Vai como **item de abertura do relatório da noite**.

## 12. Passo fixo de fim de ronda — e o que ele pegou

- ✅ `git fetch` + **`origin/main..HEAD` vazio**. Este log foi direto na **main** (`abdb41f`).
- ✅ Estou na `main`, não em branch de feature.
- ✅ Cruzei **todos** os branches locais com os PRs abertos, um por um.

### 🟡 Sete branches sem PR — e uma correção ao meu próprio susto

Primeiro escrevi que havia código "não publicado". **Está errado e corrijo antes de reportar:**
`git ls-remote` devolveu SHA para os três que importam — eles **estão no `origin`**. Não há
risco de perda. O problema não é sumiço, é **invisibilidade**: sem PR, ninguém revisa e ninguém
mergeia. É a mesma classe do fix que ficou 9h preso em 19/08, só que por outro caminho.

| branch | commits | no origin? | o que é |
|---|---|---|---|
| `fix/fast-email-dedupe-por-queixa` | 1 | **sim** | 🔴 fix de aluno — **PR #23 aberto nesta ronda** |
| `feat/incidents-resolved-at` | 2 | sim | `fechar_incidente.cjs` + trava do `resolved_at` + `86_*.sql` |
| `feat/vigia-noturno` | 1 | sim | espinha do vigia noturno (6 arquivos, `64_night_watch.sql`) |
| `feat/incidents-resolved-guard` | 1 | sim | gêmeo superado do `-resolved-at`, numerado **85** (colide com o PR #18) |
| `chore/gitattributes` | 1 | **não** | só `.gitattributes`; local, trivial |
| `prova/2026-08-20-pagante-trancado` | 1 | sim | conferido às 06h: arquivos já existem na main |
| `rescue/relatorio-noturno-7e02e90` | 1 | sim | idem |

### 🔴 O que estava invisível e era de aluno: PR #23

`fix/fast-email-dedupe-por-queixa`, meu, empurrado em **20/08 16:00** e **sem PR desde então**.
A assinatura do incidente era `fast-email:{tec|atend}:{email}`, então **queixa nova do mesmo
aluno virava "ocorrência 2" de um card fechado sobre outro defeito e sumia**. É exatamente o que
aconteceu com a Katia em 20/08: a queixa de **pacing** entrou no `ce6e157d`, que é de **eco** e
já estava corrigido — ela perguntou 3× em 3 dias e a última pergunta ficou horas sem resposta.

O commit traz teste de aceite com os textos **reais** de produção (11/11 em `node --test`) e
prova ao vivo read-only. **Abri o PR #23 e NÃO mergeei** — abrir PR é reversível e não deploya;
o que não podia continuar era o fix existir e ninguém poder vê-lo. Declarei no corpo do PR que
**não rodei typecheck/lint nesta ronda** — a prova é a do commit de 20/08.

**Por que isto importa para a fila de hoje:** o defeito que o PR #23 corrige é o mecanismo que
faz uma queixa nova se esconder dentro de um card fechado. É irmão do que achei na seção 1
(sweep que muda estado sem avisar) e do zumbi `acf8acd6` (card fechado que escondeu 14
ocorrências de bug nosso). **Três formas diferentes do mesmo defeito de operação: a coisa muda
de estado e ninguém do outro lado fica sabendo.**

### Sugestão que não executei

`feat/incidents-resolved-guard` é o gêmeo **superado** do `-resolved-at` e numera a migration
como **85**, número que o PR #18 já usa. Só serve para alguém aplicar o 85 errado. **Sugiro
apagar** — não apaguei porque apagar branch não é reversível como abrir PR. Fica para o Johnny.

**Estado das migrations:** main na **84**. A 85 (PR #18) e a 86 (`feat/incidents-resolved-at`,
agora sem PR) seguem **não aplicadas**. DDL commitado não é DDL aplicado.
