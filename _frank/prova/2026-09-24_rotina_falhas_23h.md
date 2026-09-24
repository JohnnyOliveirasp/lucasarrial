# Ronda das falhas — 24/09, ~22:40–23:00Z

**Item serial (regra 8):** uma **classe nova**, achada abrindo a fila de
consertos: o **REMÉDIO OBSOLETO** — o conserto pronto cujo defeito já morreu
por outro caminho, e que por isso aparece na coluna *"entram hoje"* da medição
da casa. Levei dois casos **até o fim**: medidos no banco vivo, PRs fechados,
cartões anotados, instrumento escrito pra classe não voltar invisível.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1256 lidas · 1179 já tinham linha · **0 escrituráveis**. Contagem fecha 1256 = 1256. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Veredito: buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho 0d. Controles positivo (#310) e negativo (#518) OK, 548 varridos. |
| `esperando_johnny.cjs` | **20 cartões** parados em decisão do Johnny · 60 alunos distintos · mais velho **23d**. Controle positivo 5/5. |

As 77 cartas anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — inalterado, continua decisão de produção, não de ronda.

**Não re-escalei o lote de decisão.** Ele foi ao grupo em **23/09 20hZ** e a
doutrina de 17/09 é explícita: o desfecho não é re-escalar um caso por ronda.

---

## 2. A cabeça da fila, e por que eu não a trabalhei (3ª ronda seguida, com o motivo repetido de propósito)

Conferi um a um antes de escolher, não por hábito:

| Cartão | Idade | Por que não é trabalho meu hoje |
|---|---|---|
| `37bacb68` **#52** | 36d · 22 alunos | travado na **mesma** decisão (a)/(b)/(c) do `702cc916`. 4 remédios técnicos já refutados. |
| `702cc916` #226 | 23d | **a decisão**. 23 alunos atrás de uma pergunta só. |
| `719c9af6`, `8b8fc4c8`, `7ed72ad0` | 23d | decisão de produto/dinheiro/mão no painel Hotmart — não é minha. |
| `f8587cef` #234 | 22d · 609 ocorr. | passo (b) executado em 24/09 02hZ; o (c) é **ligar o gate**, decisão parada com o Johnny desde 12/09. |
| `0e04bd97` | nasceu 58d, **aberto hoje** | aberto **e** corrigido na ronda das 16hZ (PR #429). Falta merge, que não é meu — é PR **meu**, não me auto-reviso. |

⚠️ **Um susto que não virou achado, e registro porque quase virou:** a consulta
crua por `first_seen_at` mostra o `0e04bd97` com **58d**, enquanto o
`idade_dos_abertos.cjs` o lista com **0d**. Parecia cegueira do instrumento.
**Não é:** o cartão nasceu hoje com `first_seen_at` retroagido a 28/07 (a data
do fato), e o instrumento conta por `created_at`. Conferi antes de escrever
"instrumento cego" em algum lugar. **Divergência entre dois relógios não é
defeito até alguém dizer qual dos dois é a pergunta.**

---

## 3. O item serial: REMÉDIO OBSOLETO

### 3.1 Como cheguei

A medição de 24/09 13hZ (`conserto_pronto_e_parado.cjs`) separa a fila de PRs
em **"✅ MERGEABLE+CLEAN (entram hoje)"** × **"💀 CONFLITADOS (apodreceram)"**.
Nesta ronda: **46 entram hoje**, 26 parados há 3d+, 21 podres, mais velho 36d.

> ⚠️ **A 1ª rodada do instrumento devolveu 64 PRs `UNKNOWN`** e ele mesmo disse
> *"não acredite em nenhum número desta rodada"* — honestidade que funcionou.
> O GitHub calcula mergeabilidade **sob demanda**: a 1ª chamada dispara o
> cálculo, a 2ª devolve. **Rodar duas vezes não é superstição, é o protocolo.**

Fui abrir os dois primeiros da coluna "entram hoje" pra escolher qual mergear.
**Os dois não deviam entrar** — e por um motivo que não é conflito nem deriva.

### 3.2 Os dois casos, medidos no banco vivo (não herdados)

**`#323` — ponte pro webhook de estorno não quebrar sem a função no banco.**

```
pg_proc  → 1 linha · public.zero_subscription_credits_on_refund(
             p_user_id uuid, p_ref_id text, p_event_type text) · plpgsql
payment_events com processed_at NULL → 0   (na tabela inteira)
```
A `scripts/111` foi aplicada em **22/09 15:13:26Z** com aval do Johnny. A ponte
protege de um defeito que **não existe mais**. O cartão `66c5c55a` (#446) já
tinha escrito, em 22/09: *"o PR #323 virou código morto e deve ser FECHADO sem
merge (ação do Johnny)"*. **Seguia aberto 2 dias depois.**

**`#324` — reabrir o passo de ÁUDIO do SGP pra Janice mandar material novo.**

```
voices 9e94f1f6 · status READY · language 'en' · criada 18/09 08:31:32Z
pedido 09646e28 · status 'pronto' · 3 áudios · atualizado_em 16/09 20:06 (INTOCADO)
```
Consulta **por `user_id`** — a consulta por `voice_id` do pedido é justamente a
que enganou a ronda de 18/09. Ela subiu áudio só em inglês, treinou, o treino
completou. Os 10.000 foram estornados (`ref_type='voice_train_refund'`,
`ref_id=9e94f1f6`) e duas cartas individuais saíram em 18/09 (uids 2825, 2830).
O pedido **nunca foi reaberto, e não precisou ser.**

### 3.3 Por que é uma classe NOVA, e por que ela é pior que a que já conhecemos

O índice de ordens documenta **6 branches STALE** que não podem ser mergeados
(`feat/onedrive-401`, `feat/fix-image-upload-retry`, as 2 da cura de referência,
`fix/trava-foto-nova-8379549c`, `fix/ritmo-da-referencia-porta-73a60bb`,
`fix/estorno-treino-por-saldo-pendente`). Naqueles o defeito é **DERIVA**: a
main andou por cima do arquivo, e o PR se denuncia — fica `CONFLICTING`, some
da coluna dos aprovados.

Aqui **o arquivo não derivou**. O `mergeStateStatus` é **CLEAN**. Quem morreu
foi o **doente**, não o remédio. Consequência:

> **O STALE se anuncia. O obsoleto-por-cura entra na coluna "entram hoje" — e o
> instrumento da casa RECOMENDA mergear.**

### 3.4 O que eu fiz

1. **`#323` fechado sem merge** (22:49:41Z), com a medição de hoje no comentário.
2. **`#324` fechado sem merge** (22:49:59Z), idem.
3. **Os dois branches seguem no `origin`** (`82e1c2ff`, `71ee6c3d`) — conferido
   por `git ls-remote`. **Fechar PR é reversível; apagar branch não é.** Se a
   111 for revertida, reabrir é um clique.
4. **Cartões anotados** com a medição e o encerramento da pendência que eles
   mesmos tinham nomeado: `66c5c55a` (19 notas) e `3b148810` (5 notas), ambos
   conferidos na releitura, **1 linha afetada cada**. Nenhum mudou de status.
5. **Instrumento novo, só leitura:**
   `_frank/ferramentas/2026-09-24_remedio_obsoleto.cjs`.

### 3.5 O instrumento — e o que ele confessa

Sinal: o PR cita `#NNN` e o incidente de `numero = NNN` já está `fixed`/`ignored`.
**13 candidatos entre 47** PRs que a medição conta como "entram hoje".

Três coisas ditas na cara, no próprio arquivo:

- **CANDIDATO NÃO É VEREDITO.** `#NNN` num corpo de PR também é número de PR, de
  issue e de cartão do Mission Board. E há candidato legítimo que **deve**
  entrar: o `#374` é um **teste que trava a regressão** de um incidente fechado
  — guarda de cartão curado é exatamente o que se quer na main. Mesma doutrina
  do `NOTA_NEUTRA` de ontem: **o sinal surface, humano decide.**
- **O `#324` cai em "SEM REFERÊNCIA"** — ele cita o pedido `09646e28`, não um
  `#NNN`. Ou seja: **a ferramenta teria perdido metade dos dois casos que a
  fizeram nascer.** Está escrito no cabeçalho. Ela é um **piso**, não peneira.
- **PR `UNKNOWN` fica FORA da conta** e é declarado como *não-medido*, nunca
  como inocentado.

### 3.6 O que eu quase escrevi errado, e o que me segurou

Ia afirmar no comentário do `#324` que mergear e rodar **destruiria** o estado
da aluna. Fui checar: hoje ela **tem** voz `ready` sob o `user_id` — o que não
era verdade em 17/09, quando o script foi escrito — então `estadoDasEtapas`
pode muito bem recarimbar o pedido de volta pra `pronto` na primeira leitura.
**Eu não medi isso.** Troquei a afirmação por duas separadas, e as duas são
verificáveis: *(1)* o que o script **escreve** (`status='audio'`, `audios=[]`,
três campos a `null`) é escrita sem benefício em dado de aluna pagante;
*(2)* **ninguém deve rodar script hard-coded em aluno pra descobrir** qual das
duas coisas acontece. A correção está no cabeçalho do instrumento, no comentário
do PR e no cartão — nos três lugares, não só aqui.

É a armadilha de sempre nesta casa: **deduzir e chamar de medido.** Era o mesmo
erro que a nota de 18/09 do `2e77bc4e` já tinha cometido e corrigido contra si
mesma no mesmo dia.

---

## 4. O que isto muda na conta da casa

A fila de consertos prontos vinha sendo reportada pelo **4º dia** como o
gargalo (*"39 consertos prontos parados, 19 podres"*). O número não estava
errado por descuido — estava **inflado por uma classe que ninguém tinha nomeado**.

**Medido no mesmo instrumento antes e depois: `47 → 45` MERGEABLE+CLEAN**, só
com os dois que eu provei. (O `conserto_pronto_e_parado` tinha dito **46**
~15 min antes — a fila de PR **muda durante a ronda**, então comparo número que
eu mesmo colhi nos dois instantes, não o de outro instrumento em outra hora.)
Há **13 candidatos** a examinar, e alguns vão se confirmar legítimos.

**O que isto NÃO é:** não é alívio do gargalo. **45 consertos continuam
esperando merge**, 26 há 3 dias ou mais, e o corte medido continua de pé —
*passou de ~8 dias, o conserto não é mergeado, é retrabalhado* (14 de 14 PRs com
9d+ estão conflitados). Tirar remédio morto da fila **não entrega conserto
nenhum**; só faz o número parar de mentir pra cima.

---

## 5. Dinheiro, GPU, aluno

- **Não mexi** em crédito, acesso, plano, assinatura, saldo nem status de pedido.
- **Não gastei GPU**, não pedi retreino, não regenerei áudio de ninguém.
- **Não escrevi pra aluno nenhum** — nenhum caso meu exigia carta (a Janice já
  foi respondida em 18/09, e o caso dela está materialmente resolvido).
- **Não apliquei migration**, **não mergeei nada**, **não apaguei branch**.
- **Não toquei** nos 6 branches STALE do índice.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não li** a caixa do suporte@ pra triagem (a Fast marca como lido).
- **Fechei 2 PRs** — ação reversível, sem efeito em produção, com precedente na
  casa (o PR #54 foi fechado pelo Frank em 02/09 e está registrado no índice).

---

## 6. Fim de ronda

- Log commitado na **main**. Nenhum código de **produção** mudou — só
  instrumento de ronda (`_frank/ferramentas/`), que não deploya.
- **Não criei branch**, então não havia fix meu pra ficar preso.
- `git log --oneline origin/main..HEAD` conferido **vazio** no fim.
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado.

### O que fica pra próxima ronda, com nome

1. **Os 13 candidatos a remédio obsoleto** — cada um exige abrir e medir no
   banco vivo. Não fechar nenhum pelo sinal.
2. **Escolher e mergear 1 conserto de verdade.** Era o plano desta ronda e
   virou a descoberta acima; a fila de 44 continua. Candidatos que eu já
   descartei como obsoletos: nenhum dos abaixo. Com aluno atrás e blast radius
   pequeno: `#343` (esqueci-a-senha pelo SMTP da casa, 8 arquivos, auth),
   `#372` (voz pronta sem referência abre chamado), `#325` (detector de estorno
   órfão, 1 arquivo).
3. **`#307` vence amanhã.** Está com **8d** e o corte medido é em 8 — é o mais
   velho da coluna "entram hoje" e o próximo a apodrecer.

### Sobre o passo fixo do `git rev-list` (repito, porque continua valendo)

Ele acusa ~193 branches e boa parte é falso positivo (squash-merge deixa o
conteúdo na main com sha diferente); `git cherry` distingue, `rev-list` não.
Segue **proposto e não aplicado** — corrigir ordem não é alçada de ronda. Esta
ronda não criou branch, então o passo não tinha o que pegar.
