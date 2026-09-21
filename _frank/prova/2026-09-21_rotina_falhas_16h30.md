# Ronda serial 21/09 ~16h30Z — FastCloner

Serial (regra 8). Passos fixos + os itens nomeados pela ronda das 15h/16h.
Cartão do Mission Board: `df35a47e`.

**Resumo em uma linha:** dois dos quatro itens nomeados já estavam feitos pela
ronda das 16h e eu **confirmei em vez de refazer**; o PR #382 foi revisado,
mutado e mergeado; o despacho de percepção **não tinha sujeito**; e o Carlos
continua sem resposta com a cobrança dupla **amanhã**.

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, e nada escapou

`2026-09-18_reconciliar_envios_da_pasta.cjs` em ENSAIO:

| | |
|---|---|
| lidas da pasta "Sent" | 932 |
| registro local (#210) | 0 (gitignored, some com o worktree) |
| já tinham linha | 855 |
| recusadas / fora da janela | 0 / 0 |
| **escrituráveis** | **77** |

A contagem fecha (932 = 932, nenhuma carta sumiu na classificação). E o que
importa: **as 77 são TODAS anteriores a 2026-09-14 14:06:31Z**, quando a tabela
nasceu. Não há nenhuma carta pós-tabela sem linha.

**Conclusão: não é defeito novo, é a pré-história.** Não escriturei — escriturar
77 cartas velhas é decisão de quem confirma, não consequência desta ronda, e
nenhuma delas muda o que a casa sabe hoje. Fica anotado que o corte para
deixá-las de fora existe: `--corte=2026-09-14T14:06:31Z`.

### 1.2 Fila

`varredura_travados.cjs`: **2 presos · 95 abertos · 37 aguardando aluno · 1
fechado sem retorno humano**.

- `training_jobs`: 1 linha obsoleta (job `ebf5cc56` nunca saiu de queued/running
  mas a voz `f4b9b0f2` já está **ready**) — escrituração pendente, **ninguém
  esperando**.
- 🚨 **Acesso vivo, com crédito e sem nenhuma voz pronta: 2**
  - `hellengrasso@` · 95.375 cr · **15 dias** sem voz · voz `9bb9fccf`
    `rejected_too_short` ("recebemos apenas 2 dos 7 arquivos que você enviou").
    **Este é o mais velho e tem aluno sofrendo — é o candidato natural da
    próxima ronda serial.**
  - `marketinglsousa@` · 90.000 cr · **0 dias** (hoje) · uma voz em `training`,
    outra `failed` já com devolução na mensagem. Novo, ainda dentro do prazo.
- `#407` fechou 188.333s depois do disparo, 2×, última há 148h
  (`lucianodepinho@`) — entrega ao time **sem retorno humano**. Trate como aluno
  esperando.
- Lista de estorno em dia: 16 devolução + 13 não-devolução, 3.541 linhas
  varridas, nenhum tipo por classificar.

### 1.3 Percepção — o passo não tinha sujeito, e isso é o achado

Ver seção 3.

---

## 2. Itens nomeados: o que eu confirmei em vez de refazer

A ronda das 16hZ fechou **13 minutos** antes desta. Dois dos quatro itens que me
chegaram nomeados já tinham sido executados por ela. Refazer teria sido pior que
não fazer — carta repetida sobre dinheiro é dano, não zelo.

### 2.1 Herineth (item #2, regra das 24h) — JÁ FEITO às 15:45:58Z

Conferido em **duas pernas independentes**, não na palavra do relatório:

- `_frank/prova/envios_ledger.jsonl` linha 178 — `para: herysilva27@gmail.com`,
  chave `dobro-254-herineth-44usd`, assunto *"Herineth: cobramos-lhe 44 USD a
  mais por engano - a duplicada ja esta cancelada"*, `at`
  **2026-09-21T15:45:58.798Z**, message-id `<frank-1790005557297-…>`.
- `uid_por_message_id.cjs` nesse message-id na pasta Sent → **uid 3096**, 1
  carta. A carta existe na caixa, não só no log.

**Nada a fazer. Não reenviei.** A regra das 24h está cumprida por ela.

### 2.2 PR #381 — JÁ MERGEADO às 15:49:35Z

`gh pr view 381` → `MERGED`, `mergedAt 2026-09-21T15:49:35Z`. Confirmado, não
retrabalhado.

---

## 3. Percepção: o despacho não tinha sujeito, e eu conferi antes de dizer isso

O passo pedia **despachar os cards de percepção para o `olho`**. A triagem dos
31 (cartão `2776351f`, `generalist`, hoje 11:52) classificou:

| categoria | n | o que é |
|---|---|---|
| FALSO_POS | 9 | keyword bateu por acaso, ou pela frase genérica da Carol |
| OUTRO_BLOQUEIO | 11 | travado em decisão de dinheiro do Johnny ou em resposta do aluno |
| JA_FEITO | 11 | perícia já despachada e **o veredito já está escrito na nota** |
| **TRAVADO (falta alguém ver/ouvir)** | **0** | — |

**Não endossei isso de graça: 29 dos 31 vieram do parecer do `generalist`.** A
ronda das 16h conferiu 2 por conta própria. **Eu conferi outros 5**, lendo a
nota mais recente direto do `agent_notes` de cada cartão:

| cartão | o que a última nota diz | bate? |
|---|---|---|
| `86de22c6` | "COMPROVANTES RECEBIDOS, ABERTOS E CONFERIDOS POR MIM" (2 JPEGs lidos) | ✅ |
| `ae6b4bd1` | "Baixei do R2 e mandei pro agente que enxerga. VEREDITO…" | ✅ |
| `4ce9f365` | laudo existe e está sendo auditado (remissão ao #500) | ✅ |
| `59fa1ed7` | aluna respondida, bola com ela; "⛔ NÃO ESTORNE NADA" | ✅ |
| `85ca1863` | veredito do `olho` recebido; falta decisão de 41.600 cr | ✅ |

**7 de 31 verificados por humano/instrumento próprio, zero divergências.** A
conclusão "não há o que despachar" se sustenta.

⚠️ **Portanto eu NÃO abri cartão para o `olho` nesta ronda.** Havia um passo
nomeado mandando despachar, e a medição diz que não há sujeito. Inventar trabalho
de percepção para cumprir o roteiro produziria laudo sobre caso que já tem laudo
— e o `olho` **numera mal** (regra já registrada): laudo dele entra como
hipótese, e hipótese a mais sobre caso já decidido é ruído que custa.

**O defeito de fundo continua de pé** (a ronda das 16h já o nomeou): o detector
da ordem de 17/09 casa com notas que **registram perícia JÁ FEITA** — quanto
mais a casa despacha, mais o contador sobe. Hoje é **~100% falso positivo**.
Uma conferência que sempre grita é uma conferência que ninguém lê.

---

## 4. PR #382 revisado, mutado e mergeado — e a produção deu um voto a favor dele

Regra 14-B: código sem DDL (2 arquivos, `classify.ts` + `classify.test.ts`,
**zero `.sql`**), quem pega revisa e mergeia.

**Verificações minhas, do zero, em worktree isolado** (`/tmp/wt-382` sobre
`origin/feat/510-assinatura-constante-infra-storage`) — não herdadas do corpo do
PR:

| verificação | resultado |
|---|---|
| `classify.test.ts` sozinho | **17 pass / 0 fail / 0 SKIP** |
| pasta `incidents` (`*.test.ts`) | 118 testes, **104 pass, 0 fail, 14 skip** |
| `tsc --noEmit` | **exit 0** |
| **mutação reproduzida por mim** | bloco removido → **14 pass / 3 FAIL**; restaurado → 17/17 |

A mutação é o que dá valor ao verde: **3 testes caem sem o fix**, e os 14 de
guarda que continuam passando mostram que a suíte não quebrou por acidente.
Restaurei o arquivo e conferi `git diff` limpo.

**Leitura do código.** A guarda é `cause === "infra_storage"` — pela **causa já
decidida**, não pelo texto cru. Por isso a precedência do `classifyCause` fica
intacta: erro de dataset que por acaso cite o bucket continua nascendo
`user_dataset` e **nunca** vira a chave inconsistente `training:user_dataset:r2`.
Há teste dedicado a isso, e ele é **um dos 3 que a mutação derruba**.

### 4.1 A prova viva que o PR não tinha

Varri os `incidents` com assinatura de storage e achei um **TERCEIRO cartão**:

| cartão | assinatura | nascido |
|---|---|---|
| `4d80c74d` [fixed] | `training:infra_storage:failed to download <url>` | 12:54Z (#508) |
| `3b7413e0` [fixed] | `…failed to download <url> httpsconnectionpool(…)` | 12:58Z (#507) |
| **`e9b1fa98`** **[open]** | `training:infra_storage:r# upload request error: httpsconnectionpool(…)` | **15:45:36Z — hoje** |

O `e9b1fa98` nasceu **~13 min antes desta ronda** e é **UPLOAD**; os outros dois
eram **DOWNLOAD**. Em menos de 3h a mesma causa produziu uma **quarta variante
de texto**.

Isso confirma **na produção** a decisão de projeto mais discutível do PR — usar
**UMA chave só**, sem separar download de upload. O PR argumentou que a direção
do fenômeno só existe no TEXTO, e o texto é exatamente o que a truncagem de 500
destrói. O `e9b1fa98` é a demonstração: separar por marcador de texto recriaria
o racha que a chave mata.

### 4.2 O que o merge **não** resolve

1. **O fix vale para ocorrência NOVA.** Os cartões existentes guardam a
   assinatura velha: `e9b1fa98` segue **[open]** com a chave antiga, e a próxima
   falha de R2 abrirá **um cartão novo** em `training:infra_storage:r2` em vez de
   somar nele. **Não há retro-merge** — juntar os 4 é trabalho à parte e **não
   foi feito**.
2. A **segunda perna** do título do `#510` (assinatura degenerada de 47 chars
   morando em `aguardando_aluno`; o `ingest` casa por assinatura **sem filtro de
   status** e preserva o status existente) **não foi tocada** por este PR.

Merge **`65fbee86`** na `origin/main`, conferido por
`git show origin/main:…/classify.ts` (bloco na **linha 406**). Nota gravada no
cartão `#510` (`c9a8ed9a`, 1 → 2 notas, 1 linha afetada, conferida na releitura),
com `resolved_commit`. **Status mantido `investigating`** pelos dois motivos
acima — regra 14: não marco `fixed` o que não resolvi.

---

## 5. 🔴 Carlos — o relógio vence AMANHÃ e a bola não é minha

Item nomeado **#1**. Remedido vivo nesta ronda com `assinatura_em_dobro.cjs`:

```
Carlos Augusto Ferreira Moreira — PAGANDO EM DOBRO (291 no total)
  MY5O3KWB <caplastica@hotmail.com>     dono=ÓRFÃO    até 2026-09-22
     BRL 97 COMPLETE HP1582409804 13/08 ; BRL 97 COMPLETE HP4126118814 28/08
  UMJP7PDY <gutoassuncao16@gmail.com>   dono=38bf5777 até 2026-09-22
     BRL 97 COMPLETE HP4258087686 28/08
```

**As duas `active` até 2026-09-22 — amanhã.** Renovam em **R$194 no lugar de
R$97**, pela segunda vez.

**Ele não respondeu, e isto é conclusivo, não limite de ferramenta:**
`ler_caixa --de` nos **dois** endereços → nada; `--fila` (não-lidos no INBOX) →
**0**. Com a fila vazia, não existe resposta por ler. **Sete cartas, zero
resposta** (a 6ª e a 7ª carregando a data explícita).

**Não cancelei, e o motivo é regra, não hesitação.** A 9-C autoriza cancelar **a
pedido do titular**; o Carlos não pediu. Sem o pedido, cancelar é *tirar dele* —
e a 9-B manda parar e chamar. Mesmo critério já aplicado ao Diego neste cartão.

**O preço está escrito e eu não o disfarço:** sem o "pode" do Johnny hoje, a casa
cobra **R$194 errado amanhã**, e a perna do Carlos vira **caso de devolução** —
que é justamente a trava que já tem **17 dias** neste cartão (devolver dinheiro
de cartão **não está na 9-B em valor nenhum**).

**Escalado ao Johnny nesta ronda, como urgente.** É a única coisa desta ronda
com prazo que vence sozinho.

---

## 6. O que eu NÃO afirmo

- **Não afirmo que o Carlos vai responder.** Sete cartas, zero resposta, fila
  vazia. A probabilidade de resposta espontânea nas próximas horas é baixa e eu
  não a estou usando como plano.
- **Não afirmo que a triagem dos 31 está isenta.** Conferi 5; a ronda das 16h
  conferiu 2. **Sobram 24 na palavra do `generalist`** — bateu em 7 de 7, o que
  é bom sinal, não prova.
- **Não afirmo que o `e9b1fa98` é a última variante de texto do R2.** Apareceu
  uma em 3h; podem aparecer outras até o deploy pegar.
- **Não afirmo que os outros 3 do `#254` têm o defeito de medição** da Herineth
  e da Nassara. Dois de dois remedidos estavam **pela metade**, e os outros
  seguem com o valor antigo. **Continua nomeado.**
- **Não afirmo nada sobre os 14 testes pulados** além do que li: pulam por falta
  de flag de mock, em arquivos que não tocam o `classify`.

---

## 7. O que eu NÃO fiz

Não cancelei assinatura nenhuma. Não estornei. Não mexi em crédito, carteira,
acesso, entitlement nem plano. **Não mandei carta para aluno nenhum nesta
ronda.** Não liguei nem mandei WhatsApp. Não gastei GPU, não apliquei migration.
Não escriturei as 77 cartas pré-tabela. Não abri cartão para o `olho` (seção 3).
Hotmart só por GET. Nada da planilha (ordem de 29/08).

---

## 8. O que fica nomeado para a próxima ronda

1. 🔴 **Carlos** — se o "pode" chegou, cancelar a órfã na hora pelo 9-C. Se a
   cobrança dupla saiu, a perna dele vira devolução.
2. **`hellengrasso@`** — 15 dias com crédito e sem voz, voz barrada em
   `rejected_too_short` ("2 dos 7 arquivos"). **É o mais velho com aluno
   sofrendo: é o próximo da serial.**
3. **Juntar os 4 cartões de R2** (`e9b1fa98` aberto + 3 fechados) ou decidir
   explicitamente que não se juntam — o fix só vale daqui pra frente (§4.2).
4. **Segunda perna do `#510`**: `ingest` casa por assinatura sem filtro de status
   e preserva o status existente (o ímã em `aguardando_aluno`).
5. **Consertar o detector de percepção** da ordem de 17/09 — hoje ~100% falso
   positivo (§3). Proposta da ronda das 16h: excluir nota que já contenha
   veredito (`%laudo%`, `%veredito%`, `%despachado%`) e a frase genérica da Carol.
6. **Varrer o ponto cego da Nassara**: quem tem 2+ assinaturas e foi creditado só
   numa. O filtro de hoje (zero linha no ledger) não pega.
7. **Re-medir as outras 3 pernas do `#254` por ASSINATURA**, não por e-mail.
8. **`#407`** — entrega ao time sem retorno humano há 148h.
9. **`#226`**, **`#343`/`#324`** — falta a escolha do Johnny / sem revisão.
10. **`feat/resumo-diario-grupo-suporte`** — decisão do Lucas de 04/09 que nunca
    subiu, + 9 arquivos de prova presos no branch.

---

## 9. Passo fixo de fim de ronda

Registro vai **direto na `main`**, por **worktree isolado**
(`git worktree add --detach /tmp/wt-log-ronda origin/main`) — nunca na árvore
compartilhada, onde um worker pode trocar de branch por baixo do commit.

O código desta ronda saiu por **PR mergeado** (#382), não por commit direto:
nenhum branch meu foi criado, então nenhum fix meu pode ter ficado preso.

**PRs abertos: 50** (eram 51; revisei e mergeei **1**). Não inflo o número — os
outros 50 seguem sem revisão, e isso é backlog real.

**Duas armadilhas de instrumento que eu mesmo pisei nesta ronda**, registradas
porque vão enganar a próxima:

1. **`node --test <diretório>` não faz glob.** Ele tenta resolver o diretório
   como módulo, sai com `Cannot find module` e imprime
   `# tests 1 / # pass 0 / # fail 1`. Isso **tem a cara de regressão do código
   que você acabou de revisar** e quase me fez recusar o `#382` por defeito do
   meu próprio comando. O certo é `node --test "<dir>/*.test.ts"`.
2. **A coluna é `signature`, não `error_signature`.** Pedi a coluna errada e o
   Supabase devolveu erro — armadilha 1 do manual, e só não virou "0 incidentes
   de storage" porque conferi o `error` antes de acreditar no vazio.
