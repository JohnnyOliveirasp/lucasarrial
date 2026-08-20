# Rotina das falhas — 20/08/2026, 01h UTC

Fila trabalhada do **mais antigo pro mais novo**, 5 incidentes (`open` +
`investigating`). Um fechado, quatro seguem abertos **com nota do que já foi
descartado**. Nada foi marcado `fixed` sem prova (regra 14).

## Resumo da rodada

| # | Incidente | Antes | Depois |
|---|---|---|---|
| 1 | `d3d8d1b2` executionTimeout | investigating | investigating + contador 151/470 e **correção de leitura minha** |
| 2 | `72a4c9db` orphan-outreach teto 1000 | **open** | **FIXED** — PR #13 mergeado, em produção, conferido |
| 3 | `fb8d29b7` QA não mede inserção/substituição | investigating | investigating + estado real do build |
| 4 | `43f37482` lucvila créditos | investigating | investigating + **causa achada** (é o #2) |
| 5 | `37bacb68` qa_coverage | investigating | investigating + **nota anterior corrigida** |

## O que realmente mudou hoje: o #2 saiu do papel

O fix estava **pronto e parado num PR desde 20/08 00:33**. O cron
`0 14 * * *` dispara às 14:00 UTC. PR parado é código que não protege ninguém
(regra 5), então revisei o diff e **mergeei**.

- merge `18ef715` (fix `c5f67bd`) → Deploy run `32319580920` = **success**
- no servidor: `.next/server/.../orphan-invites/route.js` contém as strings
  novas, `BUILD_ID` 01:04 UTC, pm2 `aiverse` reiniciado há 75s
- réplica read-only contra produção: órfãos **203 → 52**, 151 falsos positivos
  eliminados, **0** na direção inversa

A rodada das 14:00 de hoje já usa o código corrigido. **Não desfaz o estrago**:
os 105 continuam com o e-mail errado na caixa — decisão de comunicação é do
Johnny.

## Duas correções de raciocínio (minhas, na mesma rodada)

Valem mais que os números, porque eram erros prestes a virar conclusão errada.

**1. Fronteira errada pra medir fix de worker (#5).** Eu ia medir "antes/depois"
do `d9a14c0` usando o deploy do frontend (18:52). Mas `d9a14c0` é fix de
**worker**: o build levou 27m50s e só ficou vivo **~19:20**. Medindo de 18:52 a
taxa dava 1,33% → 3,33% ("piorou"). Medindo de 19:20: **1,62% → 1,89%** — ruído,
com 53 gerações. A nota anterior dizia *"Corrigido em d9a14c0"* e o incidente
bateu de novo às 00:35. **Corrigido é palavra que precisa de prova.**

**2. `elapsed` baixo não é folga se a causa é hang (#1).** Medi mediana 58s /
p95 155s / máx 226s contra o teto de 1200s e quase escrevi "tem folga". Mas a
ordem `2026-08-19_resposta_passagem_vozes.md` registra, conferindo os 13
estornos por `ref_type`: o padrão é **job pendurado 30min+ em texto pequeno =
hang de worker, não régua curta**. Job que pendura não gera `elapsed` pequeno.
Minha estatística mede o caminho feliz e **não diz nada sobre a causa**. Fica
como dado, não como prova — e o próximo passo passa a ser **instrumentar a fase
em que o chunk trava**, não esperar 470 gerações.

## O aluno vem antes da fila

- **dirceu.walber64** (#5, falhou 00:35, 2000 chars): estorno automático +2000 às
  00:39, saldo 65.932, ativo, 3 áudios ready antes. Não travado.
- **robertocesarfernandes771** (#5, falhou 00:09): estorno +1508 às 00:11,
  gerou sozinho 00:33 e 00:43 **ready**. Caso "já resolveu sozinho".
- **lucvila** (#4): **não está travado** — 13.409 créditos, ativo até 30/08,
  Video Clone quase diário (último 19/08 17:04). Os 300.000 entraram e foram
  gastos por ele. Nada devido.

**Não respondi o lucvila ainda, de propósito.** A mensagem dele tem um **print**
e o `ler_caixa` não baixa anexo. Responder "seu saldo está certo" pra quem
mandou uma foto que eu não abri é a regra 11 na veia — foi o que fez a aluna
explodir em 17/08. Card `398c68e0` (coder) está dando ao `ler_caixa` a flag
`--anexos <uid>`, mantendo `EXAMINE` + `BODY.PEEK` pra não atropelar a Fast.

## Achado que sobra do #2 (não fechei junto, de propósito)

`lib/admin/churn.ts:53` tem o **mesmo bug e já trunca hoje**: `payment_events`
PURCHASE_APPROVED = **1099 > 1000**. O churn pago × trial do `/admin` está
**errado agora**. É métrica, não ação contra cliente — por isso não entrou no PR
do incidente. Card próprio criado, junto com as bombas-relógio do mesmo padrão
(`totals.ts:77` → quando `runpod_spend_log` passar de 1000, custo de GPU some e
o lucro do `/admin` infla).

## Dependência cruzada anotada nos dois incidentes

`6af76ae` (QA de INTRUSÃO) **regenera chunk** ao detectar palavra inventada.
Mais regeneração = job mais longo. Foi mudança desse tipo (`777e405`, retries
2→3) que **criou** o `d3d8d1b2` em 29/07. Quando o worker novo subir: recomeçar
a contagem e vigiar o p95 de `elapsed` em texto longo.

## A armadilha nº 1 da rotina apareceu de novo

Duas consultas minhas erraram coluna (`incident_occurrences.occurred_at`,
`generations.updated_at`). O Supabase devolve **erro + `data: null`** — se eu não
checasse `error`, teria impresso "0 ocorrências" e dado a fila por limpa.
Conferi o `error` antes de acreditar no zero, como manda o `03_ROTINA.md`.

## Nada disso foi feito

Sem gastar GPU ou crédito de aluno, sem migration, sem e-mail para aluno, sem
mexer em saldo, sem tocar em produção fora do PR #13 revisado.
