# Rotina das Falhas — ronda das 21h (2026-08-20, 20:40–21:15 UTC)

Dono da fila: Frank (regra 14-A). Ordens lidas: `README.md` (índice) +
`2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐ vigente) +
`2026-08-20_fluxo_quem_olha_o_que.md`.

**Resumo em uma linha:** fechei **zero** incidentes — e isso está certo, porque
nada foi resolvido de ponta a ponta. O que esta ronda entrega é **apuração**: a
acusação de cobrança dupla do Victor está **derrubada com os prints dele
mesmo**, e o incidente técnico do `resolved_at` teve a **minha primeira
hipótese refutada pela medição** antes de virar card errado pro coder.

---

## 1. Fila — conferida paginada, com o `error` cru impresso

```
ERRO_PAGINA: null
count exact = 68 | acumulado = 68
TALLY POR STATUS = {"ignored":15,"fixed":48,"investigating":5}   soma = 68 ✅
```

Cinco em `investigating`, do mais antigo pro mais novo. Fui por essa ordem, com
a prioridade da ordem vigente: **aluno esperando antes de limpeza de fila.**

| # | incidente | idade | quem espera | desfecho desta ronda |
|---|---|---|---|---|
| 1 | `ce6e157d` | 32,5h | **aluna** (Katia) | nota; área do Claude, não toquei |
| 2 | `5c3f1f8b` | 3,9h | **alunos** (3 pagantes) | nota; confirmado que **não** se resolveu |
| 3 | `166a1df4` | 0,4h | **aluno** (Victor) | **apuração fechada**, falta só a ação do Johnny |
| 4 | `261b295b` | 0,4h | técnico | causa real medida → card `f61bd0bc` |
| 5 | `100e7ace` | 0,1h | técnico | aberto pelo Claude 20:33, área dele |

**Nada preso:** `varredura_travados.cjs` → 0 itens em estado intermediário.

## 2. Pergunta 1 da rotina — "já resolveu sozinho?" — em todos: **não**

Conferi o estado atual no banco antes de qualquer teoria. Nenhum dos alunos
destravou e nenhum escreveu de novo.

## 3. 🔴 Victor Ramalho — olhei os 2 prints. A cobrança dupla **não existe**

O incidente pedia explicitamente (passo 2 da nota do executor): *baixar os
prints do uid 137, que ninguém olhou*. Fiz.

- `image1.jpeg` — tela **"Historial de Recurrencias"** da Hotmart. O formato de
  data é **MM/DD/YYYY**, provado pelo próprio print (`08/16/2026` só pode ser
  16/ago). Recorrência **nº 2 — 16/08 — Aprobada — R$ 97,00 — HP2923424997**.
- `image0.jpeg` — detalhe da recorrência **nº 1 — 09/08 — Aprobada —
  HP2133855145 — campo "Valor" EM BRANCO.**

**Os prints dele batem com a nossa base, transação por transação.** Ele viu
duas linhas "Aprobada" e leu como duas cobranças; **uma delas não tem valor**
(o período gratuito). Confirmado também no `payment_events` com o `price` cru:
`value=0` na rec#1, `value=97` na rec#2. **Não há dinheiro pendurado e não há o
que estornar** — e agora isso está provado com a evidência **dele**, não com a
nossa palavra.

**O relógio, que ninguém tinha apurado.** O vigia registrou honestamente que
não apurou a próxima cobrança. Apurei:

```
payment_events.date_next_charge = 2026-09-09T12:00:00Z   (= profiles.access_until)
```

⚠️ **Corrijo um alarme que eu mesmo ia dar.** As recorrências 1 e 2 têm **7
dias** de intervalo (09/08 → 16/08), o que parece semanal e me levaria a
escrever "ele será cobrado de novo em ~23/08, faltam 3 dias". **O próprio
evento da rec#2 fixa a próxima em 09/09** — são ~20 dias. Não há cobrança a
caminho. Isso **tira a urgência de dinheiro, mas não tira a dívida**: são 86h e
3 cobranças dele.

**Pela REGRA FINAL DE CRÉDITO, cancelar não tira nada dele:** fica com os
**144.388 créditos** e com o acesso até 09/09, só não recebe crédito novo. É
uma boa notícia e não há motivo para segurar a resposta.

**Não fechei.** Cancelar na Hotmart é ação externa e irreversível e responder
aluno precisa do "pode" — as duas são do Johnny. **O que faltava de apuração
está feito:** a resposta ao aluno já pode ser escrita sem nenhuma consulta nova.

## 4. `261b295b` — a medição derrubou a minha hipótese antes do card

**O alarme de hoje já desarmou sozinho.** O vigia mediu "eram 3, viraram 5".
Remedi: **são 3 de novo** — os dois de hoje (`ef6e08a4`, `bea487b7`) receberam
`resolved_at` entre 20:19 e 20:50. Os 3 que sobram são velhos.

**Minha hipótese errada, dita antes do número.** Li o código, vi que as duas
rotas de fechamento só gravam `resolved_at` quando `status === "fixed"`, e
concluí que *todo* `ignored` nasceria cego. **A medição derrubou:** dos 15
`ignored`, **13 têm** `resolved_at`. A rota não é o caminho que a equipe usa na
prática — os fechamentos são por script direto, que grava o campo na mão. Se eu
tivesse mandado o card sem contar as linhas, o coder consertaria a causa errada.
**É a quinta heurística barata a falhar nesta base**; registro como as outras.

**O que sobra e é bug de verdade** (latente, não ativo): as rotas
`agent/actions/route.ts:61` e `admin/incidents/[id]/route.ts:35` realmente não
gravam `resolved_at` no `ignored`. Quem fechar como `ignored` **pela tela do
admin** produz incidente cego — e `ignored` é o balde de "alarme falso", ou
seja, onde um erro de julgamento nosso se esconde. A assinatura bate: os 2
cegos velhos (`72055f75`, `bee2fb8b`, ambos 21/07) são **os dois `ignored` e os
dois com `resolved_by` NULO**.

⚠️ **Corrijo a justificativa que circulou:** **não** foi `resolved_at` nulo que
fez o `8d370ef5` esconder 14 ocorrências. Fui olhar o registro: `status=fixed`,
`resolved_at=2026-08-20T03:29`, `resolved_by=agent` — **o campo está lá**. Ele
se escondeu por estar **fechado** e ninguém revisar fechado que segue
disparando. Misturar as duas faz o fix mirar no lugar errado.

→ Card **`f61bd0bc`** pro coder (branch `feat/incidents-resolved-at`, base
main), com o backfill dos 3 na mesma PR e instrução de **parar e avisar** se
precisar de migration. **Não fiz o backfill agora**: sem o fix, backfill limpa o
sintoma e a próxima tela de admin refaz. Segue `investigating` — fecha quando
estiver na main.

## 5. Um incidente citado que **não existe**

A nota do Claude no `ce6e157d` diz *"Frank abriu o `c713da83` pra isso"* (para
a queixa de **pacing**, frases coladas). **Varri as 68 linhas: não existe
nenhum id começando com `c713da83`, em nenhum status.**

Na prática o pacing **está** coberto — dentro do próprio `ce6e157d`, que segue
`investigating` com o diagnóstico do Claude (`handler.py:1341-1344`,
`chunk_crossfade_ms=60` funde o fim de uma frase no começo da seguinte, 841
vozes ainda no default). Mas quem for atrás do `c713da83` não acha nada e pode
concluir que o pacing ficou órfão — ou abrir card duplicado. Anotado no
incidente. **Ressalva honesta:** não sei se ele existiu e sumiu ou se o id foi
escrito de memória; fico com o que dá pra provar.

**Relógio do piloto de pacing:** a voz da Katia (`c127b74e`) foi atualizada
20/08 **20:15** (o piloto `tts_silence_ms=220`/`crossfade=0`). A última geração
dela é de **19/08 21:07**. **Não existe nenhuma geração pós-piloto** — dizer
que "melhorou" ou que "não adiantou" hoje seria chute.

## 6. O que conferi e estava certo

- **`d3d8d1b2` (timeout):** a ordem manda reabrir **se voltar**. Última
  ocorrência **18/08 20:46**, ~48h atrás. **Não voltou, não reabri.**
- **Fechados que voltaram a disparar:** **1**, o conhecido `acf8acd6`, parado há
  68h (`last_seen` anterior ao fix da foto). Não reabri.
- **Fechados com `last_seen` < 24h:** 9, todos de classes já cobertas. Nada
  escondido.
- **Git:** `git log origin/main..HEAD` **vazio**. Nenhum fix preso em branch
  nova.

⚠️ **Uma branch redundante, sem urgência:** `feat/oculta-msg-saldo-velha`
(`452812d`, do coder, 16:54 UTC) resolve o `bea487b7` pelo **lado da leitura**
(filtro no GET). Na main já está o `dafd7fd` (19:28 UTC, do Johnny), que
resolve pelo **lado da escrita** (limpa na entrada de crédito). **O bug está
corrigido na main**; a branch virou trabalho duplicado. Não mergeei nem apaguei
— fica pro Johnny decidir descartar.

## 7. O que NÃO fiz

- **Não marquei nada como `fixed`** — nada foi resolvido de ponta a ponta.
- Não gastei GPU, não retreinei, não regerei áudio, não toquei em crédito.
- Não cancelei assinatura, não estornei.
- Não escrevi para aluno nenhum (sem o "pode").
- Não rodei migration, não mergeei branch, não apaguei branch.
- Não li a caixa do suporte@ para triagem. A única leitura foi
  `--anexos 137`, que é o passo que o próprio incidente pedia; flags e fila de
  não-lidos da Fast conferidas **intactas** antes e depois.
- Não toquei no status de `ce6e157d` nem de `100e7ace` (área do worker/Claude).

## 8. Precisa de decisão do Johnny

1. **Victor** (86h, cobrou 3×) — cancelar o subscriber `5MOBYUUT` na Hotmart e
   deixar eu responder. **A apuração está pronta:** cobrança dupla não existe,
   ele mantém 144.388 créditos e acesso até 09/09, e a próxima cobrança (09/09)
   está a 20 dias — dá tempo, mas ele está esperando desde 17/08.
2. **marcelopersonalthe32 e csitya100** — retreino por conta da casa (falha
   nossa nos dois). Gasta GPU.
3. **ivanildezuca** — só e-mail explicando o gate dos 10 min (não gasta GPU).
4. **Katia** — 1 regeração para ouvir o piloto de pacing + a referência curada.
   Gasta GPU. Sem isso o piloto não tem veredito.
5. **Estrutural** — voz `failed` não volta pra fila; o aluno lê "tente treinar
   novamente" e o produto não deixa. Vira card quando aprovar a direção.

## 9. Ferramentas desta ronda

Em `_Bugs/` (fora do git, uso único): `..._fila.cjs` (paginada + zumbis +
`resolved_at` nulo + fechados recentes), `..._estado.cjs` (pergunta 1),
`..._victor.cjs` / `..._victor2.cjs` (payment_events), `..._schema.cjs`,
`..._resolvedat.cjs` (a medição que derrubou a hipótese), `..._c713.cjs`,
`..._anota.cjs` e `..._anota2.cjs` (ensaio → `--confirmar` → releitura
independente; 1 linha afetada por update, conferido).
