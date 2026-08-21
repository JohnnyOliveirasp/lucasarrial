# Rotina das Falhas — ronda das 02h (2026-08-21, 01:40–02:05 UTC)

Dono da fila: Frank (regra 14-A). Ordens lidas: `_frank/ordens/README.md` (índice) +
`2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐ vigente) +
`2026-08-20_fluxo_quem_olha_o_que.md`. Ronda anterior: `2026-08-21_rotina_falhas_00h45.md`
e o relatório noturno `2026-08-21_relatorio_noturno.md` (escrito ~1h antes desta ronda).

**Resumo em uma linha:** achei **2 pagantes que nenhum detector nosso enxergava** —
sem voz há **26 e 21 dias**, ~198k créditos somados, **nunca contatados** —, consertei o
detector que os escondia e abri o `b9c5a0d1`. O conserto do problema deles custa **zero**
(um e-mail) e é a única coisa barata parada na fila.

---

## 1. Fila — paginada, `error` cru impresso

```
[pag 0] ERRO_CRU: null | recebidos=69 | count=69
TALLY = {"fixed":51,"ignored":15,"investigating":3}  soma = 69 ✅
```

Três em `investigating`, zero em `open` — os mesmos 3 do relatório noturno. O
`c3893803` (os 16) fechou às 01:06 e **eu conferi por fora**: ensaio do
`backfill_acesso_pago.cjs` (sem `--confirmar`) devolveu **DIVERGENTES = 0** contra
813 entitlements × 1336 profiles paginados. O fechamento do Claude se sustenta.

| # | incidente | idade | quem espera | desta ronda |
|---|---|---|---|---|
| 1 | `ce6e157d` | 37,5h | aluna (Katia) | relógio novo: acesso dela vence em ~34h; anotado |
| 2 | `5c3f1f8b` | 8,9h | 3 pagantes | **classe subcontada** — são 5, não 3; anotado |
| 3 | `100e7ace` | 5,1h | técnico | sem ocorrência nova, sem material pra medir; anotado |
| **novo** | **`b9c5a0d1`** | — | **2 pagantes** | **aberto nesta ronda** |

- **Zumbis: 0 dentro da janela.** O único (`acf8acd6`) tem `last_seen_at` de **73,4h**,
  já **fora** das 72h. Nenhum outro fechado tem `last_seen_at` posterior ao
  `resolved_at`.
- **Fechados sem `resolved_at`: 0** (segue curado desde o `261b295b`).
- Conferi os **27 fechados com `last_seen_at` < 72h**: nenhum é classe fechada ainda
  disparando bug nosso.

## 2. Pergunta 1 da rotina — "já resolveu sozinho?" — nos 3: **não**

| aluno | voz | estado agora | saldo parado |
|---|---|---|---|
| marcelopersonalthe32 | `f6f82819` | **failed** desde 10/08 (255,0h) · zero gerações | 198.950 |
| csitya100 | `8aca0126` | **failed** desde 15/08 (127,1h) · zero gerações | 200.655 |
| ivanildezuca | `4c2c4abc`+`4b4567fe` | **failed** desde 08/08 (296,4h) · zero gerações | 200.000 |
| katiasalvador32 | `c127b74e` | **ready**; última geração **28,6h** atrás | 78.665 |

**Katia — 6ª ronda sem veredito, e agora com prazo.** A voz foi atualizada 20/08 20:15
UTC (piloto de pacing 220/0); a última geração dela é de **19/08 21:07**, anterior ao
piloto. **O acesso dela vence 22/08 12:00 UTC (~34h).** Se ela não gerar nada até lá, o
piloto morre sem medição e as outras **841 vozes** seguem no default que cola as frases.
O veredito custa 1 geração = GPU = Johnny.

## 3. ⭐ O achado desta ronda: o detector media a classe errada

A ordem manda desconfiar de zero. Desta vez o que enganou não foi um zero — foi um
**três**.

O `5c3f1f8b` ("3 pagantes ativos sem nenhuma voz pronta") derivou a classe filtrando
`voices` por **`status='failed'`**. Refiz a **mesma pergunta sem filtro de status** —
*pagante com acesso vivo + ≥10.000 créditos + tem voz + **nenhuma** `ready`* — paginando
**847 vozes × 1336 profiles**:

```
status de TODAS as vozes: {"ready":744,"failed":51,"awaiting_training":28,"rejected_too_short":24}
PAGANTE VIVO + >=10000 creditos + TENTOU + NENHUMA voz ready:  5   (nao 3)
```

Os 2 que faltavam estão em **`rejected_too_short`** — estado **terminal que não é
`failed`** e que **nenhum detector olhava**. São 24 vozes nesse estado na base.

| aluno | créditos | sem voz desde | acesso até | material | mensagem |
|---|---|---|---|---|---|
| `jrfengenhariadf` | 100.000 | **25/07 (26 dias)** | **25/08 (4 dias)** | 4 arq · 617s = 10,3 min | "Áudio total 10min < mínimo de 20min" |
| `leandro.fitoway` | 97.620 | **30/07 (21 dias)** | 29/08 | 6 arq · 575s = 9,6 min | idem |

**Nenhum incidente cita esses e-mails. `onboarding_ready_email_at` é `null` nos dois.
Nunca foram contatados, nenhuma vez.**

E os dois casos não são iguais:

- **`jrfengenhariadf`** — usou o produto **2 vezes na vida** (1 áudio, 1 imagem) entre
  25 e 28/07 e sumiu. `last_seen_at` = **28/07 (23 dias)**. Recarregou 100k em 02/08 e
  não voltou. É **churn silencioso**: paga e não usa.
- **`leandro.fitoway`** — **está vivo**: `last_seen_at` de **7h atrás**, 12 transações,
  usa vídeo clone, vídeo estúdio e imagens. Cliente ativo, pagando, usando tudo **menos
  o clone de voz**, há 21 dias, sem nunca reclamar.

**O gate é legítimo, a omissão é nossa.** `uploads-complete/route.ts:31` exige
`MIN_TOTAL_SECONDS = 20min` **brutos** e os dois mandaram ~10. Recusar estava certo. O
errado foi recusar, deixar o aluno num estado terminal e **nunca avisar ninguém**, por 3
semanas, com o dinheiro entrando.

### Por que eles pareciam recentes

O `updated_at` dos dois é **18/08 ~10:45 UTC** porque o lote do `rescue-stuck-uploads`
reescreveu o campo naquele dia (o mesmo lote que reclassificou vozes paradas desde
julho). Medir espera por `updated_at` faz **3 semanas parecerem 63h**. A espera real
conta do `created_at`.

## 4. O que consertei — e a regra que ficou

`_frank/ferramentas/varredura_travados.cjs`: o detector **não enumera mais estados
ruins**. Ele **afirma o estado bom**:

> *"esse pagante tem alguma voz `ready`?"*

Enumerar estados ruins exige adivinhar a lista completa e vai cega no dia em que alguém
cria um status novo — foi exatamente o que aconteceu com `rejected_too_short`. A pergunta
invertida sobrevive a status que **ainda não existem**.

Ficam de fora de propósito: quem nunca subiu voz (não é vítima, é quem não tentou) e quem
não tem os 10.000 créditos do treino (aí o gate é o crédito, não defeito nosso).
`awaiting_training` **não** entrou em `ALVOS`: é espera legítima pelo clique do aluno
(`lib/onboarding/treino.ts`) e os 28 de hoje entupiriam a varredura de falso positivo
todo dia, que é o que a regra da fila proíbe.

A varredura agora abre com:

```
🚨 PAGANTE COM CRÉDITO E SEM NENHUMA VOZ PRONTA: 5
   jrfengenhariadf@gmail.com · 100000 créditos · sem voz desde 2026-07-25 (26 dias) · acesso até 2026-08-25
   leandro.fitoway@gmail.com · 97620 créditos · sem voz desde 2026-07-30 (21 dias) · acesso até 2026-08-29
   ivanildezuca@gmail.com    · 200000 créditos · sem voz desde 2026-08-08 (12 dias) · acesso até 2026-09-08
   marcelopersonalthe32@...  · 198950 créditos · sem voz desde 2026-08-10 (11 dias) · acesso até 2026-09-05
   csitya100@gmail.com       · 200655 créditos · sem voz desde 2026-08-15  (5 dias) · acesso até 2026-09-13
```

**Não confiei no zero do detector novo.** Rodei uma cópia com o filtro "tem voz pronta"
removido de propósito (`_Bugs/ronda0200/varredura_TESTE.cjs`): ela cospe os 11 pagantes
em `awaiting_training`. O caminho da query funciona — o zero das outras classes é real,
não silêncio de bug. Também confirmei `TRAINING_CREDIT_COST = 10_000` em
`lib/credits/config.ts` antes de usar 10.000 como corte, em vez de deduzir do estorno.

## 5. O ponto cego do relatório noturno, medido e derrubado

O buraco nº 1 do relatório era *"a varredura é cega pro `awaiting_training`: 28 vozes,
25 com +24h"*. Medi as 28, uma por uma:

- **28 de 28 têm áudio** em `raw_audio_paths` — nenhuma é registro vazio.
- **Pagante vivo + `awaiting_training` + nenhuma voz `ready` = 0.** Ninguém preso ali.
- Os **11 pagantes** que estão nesse estado têm crédito (24k a 187k) e **todos já têm
  outra voz pronta** — estão a um clique, não travados.
- **Nenhum deles carrega mensagem mentindo sobre crédito** (`error_message` vazio nos 11).
  O fix `dafd7fd` está de pé; a classe que gerou o caso de 58h não voltou.

7 dessas vozes foram criadas entre **19/07 e 17/08** mas têm `updated_at` de **18/08
10:40–11:33 UTC** — é o lote de resgate, não uso do aluno. Mesma origem dos 2 do
`b9c5a0d1`. **Não abri incidente para elas:** com voz pronta na conta, não há aluno sem
produto, e um card que volta toda ronda sem desfecho entope a fila.

## 6. Produção — sã

- `generations` 24h: **127 · 124 ready · 3 failed · 0 presa.** As 3 falhas são todas
  `qa_coverage` e **todas anteriores ao deploy da régua nova** (20/08 11:41:58 UTC):
  15,5h, 17,0h e 22,7h atrás. **Zero reprovação nas 14,2h desde o deploy** — consistente
  com as 98 amostras do relatório noturno, medido por outro caminho.
- `image_generations` 24h: **136/136 ready.** `video_clones`: **107/107 ready.**
  `training_jobs`: **27/27 completed**, zero failed.
- **`d3d8d1b2` (timeout, risco aceito): NÃO voltou.** As 2 ocorrências em 72h são de
  **18/08** (52,9h e 55,6h). A ordem manda reabrir *se voltar*; não voltou, **não reabri**
  e não instrumentei.
- Varredura padrão: **0 item preso** em todas as filas.

## 7. Escalado ao Johnny — na hora, não no relatório

Mandei **uma** mensagem ao grupo (message_id 198), porque a regra de "acumule para um
relatório" cede quando é **pagante travado sem solução**, e porque isto é **novo**: o
relatório noturno saiu ~1h antes e não continha estes 2.

O pedido é **um só e custa zero**: *"pode"* para e-mail aos 2 pedindo mais áudio. Sem
GPU, sem crédito, sem migration. Não repeti a cobrança dos 16 (fechada) nem inflei o
resto — só relembrei, em uma linha, o que já estava parado.

## 8. Precisa de decisão do Johnny

Ordenado por relógio.

1. 🔴 **E-mail aos 2 do `b9c5a0d1`** pedindo mais áudio. **Custo ZERO.**
   `jrfengenhariadf` tem **4 dias** de acesso; nunca foi contatado em 26 dias.
2. **Katia** — 1 geração para dar veredito ao piloto de pacing. **Gasta GPU.**
   **Vence 22/08 12:00 UTC (~34h)**; depois disso o piloto morre sem medição e as 841
   vozes seguem coladas.
3. **marcelopersonalthe32** — retreino por conta da casa. Gasta GPU, **risco baixo**
   (47 min de áudio, falha foi infra nossa).
   **csitya100** — retreino com **~1 em 4 de reprovar de novo**; recomendo pedir mais
   áudio **junto**.
4. **ivanildezuca** — **não retreinar** (19% de rendimento medido, reprova de novo).
   Só e-mail. **Custo zero.** Sem contato há 12 dias.
5. **Estrutural** — voz `failed` e voz `rejected_too_short` não voltam pra fila. O aluno
   lê "tente novamente" e o produto não deixa. É a razão de **todos os 5** dependerem de
   decisão humana em vez de o aluno se resolver sozinho.

## 9. Erros meus nesta ronda

1. **Consultei `profiles.credits`, que não existe.** O `ERRO_CRU` impresso pegou na hora
   (`42703`); as colunas são `credits_subscription` + `credits_extra`. Foi por ter pulado
   o passo do schema — rodei `schema.cjs` **depois** do primeiro erro, quando a ordem
   manda antes. Custou uma query, mas se eu tivesse tratado o erro como "aluno sem
   crédito" teria custado o relatório.
2. **Minha primeira versão do detector também era cega.** Escrevi a lista
   `INTERM = [uploading, validating, training, awaiting_training, ...]` — repeti o
   mesmo defeito que fui achar, só que com uma lista maior. Só vi quando o lote de 18/08
   me mostrou `rejected_too_short`, que não estava em lista nenhuma. **Lista de estados
   ruins é armadilha por construção**; foi isso que virou a regra da seção 4.
3. **Ia reportar "parado há 63h" para os 2.** Era o `updated_at` reescrito pelo lote.
   A espera real é 26 e 21 dias — **20× maior**. Corrigi o detector para contar do
   `created_at` antes de publicar o número.

Os **4 writes** desta ronda (1 insert + 3 updates de nota): **1 linha afetada cada**, com
`.select()`, **relidos do banco depois de gravar**. Os 3 incidentes anotados continuam
`investigating` — **nada foi fechado nem reaberto por acidente**. O insert foi precedido
de checagem de `signature` duplicada e de ensaio sem `--confirmar`.

## 10. O que NÃO fiz

- **Não marquei nada como `fixed`.** O `b9c5a0d1` nasce `open`: o detector foi consertado,
  mas os 2 alunos continuam sem voz. **Consertar o instrumento não é resgatar o aluno.**
- Não escrevi para aluno nenhum (sem o "pode"). Não gastei GPU, não retreinei, não regerei
  áudio. Não mexi em crédito, plano ou acesso.
- Não rodei migration, não mergeei, não apaguei branch.
- Não reabri `d3d8d1b2` (não voltou) nem toquei em `ce6e157d`/`100e7ace` no código (worker
  = Claude).
- Não mudei o escopo do `5c3f1f8b` para caber os 2 novos — card com 5 causas vira balde.
- Não abri incidente para as 11 vozes em `awaiting_training` (ninguém sem produto).
- Não li a caixa do `suporte@` para triagem.

## 11. Ferramentas desta ronda

Em `_Bugs/ronda0200/` (fora do git, uso único): `schema.cjs` (colunas reais),
`fila.cjs` (fila paginada + zumbis + `resolved_at` nulo + fechados recentes),
`estado.cjs` (pergunta 1), `producao.cjs` (24h + timeout em 72h), `awaiting.cjs` /
`aw2.cjs` / `aw3.cjs` (o ponto cego do `awaiting_training`), `cluster.cjs` (o lote de
18/08), `resgatadas.cjs` (**foi este que achou os 2**), `sem_voz.cjs` (a classe derivada
sem filtro de status), `dois.cjs` (raio-x dos 2), `vercampos.cjs` (convenção de
`signature`/`kind`), `varredura_TESTE.cjs` (prova de que o zero é real), `abrir.cjs` e
`anota.cjs` (ensaio → `--confirmar` → releitura independente).

Alterado e commitado na main: `_frank/ferramentas/varredura_travados.cjs`.
Reusado sem alterar: `_comum.cjs`, `backfill_acesso_pago.cjs` (**só ensaio**),
`telegram.cjs --enviar`.

## 12. Passo fixo de fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` → **vazio** (registrado abaixo,
depois do commit). `git branch` + `git rev-list main..<branch>` conferidos: nada de fix de
aluno preso em branch nesta ronda. Os achados de branch da ronda anterior (migrations 85
duplicadas, `fix/fast-email-dedupe-por-queixa` publicada no origin) continuam válidos e
**sem mudança** — não são meus para mergear.
