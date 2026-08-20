# Card 20/08 (261b295b) — fechamento de incidente sem `resolved_at` cega o detector de zumbi

Branch: `feat/incidents-resolved-at` (worktree isolada; main intocada). PR base main.
(V2 do trabalho da branch `feat/incidents-resolved-guard`, aproveitado por cherry-pick;
deltas do card novo: reabrir agora LIMPA `resolved_at`/`resolved_by`, e os 2 cegos de
21/07 ganharam backfill com `last_seen_at` — decisão do card, derruba o "nulo de
propósito" da v1. Migration renumerada 85→86: o 85 já é da PR #18.)

## 1. TODOS os caminhos que gravam `status='fixed'/'ignored'` (lista completa, achada antes de mexer)

| # | Caminho | O que gravava ANTES | Buraco |
|---|---------|--------------------|--------|
| 1 | `frontend/src/app/api/v1/admin/incidents/[id]/route.ts` (PATCH da aba Falhas) | `fixed` → resolved_by/at ✓ | **`ignored` → gravava NADA** (provável origem dos 2 cegos de 21/07) |
| 2 | `frontend/src/app/api/v1/agent/actions/route.ts` (`set_status`, token do vigia) | `fixed` → "agent"+data ✓ | **`ignored` → gravava NADA** |
| 3 | `frontend/src/lib/incidents/ingest.ts` (nasce `ignored`, regra 17/08) | resolved_at ✓ | **resolved_by ficava nulo** |
| 4 | `frontend/src/lib/support/failure-alert.ts` (`openBurstIncident`, nasce `ignored`) | resolved_at ✓ | **resolved_by ficava nulo** |
| 5 | **Scripts ad-hoc de ronda em `_Bugs/*.cjs`** (service-role direto via `_comum.cjs`) | cada ronda reescreve o seu; uns lembram, outros não (ex.: `fecha_incidente_voz.cjs` gravou resolved_at sem resolved_by; a forma que produziu o 9b7cc261 gravou só status+nota) | **caminho que NENHUM código do app cobre** — é a fonte ativa do problema |

Não fecham (só abrem/reabrem, conferido linha a linha): `mail-respond.ts`, o
insert do reporte manual (`admin/incidents/route.ts` POST, nasce `open`), e os
updates de reabertura de `ingest.ts`/`failure-alert.ts`. **Regra nova do card
261b295b**: reabrir agora LIMPA `resolved_at`/`resolved_by` (o carimbo velho
mentiria pra próxima medição) — `closureFields()` devolve nulls pra status
não-terminal, e o reopen do `ingest.ts` espalha isso quando `reopened`.

## 2. A trava escolhida: TRIGGER no banco + helper único no app + ferramenta canônica

**Por que trigger** (`scripts/86_incidents_resolved_guard.sql`) e não default/CHECK:
default só age em INSERT e não depende do status (o caso dominante é UPDATE);
CHECK **recusaria** o write — todo "ignorar" da aba Falhas em produção daria 500
até o deploy. O trigger **preenche** em vez de recusar, pode ser aplicado antes
do deploy sem quebrar nada, e é o único que cobre o caminho 5 (ad-hoc), que é
justamente o que ninguém lembra. Detalhe de honestidade: o trigger só carimba na
**transição** pra fechado — update qualquer numa linha já-fechada-cega NÃO ganha
`now()`, porque isso seria inventar data de fechamento antigo.

⚠️ **DDL NÃO APLICADO** — regra dura 21 (migration precisa do aval do Johnny).
Pergunta binária pro Johnny: *aplicar `scripts/86_incidents_resolved_guard.sql`
no Supabase? (sim/não)*. Provado em Postgres real isolado (PGlite) enquanto isso.

Camada de app (autoria REAL em vez do marcador do trigger):
- `frontend/src/lib/incidents/closure.ts` — `closureFields()`, único lugar que
  decide os campos de fechamento; os caminhos 1–4 passaram a usá-lo
  (`ignored` agora grava autor+data; os nascidos-fechados gravam resolved_by).
- `_frank/ferramentas/fechar_incidente.cjs` — a forma canônica de fechar por
  script nas rondas (recusa sem `--por`/`--nota`, não reabre, dry-run por
  padrão, relê o banco depois de gravar e confere linhas afetadas). Substitui
  os updates hand-rolled do caminho 5.

## 3. Backfill dos fechados sem data (eram 5 na medição do vigia; encontrei 3)

Denominador primeiro: consulta ao vivo achou **3 de 63** fechados sem data — os
2 de hoje (`ef6e08a4`, `bea487b7`) **já tinham sido corrigidos às 20:31:59Z por
`resolved_by='claude'`** (conferido ao vivo; ninguém aqui tocou neles).

- `9b7cc261` → `resolved_at=2026-08-18T12:27:30.204Z`, `resolved_by='agent'`.
  **Fonte da evidência**: a própria agent_note de fechamento (by=agent), gravada
  54s após o created_at da linha, no ato da análise da resolution_note. Nota de
  auditoria adicionada na linha com a derivação. (Feito na v1; o v2 confere e
  não toca — evidência real vale mais que o critério genérico.)
- `72055f75` e `bee2fb8b` (21/07) → **v2, decisão do card 261b295b**: a v1 tinha
  deixado nulos ("data desconhecida"); o card mandou preencher com valor
  defensável e não-inventado — `resolved_at = max(last_seen_at, created_at)` da
  própria linha, `resolved_by='backfill'`. Racional: o fechamento não é anterior
  à última ocorrência NEM ao nascimento da linha; o maior dos dois é o limite
  inferior honesto. (O ensaio pegou a armadilha: nas duas linhas `last_seen_at`
  é de MAIO, anterior ao `created_at` de 21/07 — import histórico; `last_seen_at`
  puro diria que o incidente fechou antes de existir.) Tira os 2 da
  invisibilidade permanente do detector. Critério registrado em agent_note na
  própria linha. Script: `backfill_v2_last_seen.cjs`.

Prova v1: `backfill_saida.txt`. Prova v2: `backfill_v2_saida.txt` (releitura das
3 linhas após gravar, com contagem de linhas afetadas).

## 4. Outras cegueiras do MESMO tipo no detector de zumbi (reportadas, NÃO consertadas aqui)

1. **Fechado com `resolved_at` nulo continua invisível** — depois do backfill
   v2 não sobra nenhum caso conhecido, mas um escritor futuro fora do app (sem
   o trigger aplicado) pode recriar. Recomendação: o detector deve tratar
   `status IN (fixed,ignored) AND resolved_at IS NULL` como **"sempre
   suspeito"** (listar com alerta) em vez de pular em silêncio.
2. **`last_seen_at` é o outro campo de fé**: o detector lê
   `incidents.last_seen_at`, mas quem insere ocorrência em
   `incident_occurrences` sem dar bump na coluna esconde o refire. Os
   escritores atuais dão bump; um escritor futuro pode não dar. Checagem
   barata: comparar `max(incident_occurrences.at)` vs `last_seen_at`.
3. **`resolved_commit` quase nunca preenchido** (ex.: ef6e08a4 fechado hoje com
   commit nulo) — não cega o detector, mas impede correlacionar fechamento com
   deploy. Menor.

## 5. Prova de aceite (o que rodou e o resultado)

- **Harness Postgres isolado** (`harness_trigger.cjs`, PGlite, aplica a 47 + a
  86 byte a byte do arquivo): **11/11** — as 3 formas cegas de escrita dos
  caminhos 1, 2 e 5; os nascidos-fechados do 3/4 (preserva `resolved_at` do
  chamador, preenche resolved_by); nunca sobrescreve valor informado; reabrir
  LIMPA os campos (e preserva o que o chamador mandou explicitamente); bump em
  linha fechada-cega NÃO inventa data; re-fechar após reabrir carimba de novo.
  Saída: `harness_saida.txt`.
- **Testes do app**: `node --test src/lib/incidents/closure.test.ts` → **6/6**;
  regressão pré-existente `hotmart-payload.test.ts` → **8/8**. `tsc --noEmit`
  limpo, `eslint` limpo nos arquivos alterados.
- **Teste VIVO em produção da ferramenta canônica** (único caminho testável
  hoje sem o DDL): incidente de teste `d6b4154b` criado → fechado com
  `fechar_incidente.cjs` → releitura do banco:
  `resolved_at=2026-08-20T20:46:41.533Z resolved_by=frank` → **apagado** (1
  linha, 0 sobrando). A ferramenta também **recusou** tentativa de reabrir.
  Saída: `teste_vivo_ferramenta.txt`.
- Os caminhos 1–4 do app só valem em produção **depois do deploy** (main), e o
  trigger só depois do aval do Johnny — enquanto qualquer um dos dois não
  acontecer, fechamento cego AINDA é possível pelos caminhos antigos. Dito
  como é.
