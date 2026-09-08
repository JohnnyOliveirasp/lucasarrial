# Ronda das falhas — 08/09/2026, 00h35–01h00Z (07/09, 21h35 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: ordem de 31/08 — aviso no **GRUPO**,
nada no privado. Turno 21h35 BRT, **dentro** da janela 08h–23h.

---

## 0. A ronda em uma linha

Peguei o **#237** e o desfecho não foi investigação nova: era **dívida minha**.
O conserto do defeito de sistema que esse chamado expôs estava **pronto e parado
há 5 dias esperando eu aplicar** — subi pra produção, com deploy verde.
O aluno do #237 segue não identificável, e eu digo isso em vez de fechar.

Fila: **34 → 34** (não fechei nenhum, e explico por quê no item 5).
Custo: **zero** (sem GPU, sem whisper, sem crédito).

## 1. Serial: por que o #237

Varredura na fonte: **34 abertos**, 12 aguardando aluno, 4 "presos",
**0 fechado voltou a disparar**.

Ordenei por `created_at` (a varredura ordena por `last_seen_at`, que é outra
coisa) e desci a lista pelo critério da ordem — o mais antigo com aluno afetado:

| # | idade | por que não é o desta ronda |
|---|---|---|
| **#15** | 40d | preso em **decisão do Johnny** (`migration 82`). Ganhou fix hoje (`b55db26`), o passo que emperra não é meu. |
| **#222** | 7d | preso em **decisão do Johnny** desde 06/09: a nota 33 mediu que o título está refutado e pediu **reenquadrar ou fechar**. O aval não veio. Não é investigação. |
| **#226** | 7d | preso em **decisão do Johnny** (cobrar ou estornar as reprovadas do QA). |
| **#234** | 6d | caça à causa, já enterrou 6 hipóteses; re-medido às 18h/19h/22h de ontem. |
| **#237** | 6d | **aluno escreveu e levou 6 dias de silêncio.** Pego este. |

O #237 tem uma pessoa que disse *"enviei fotos e áudios e não aparece nada"* e
não recebeu **nada** em 6 dias. É o modo de falha que a ordem nomeia com todas
as letras (*"foi o silêncio que fez a Viviana explodir"*), e os quatro da frente
estão travados em decisão de terceiro, não em trabalho meu.

Ele estava invisível por um motivo concreto: `affected_emails` está **vazio**,
então quem varre a fila pela lista de e-mails não enxerga ninguém sofrendo.

## 2. Não re-diagnostiquei — e isso foi de propósito

A nota de **02/09 21:47Z** já provou que este chamado é **irrespondível**, e eu
não gastei a ronda redescobrindo isso. O que está provado lá e eu **herdei sem
re-medir**: o uuid da `signature` é `randomUUID()` sorteado no insert
(`admin/incidents/route.ts`), não identifica ninguém **por construção**, e não
existe em `profiles`, `auth.users`, `help_messages`, `agent_chats`, `voices`,
`generations`, `onboarding_runs` nem `sgp_pedidos` — 8 tabelas conferidas.

`reported_by = suporte@lucasarrial.com` é o e-mail do **admin logado**, não o do
aluno.

## 3. O achado da ronda: o conserto estava pronto e parado COMIGO

O `patch_92b1cc85_v2` estava gravado no `agent_state` desde **05/09 12:13Z**
com o estado `"Quem aplica e revisa é o Frank"`. Ninguém aplicou. Pior: o Vigia
teve que **rebasear o patch duas vezes** (03/09 → 05/09) porque a main andou por
baixo dele enquanto esperava por mim, e ele registrou a lição no próprio card
(*"patch parado tem prazo de validade"*).

**É o modo de falha de 19/08** — fix de aluno que ficou 9h preso em branch e
invisível — só que em vez de branch o esconderijo era o `agent_state`. O
registro `patches_parados` marcava **48h parado** em 07/09 12hZ; quando peguei,
eram **~60h**.

Isso não é crítica ao Vigia. É dívida minha, e registro como minha.

## 4. Em produção, com prova

Conferi **antes** que o defeito ainda estava vivo na main (`02c61b5`):
`route.ts:77` com `reported:${randomUUID()}` e `falhas/page.tsx:499` com o
placeholder `"(opcional)"`. Estava. O patch não era redundante.

- `git apply --check` em **worktree limpa** de `origin/main` (regra da casa de
  06/09: só vale resultado que saiu da boca do `git apply`) → **aplica limpo**.
- `git am` preservando a autoria do vigia → `ecf4ded`.
- **PR #210**, merge **`d2dc5fa`** na main.
- **Deploy Frontend (production)**, run `34174442302`: **completed SUCCESS**,
  00:52Z. Esperei o deploy fechar antes de escrever "em produção" — *build
  verde e deploy feito não significam funciona*, mas **deploy não-verificado não
  significa nem deployado*.
- Reconferido na main **depois** do merge: `route.ts:80` com
  `reported:manual:`, `route.ts:97` com `has_email`, `page.tsx:501` com o
  placeholder novo. Os três estão lá.

### O que o conserto faz

A `signature` do reporte manual deixa de ter cara de user id; o audit log passa
a registrar `has_email` (dá pra **medir** quantos chamados nascem cegos em vez
de só reclamar); o placeholder diz o custo de deixar o e-mail em branco; e a
fila marca `"sem e-mail do aluno"` na linha, pra quem pega **ver antes de
investigar**. O e-mail **segue opcional** de propósito — obrigatório impediria o
suporte de registrar chamado legítimo sem e-mail.

Isso impede o **próximo** chamado de nascer cego. **Não identifica o aluno
deste**, e nunca vai.

### A verificação de segurança que eu fiz por conta própria

O patch trocava o prefixo da `signature`, que alimenta **deduplicação**. Não
aceitei a afirmação `"ninguém faz parse do campo"` de graça: dedup quebrada em
silêncio seria pior que o bug original. Conferido um a um —
`reportar.ts:54`, `gravar.ts:57`, `ingest.ts:87` e `failure-alert.ts:235` todos
fazem `.eq()` com valor que **eles mesmos constroem**; o único `.like()` é
`espera.ts:49`, com padrão `wa-%:<fone>:%`, que não alcança `reported:`. E a
unicidade (índice UNIQUE PARCIAL citado em `gravar.ts:12`) não depende do
prefixo, porque o uuid já é sorteado por insert. **Confirmado: não quebra dedup
nem ingest.**

Build: `tsc --noEmit` = **1 erro no repo inteiro, pré-existente e alheio**
(`resgate-audio.test.ts`, módulo `vitest` — conferi que o pacote realmente **não
existe** em `node_modules`, em vez de aceitar "é pré-existente" de palavra);
**0 erros nos 2 arquivos tocados**. `eslint` nos 2: exit 0. `next build`:
**verde**.

## 5. Por que NÃO fechei o #237

A parte que era minha acabou e está em produção. O chamado continua
**bloqueado na identificação**, e o passo que emperra é o mesmo de 02/09: **só a
pessoa que digitou o formulário às 20:38Z de 02/09 sabe de quem é o relato.**

Foi perguntado no grupo em 02/09 e **ninguém respondeu em 5 dias**. Perguntei
**de novo** nesta ronda — segunda tentativa, a mesma regra que aplico a aluno
que não responde: silêncio não é desfecho.

Fechar sem identificar seria **dar por atendido um aluno que nunca foi
atendido**. Não faço isso. Deixei `investigating` **com nota** do que já foi
descartado (`investigating` sem nota é o mesmo que não ter olhado).

**Marco o prazo, pra isto não virar card imortal:** se em mais 2 rondas ninguém
disser quem é o aluno, a decisão honesta passa a ser fechar como **irrespondível
por defeito de origem já corrigido** — e aí o fechamento é sobre o formulário,
não sobre o aluno.

## 6. O que eu NÃO fiz

Não identifiquei o aluno, não escrevi pra aluno nenhum, não gastei GPU nem
whisper, não mexi em crédito/acesso/plano, não estornei, não apliquei migration,
não abri incidente novo, não reabri nada, não fechei nada e não toquei em nada
da planilha.

Escritas da ronda: **1 nota** (#237, 6 → 7, 1 linha afetada, conferida na
releitura), **1 PR mergeado** (#210 → `d2dc5fa`), **1 update no `agent_state`**
(`patches_parados`, relido e conferido), **1 aviso no grupo** e **1 arquivo no
git** (este log).

## 7. Fila

**34 na entrada, 34 na saída.** Não fechei nenhum, e não vou maquiar isso: a
ordem de 21/08 é pra fechar **mais**, não pra fechar mais rápido do que resolve.
O passo que emperrou está nomeado no item 5. 12 aguardando aluno, **6 deles com
7d+** (`#47`, `#99`, `#172`, `#206`, `#207`, `#214`) pedindo **segunda
tentativa** — quarta ronda seguida que isso aparece sem ninguém agir.
**0 fechado voltou a disparar.**

## 8. A outra dívida de patch, nomeada pra não sumir

**`patch_ce6e157d`** — `manual.ts:148` promete estorno *"AUTOMATICAMENTE"* em
toda falha técnica; alimenta o **#260**. Parado desde **04/09 12:16Z**, ~**84h**,
e aplicava limpo na última conferência. Não peguei porque a ordem manda serial e
o meu item era o #237. **É dívida minha igual à do #237** e deve ser o candidato
forte da próxima ronda.

## 9. Para quem pegar a próxima ronda

- **Não cace o uuid da `signature` do #237.** É `randomUUID()`, não existe em
  tabela nenhuma (provado 02/09, 8 tabelas). Já queimou duas rondas.
- **Não re-meça se o `patch_92b1cc85_v2` aplica** — está na main desde
  `d2dc5fa`. O `patches_parados` já foi atualizado pra `MERGEADO`.
- **Patch parado no `agent_state` é fix invisível**, com o mesmo efeito do fix
  preso em branch de 19/08. O `patches_parados` é a lista de dívida — abrir ele
  no começo da ronda custa 10 segundos.
- **O que falta no #237 não é medição, é resposta humana** de quem registrou.
- A varredura ordena por `last_seen_at`; **serial pede `created_at`.** São
  ordens diferentes e a lista engana.
- **`affected_emails` vazio esconde aluno sofrendo** da varredura. O #237 ficou
  6 dias invisível por isso — e o conserto de hoje só marca a linha dali pra
  frente.

## 10. Precisa de DECISÃO do Johnny (inalterado desde 23hZ, nada meu novo)

1. 🔴 **O "pode" dos 8 do #290** — pendente desde 04/09, ~800k créditos parados.
2. 🔴 **`migration 82`** — destrava o #15 (40 dias).
3. 🔴 **#303** — `"ativo até"` vira prazo falso (aberto pelo Vigia às 00hZ).
   Custou 27k créditos de uma aluna ontem. É código: pede card e PR.
4. 🟠 **#296** — Gerador de Imagem sem trava de identidade entre gerações.
5. 🟠 **#222** — pede **reenquadrar ou fechar** desde 06/09; sem o aval, vira
   card imortal.
6. 🟠 **Simone (#301)** — R$ 975,40 pagos em 31/08, nunca usou nada, promessa
   por escrito das 16:45Z passou de 8h.
7. 🟠 **Lucila (#299/#300)** — R$ 291, 200k créditos intactos, 0 voz em 46 dias.
8. 🟡 **#254 / Diego** — relógio em **08/09 12:00Z (hoje)**.
9. 🟡 **#265**, **#226/#234**, **marcelopersonalthe32** (reembolso vence 11/09).
