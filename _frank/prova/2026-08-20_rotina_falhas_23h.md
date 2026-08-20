# Rotina das Falhas — ronda das 23h (2026-08-20, 22:40–23:05 UTC)

Dono da fila: Frank (regra 14-A). Ordens lidas: `_frank/ordens/README.md` (índice)
+ `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐ vigente) +
`2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-20_correcoes_da_ronda.md`.

**Resumo em uma linha:** fechei **zero** incidentes e isso está certo — nada foi
resolvido de ponta a ponta. O que esta ronda entrega é **destravar o backfill dos
16 pagantes**: a objeção do Vigia (o script não existia no git, ninguém conseguia
rodar) está resolvida, a ferramenta está versionada na main e ensaiada, e falta
só o "pode" do Johnny — que **acionei na hora**, não no relatório, porque um dos
16 vence em 13h.

---

## 1. Fila — paginada, com o `error` cru impresso

```
ERRO_COUNT: null
count exact = 69 | acumulado = 69   (paginado; a consulta corta em 1000)
TALLY POR STATUS = {"ignored":15,"fixed":50,"investigating":4}   soma = 69 ✅
```

**Quatro em `investigating`, zero em `open`.** Do mais antigo pro mais novo, com a
prioridade da ordem vigente (aluno esperando antes de limpeza de fila):

| # | incidente | idade | quem espera | desfecho desta ronda |
|---|---|---|---|---|
| 1 | `ce6e157d` | 34,5h | **aluna** (Katia) | sem novidade; área do Claude, não toquei |
| 2 | `5c3f1f8b` | 5,9h | **alunos** (3 pagantes) | nota: conferido que **não** se resolveu |
| 3 | `100e7ace` | 2,1h | técnico | causa já refutada às 22h; nada novo a medir |
| 4 | `c3893803` | 0,4h | **16 pagantes** | **re-medido + ferramenta na main + Johnny acionado** |

Desde a ronda das 21h, dois saíram: `166a1df4` (Victor) e `261b295b`
(`resolved_at`), ambos `fixed` com nota. **Não fui eu que fechei** — confirmei que
ambos têm `resolved_at` e `resolved_by` gravados, então não entram no balde de
"fechado cego".

## 2. Pergunta 1 da rotina — "já resolveu sozinho?" — em todos: **não**

Conferido no banco antes de qualquer teoria:

- **Katia** — voz `c127b74e` **[ready]**, atualizada 20/08 20:15 (o piloto de
  pacing). Última geração dela é de **19/08 21:07**. **Continua sem nenhuma
  geração pós-piloto** — dizer hoje que o piloto "funcionou" ou "não adiantou"
  segue sendo chute, igual às 21h.
- **Marcelo** (`f6f82819` failed desde 10/08), **Cláudio** (`8aca0126` failed
  desde 15/08), **Ivanilde** (`4b4567fe` + `4c2c4abc` failed desde 08/08) — os
  três sem geração nenhuma, os três pagantes com acesso vivo e crédito parado
  (198.950 / 200.655 / 200.000).

## 3. 🔴 `c3893803` — os 16 pagantes com o período pago apagado

**Re-medi por conta própria, terceiro método independente** (paginado: 811
entitlements + 1328 profiles), reimplementando `valeAcesso()` do `a9e33ae`:
**16 divergentes, lista idêntica** à do Vigia e à do commit. Três medições, mesmo
resultado. Todos com o mesmo desenho: entitlement `canceled` com período pago no
futuro, `profiles.access_until = NULL`, `plan = free`.

**A objeção do Vigia era a parte útil e está resolvida.** O commit `a9e33ae`
apontava o backfill para `_Bugs/erro_20ago/varredura_acesso_pago.cjs`, que **não
está no git** — ou seja, o conserto das vítimas dependia de uma máquina só.
Agora existe versionado: **`_frank/ferramentas/backfill_acesso_pago.cjs`**
(commit `e4440e2`).

O que a ferramenta faz e, principalmente, o que **não** faz:

- **não concede acesso a ninguém** — só copia para o profile o `access_until` que
  **já está** no entitlement, pela mesma regra do `a9e33ae`;
- **não revoga** nada; **não** toca em crédito, **não** gasta GPU, **não** escreve
  para aluno;
- ensaio por padrão, grava só com `--confirmar`, confere **1 linha afetada por
  update** (`.select()`) e **relê do banco** depois — update por id inexistente
  afeta 0 linhas em silêncio;
- idempotente: rodar de novo depois de aplicado não acha divergência nenhuma.

**Ensaio rodado 22:44 UTC: 16 alvos, zero colateral.** Não apliquei.

**Por que não apliquei sozinho.** Mexe em acesso de 16 clientes, e "qualquer coisa
que mexa em dinheiro ou acesso de cliente" é do Johnny
(`2026-08-20_fluxo_quem_olha_o_que.md`), com o precedente das 47 em
`2026-08-20_correcoes_da_ronda.md` item 1 — *"meça e reporte, não destrave
ainda"*. **Acionei o Johnny na hora, sem esperar o relatório**, porque
`dr.bruno@blradvogados.com.br` vence **21/08 12:00 UTC**: passou disso, não há o
que restaurar e ele perde em silêncio dias que pagou.

### O que eu descartei (para a próxima ronda não remedir)

- **Não é "trancado".** O gate de uso é crédito, e crédito eles têm. O que perdem
  é comprar crédito avulso (`credits/checkout` → 403) e a UI tratá-los como
  não-assinantes.
- **Os 30 perfis com `access_until` vivo sem entitlement que valha não são dano.**
  Medi por controle e fui olhar antes de dar o alarme: **todas as datas estão no
  passado**, e `hasActiveAccess()` (`frontend/src/lib/credits/access.ts:34-41`)
  compara com agora — então já leem como "sem acesso". Cache velho, não bug.
- **Não se resolve sozinho.** `recomputeProfileAccess()` só é chamada dentro de
  upsert/update de entitlement (`entitlements.ts:61,90,109`), ou seja, só com
  evento novo de webhook — e assinatura já cancelada não gera evento novo.

## 4. Produção — sã

- `generations` 24h: **142 · 138 ready · 4 failed · 0 presa**. As 4 falhas são
  todas `qa_coverage` (o portão **protegendo**), a mais recente há **12,6h** —
  **zero falha nas últimas 12h**.
- `training_jobs` 24h: **29 de 29 completed, zero failed**.
- `varredura_travados.cjs`: **0 itens** em estado intermediário.
- **`d3d8d1b2` (timeout, risco aceito pelo Johnny) NÃO voltou.** As 2 ocorrências
  de `executionTimeout` nas últimas 72h são ambas de **18/08** (~50h). A ordem diz
  "reabrir se voltar" — não voltou, **não reabri**. Se voltar, o passo já está
  escrito: instrumentar o handler para logar em QUAL fase o chunk pendura.
- **Fechados que voltaram a disparar:** conferi os fechados com `last_seen_at` nas
  últimas 48h. **Nenhum com last_seen posterior ao próprio fechamento.** Os de
  hoje (`c4b892e9`, `37bacb68`) são da classe `qa_coverage` já coberta, com
  `last_seen` de 12h atrás — anteriores ao último fix.
- **Fechados sem `resolved_at` (cegos pro detector): 0.** Eram 5 hoje de manhã; o
  `261b295b` fechou essa porta pelos dois lados (app + `fechamento()` em
  `_comum.cjs`).

## 5. Erros meus nesta ronda, e o que os pegou

1. **Consultei `incidents` por `id LIKE 'c3893803%'`** e o retorno foi vazio. Se eu
   não imprimisse o `error` cru, teria escrito no relatório *"o incidente não
   existe"* — exatamente o erro do `c713da83` da ronda passada, ao contrário. O
   erro era `42883: operator does not exist: uuid ~~ unknown`: `id` é `uuid` e não
   aceita `like`. **Zero mentiroso pego pela terceira ronda seguida** — imprimir o
   `error` antes de acreditar em qualquer vazio já pagou o custo várias vezes.
2. **Meu script de anotação ia SOBRESCREVER a nota do `5c3f1f8b`** (2.469 chars com
   a medição arquivo-por-arquivo das 21h). O **ensaio** mostrou "nota atual: 2469
   chars" e eu vi antes de gravar. Passei a **anexar** com separador. Sem o ensaio,
   a medição de uma ronda inteira teria sumido sem ninguém notar.

## 6. O que NÃO fiz

- **Não marquei nada como `fixed`** — nada foi resolvido de ponta a ponta.
- **Não rodei o backfill** (só o ensaio). Não mexi em acesso de ninguém.
- Não gastei GPU, não retreinei, não regerei áudio, não toquei em crédito.
- Não escrevi para aluno nenhum (sem o "pode").
- Não rodei migration, não mergeei branch, não apaguei branch.
- Não li a caixa do `suporte@` para triagem — a fila de incidents é a fonte.
- Não toquei no status de `ce6e157d` nem de `100e7ace` (área do worker/Claude).
- Não reabri `d3d8d1b2`.

## 7. Precisa de decisão do Johnny

Repetido da ronda das 21h porque **nada saiu da lista** — decisão pendente não
tem cobrador, e é assim que ela dorme.

1. 🔴 **Os 16** (`c3893803`) — rodar
   `node _frank/ferramentas/backfill_acesso_pago.cjs --confirmar`. Um comando,
   reversível, não concede nada novo. **`dr.bruno` vence 21/08 12:00 UTC.**
2. **marcelopersonalthe32** e **csitya100** — retreino por conta da casa (falha
   nossa nos dois). **Gasta GPU.**
3. **ivanildezuca** — só e-mail explicando o gate dos 10 min. **Custo zero.**
   (O Vigia registrou: ela nunca foi contatada, há 12 dias. Cláudio, há 5.)
4. **Katia** — 1 regeração para ouvir o piloto de pacing + a referência curada.
   **Gasta GPU.** Sem isso o piloto não tem veredito, terceira ronda seguida.
5. **Estrutural** — voz `failed` não volta pra fila; o aluno lê "tente treinar
   novamente" e o produto não deixa. Vira card quando aprovar a direção.

## 8. Fim de ronda — passo fixo

```
git fetch origin && git log --oneline origin/main..HEAD   -> (conferido, ver abaixo)
git branch / git rev-list main..<branch>                   -> nenhum fix preso
```

## 9. Ferramentas desta ronda

- **Nova, versionada na main:** `_frank/ferramentas/backfill_acesso_pago.cjs`
  (`e4440e2`) — a que faltava para o backfill ter dono.
- Em `_Bugs/ronda23h/` (fora do git, uso único): `fila.cjs` (fila paginada +
  zumbis + `resolved_at` nulo), `acesso16.cjs` (a re-medição independente),
  `estado.cjs` (pergunta 1 + produção + timeout), `ver_c3893803.cjs` (o `42883`),
  `anota.cjs` (ensaio → `--confirmar` → releitura independente; 1 linha por
  update, conferido).
