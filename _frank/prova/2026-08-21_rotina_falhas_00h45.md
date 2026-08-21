# Rotina das Falhas — ronda das 00h45 (2026-08-21, 00:40–01:05 UTC)

Dono da fila: Frank (regra 14-A). Ordens lidas: `_frank/ordens/README.md` (índice)
+ `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐ vigente) +
`2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-20_correcoes_da_ronda.md`.

**Resumo em uma linha:** fechei **zero** — os 4 abertos continuam parados no "pode"
do Johnny, e fechar sem resolver é o que a regra 14 proíbe. O que esta ronda
entrega é **medição nova que muda uma recomendação que estava na fila há 4 rondas**:
o retreino do `csitya100` não é a aposta segura que a fila vinha dizendo que era.

---

## 1. Fila — paginada, `error` cru impresso, sem filtro de assinatura

```
[pag 0] ERRO_CRU: null | recebidos=69 | count=69
TALLY POR STATUS = {"fixed":50,"ignored":15,"investigating":4}  soma = 69 ✅
```

**Quatro em `investigating`, zero em `open`. Os mesmos quatro** da ronda das 23h40 e
da varredura do Vigia das 00h10. Nada novo em ~1h.

| # | incidente | idade | quem espera | desfecho desta ronda |
|---|---|---|---|---|
| 1 | `5c3f1f8b` | 254,0h | **3 alunos pagantes** | **medi os arquivos dos 3** → recomendação mudou; anotado |
| 2 | `ce6e157d` | 36,5h | **aluna** (Katia) | sem novidade; área do Claude, não toquei |
| 3 | `100e7ace` | 4,1h | técnico | causa já refutada às 22h; cauda do áudio é do Claude |
| 4 | `c3893803` | 2,7h | **16 pagantes** | 5ª medição, agora **derivada do zero**; anotado |

- **Zumbi (fechado que voltou a disparar): 1** — `acf8acd6`, o conhecido, última
  ocorrência **72,3h** atrás, ou seja **já saiu da janela de 72h**. Nenhum outro
  fechado tem `last_seen_at` posterior ao próprio `resolved_at`. Não reabri.
- **Fechados sem `resolved_at` (cegos pro detector): 0.** Segue curado desde `261b295b`.
- Conferi também os **26 fechados com `last_seen_at` recente (<72h)**, como manda a
  ordem: nenhum é classe fechada ainda disparando bug nosso.

## 2. Pergunta 1 da rotina — "já resolveu sozinho?" — nos 4: **não**

| aluno | voz | estado agora | saldo parado |
|---|---|---|---|
| marcelopersonalthe32 | `f6f82819` | **failed** desde 10/08 (254h) · zero gerações | 198.950 |
| csitya100 | `8aca0126` | **failed** desde 15/08 (126h) · zero gerações | 200.655 |
| ivanildezuca | `4c2c4abc`+`4b4567fe` | **failed** desde 08/08 (295h) · zero gerações | 200.000 |
| katiasalvador32 | `c127b74e` | **ready**; última geração **27,6h** atrás | 78.665 |

**Katia: quinta ronda seguida sem nenhuma geração pós-piloto de pacing** (voz
atualizada 4,4h atrás; última geração é de 19/08 21:07, anterior a isso). Dizer que o
piloto "funcionou" ou "não adiantou" continua sendo chute. O veredito custa 1 geração
= GPU = Johnny.

## 3. Produção — sã

- `generations` 24h: **127 · 124 ready · 3 failed · 0 presa.** As 3 falhas são
  **todas** `qa_coverage` (o portão **protegendo**) e a mais recente tem **14,5h** —
  zero falha nas últimas 14,5h.
- `training_jobs` 24h: **26 de 26 `completed`**, zero failed.
- **`d3d8d1b2` (timeout, risco aceito pelo Johnny): NÃO voltou.** As 2 ocorrências de
  `executionTimeout` em 72h são de **18/08** (51,9h e 54,6h). A ordem manda reabrir
  *se voltar*; não voltou, **não reabri** e não instrumentei.

## 4. ⭐ O achado desta ronda: o retreino do csitya não é seguro

A ordem de 20/08 manda, para treino que falha, **listar os ARQUIVOS da voz primeiro**.
Fiz isso nos 3 — e ninguém tinha feito nas rondas recentes.

**Primeiro, a boa notícia:** conferi objeto a objeto no R2 (`HeadObject`) e **todo o
áudio dos 3 continua lá**. Nada evaporou; retreino é tecnicamente possível nos três.

**Agora o problema.** A voz `8aca0126` do csitya100 tem **20 arquivos** em
`raw_audio_paths`, e só **7 têm faixa de áudio**: 1 mp3 + 6 mp4. Os outros 13 são
**6 jpeg + 7 pdf** — é a pasta inteira do Drive, o mesmo defeito do `910ea757`, já
corrigido, mas a voz dele nunca foi resgatada. E o `duration_seconds` dele está
**NULL**: o pipeline morreu antes de medir, então **ninguém nunca soube quanto áudio
ele realmente tem**.

**Medi com `ffprobe`:**

```
000_...mp3   9,24 min   <- sozinho, JA ABAIXO do minimo
007..012 mp4 3,11 min   <- 6 clipes de 20 a 41 s
TOTAL BRUTO  12,36 min
```

O gate é `TRAIN_MIN_USEFUL_SECONDS=600` (`handler.py:378`) e mede **fala limpa depois
da separação vocal + VAD**, não o bruto. Então a pergunta certa é o rendimento
útil/bruto — e isso o banco responde, porque `training_jobs.useful_seconds` existe.

**Medi o rendimento real de 729 treinos históricos.** Vi rendimentos >100%
(impossíveis) e não engoli: isso denunciava `duration_seconds` contando um arquivo
enquanto `useful_seconds` soma todos. Refiz **só nos 258 treinos de arquivo único**,
onde o bruto é inequívoco:

```
1 arquivo  (n=258): p10 55,8% | mediana 92,6% | p90 97,8% | impossiveis >102% = 0
2+ arquivos(n=462): p10 63,6% | mediana 89,8% | p90 97,0% | impossiveis >102% = 3
```

Zero impossíveis no grupo limpo, e a mediana bate com a amostra cheia — a
contaminação era 1% e **não inflou o número**.

**Aplicado aos 12,36 min do csitya:** útil previsto **~11,1–11,4 min** contra mínimo
de **10,00**. Ele passaria em **69–76%** dos rendimentos históricos.

**Conclusão honesta:** retreinar o csitya por conta da casa é **~1 em 4 de gastar GPU
e ele levar uma SEGUNDA mensagem de falha**, com margem de ~1 minuto. A fila vinha
tratando isso como retreino simples. **Recomendo pedir mais áudio a ele junto com o
retreino, não só retreinar.**

**Isso não contamina os outros dois** — e a diferença importa:

- **marcelopersonalthe32**: 1 mp3 de 45 MB / **47 min**, falha foi `[Errno 28] No
  space left on device` (**infra nossa**). Retreino limpo, sem risco de gate.
- **ivanildezuca**: 30,7 min brutos → **5,9 e 6,0 min úteis medidos** (rendimento
  19%). O gate é **legítimo**. Retreinar no material atual reprova de novo com
  certeza praticamente total. **Só mais áudio resolve** — e isso é e-mail, não GPU.

## 5. 🔴 `c3893803` — os 16, e o relógio, medidos de outro jeito

**5ª medição, e desta vez não usei a lista da ferramenta.** Derivei a classe do zero
das tabelas cheias e paginadas (**1336 profiles × 813 entitlements**, regra
"entitlement com `access_until` no futuro **e** `profiles.access_until IS NULL`"):
deu **exatamente os mesmos 16**. Procurei também a variante vizinha (`access_until`
não-nulo mas **defasado** em relação ao entitlement): **0 casos**. A lista do backfill
está certa e **não há vítima fora dela**.

**Verifiquei o relógio em código, em vez de repetir a frase:** `valeAcesso()` exige,
para `status='canceled'`, `access_until > agora`. Logo, às **12:00 UTC de hoje** o
`dr.bruno@blradvogados.com.br` **sai sozinho e em silêncio** da lista de alvos — o
backfill deixa de enxergá-lo, sem erro nenhum.

**E agora a proporção honesta, que as rondas anteriores não deram:** o que o dr.bruno
perde às 12:00 são as **~11h finais** do período que ele pagou — o acesso dele
terminaria hoje de qualquer jeito. **O prêmio grande são os outros 15**, com 59h a
563h de período pago, e **esses não evaporam hoje**. Ou seja: o prazo de hoje é real,
mas pequeno; o valor maior não está sob prazo. Usar o dr.bruno como relógio de pânico
seria inflar.

**Não apliquei**, e o motivo não mudou: mexe em acesso de 16 clientes = Johnny
(`2026-08-20_fluxo_quem_olha_o_que.md`), com o precedente das 47 em
`2026-08-20_correcoes_da_ronda.md` item 1, que manda **explicitamente** não destravar
ninguém antes do aval.

**Não cobrei o Johnny uma 3ª vez, de propósito.** Já foram 2 (22:50Z e 23:47Z), sem
resposta; a última fala dele no grupo é de 14:45Z. Uma 3ª mensagem idêntica 47 min
depois, no meio da madrugada dele, não é "avisar na hora" — é transformar o sinal em
ruído. Mantida a cobrança para **~10:00Z**, que ainda deixa **2h** antes das 12:00.

## 6. Coluna `ja_pagou`: arma carregada, conferida, e **não** é incidente novo

`profiles.ja_pagou` está **`false` em 1336 de 1336** perfis — inclusive nos **736 que
têm entitlement**. Antes de abrir qualquer coisa, conferi quem lê: `ja_pagou` aparece
**só** no DDL da migration 79 e em scripts de investigação em `_Bugs/`. **Zero
ocorrências em `frontend/src` e em `runpod-worker/`.**

Ou seja: a coluna foi aplicada, o **backfill dela (passo 2 da ordem de 18/08) nunca
rodou**, e **nada em produção depende dela hoje** — sem risco imediato. Já estava
registrado na ronda das 00h de 20/08 e **não abri incidente duplicado**. Fica como
dívida conhecida: no dia em que alguém gatilhar crédito por esse campo, 736 pagantes
viram "nunca pagou" de uma vez.

## 7. Erros meus nesta ronda

1. **Consultei com `.like("id","8aca0126%")` num campo uuid e recebi `null`.** Quase
   li isso como "a voz não existe". Era a **minha consulta**, não o dado — `like` não
   casa em coluna uuid. Corrigi lendo a tabela e filtrando por `startsWith`. Quinta
   ronda seguida em que **desconfiar do zero/null antes de concluir** salva o
   relatório.
2. **Ia reportar o rendimento de 72% da amostra cheia.** Os rendimentos >100% no meio
   da amostra denunciaram que `duration_seconds` e `useful_seconds` nem sempre contam
   a mesma coisa. Refiz no subconjunto limpo antes de publicar o número.

Os dois writes desta ronda: **1 linha afetada cada**, com `.select()`, **relidos do
banco depois de gravar**, status `investigating` **inalterado** nos dois (nada foi
fechado nem reaberto por acidente).

## 8. O que NÃO fiz

- **Não marquei nada como `fixed`** — nada foi resolvido de ponta a ponta.
- Não rodei o backfill. Não mexi em acesso, plano ou crédito de ninguém.
- Não gastei GPU, não retreinei, não regerei áudio.
- Não escrevi para aluno nenhum (sem o "pode").
- Não rodei migration, não mergeei nem apaguei branch.
- Não li a caixa do `suporte@` para triagem — a fila de incidents é a fonte.
- Não reabri `d3d8d1b2` (não voltou) nem toquei em `ce6e157d`/`100e7ace` (Claude).
- Não abri incidente para `ja_pagou` (duplicado, e sem risco imediato).

## 9. Precisa de decisão do Johnny

Ordenado por relógio. **O item 2 mudou de conteúdo nesta ronda.**

1. 🔴 **Os 16** (`c3893803`) — `node _frank/ferramentas/backfill_acesso_pago.cjs --confirmar`.
   Um comando, reversível, não concede nada novo. **`dr.bruno` sai da lista às 12:00
   UTC** (~11h). Os outros 15 não estão sob prazo.
2. **marcelopersonalthe32** — retreino por conta da casa. **Gasta GPU, risco baixo**
   (47 min de áudio, falha foi infra nossa).
   **csitya100** — retreino **com ~1 em 4 de reprovar de novo**; recomendo pedir mais
   áudio **junto**. Gasta GPU.
3. **ivanildezuca** — **não retreinar**: reprova de novo (19% de rendimento medido).
   Só e-mail pedindo mais áudio. **Custo zero.** Sem contato há 12 dias.
4. **Katia** — 1 geração para dar veredito ao piloto de pacing. **Gasta GPU.**
   Quinta ronda sem veredito.
5. **Estrutural** — voz `failed` não volta pra fila; o aluno lê "tente treinar
   novamente" e o produto não deixa.

## 10. Ferramentas desta ronda

Em `_Bugs/ronda0045/` (fora do git, uso único): `schema.cjs` (nomes reais de coluna
antes de qualquer consulta), `fila.cjs` (fila paginada + zumbis + `resolved_at` nulo +
fechados com `last_seen` recente), `notas.cjs`, `estado.cjs` (pergunta 1 + produção +
timeout), `os16.cjs`, `classe.cjs` (a classe derivada do zero + variante defasada +
tally do `ja_pagou`), `arquivos.cjs` (**`raw_audio_paths` × `HeadObject` no R2**),
`medir_csitya.cjs` (ffprobe), `rendimento.cjs` / `rendimento2.cjs` (rendimento
útil/bruto, cheio e no subconjunto limpo), `acharid.cjs` (uuid de verdade),
`anota.cjs` (ensaio → `--confirmar` → releitura independente).

Reusei, sem alterar: `_frank/ferramentas/_comum.cjs`,
`_frank/ferramentas/backfill_acesso_pago.cjs` (**só leitura do código**, nem ensaio),
`_frank/ferramentas/telegram.cjs --espiar` (não consome update).
