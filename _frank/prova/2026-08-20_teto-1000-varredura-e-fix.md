# Teto silencioso de 1000 do PostgREST — fix do orphan-outreach + varredura do repo

Incidente: `72a4c9db-5b55-4cd3-b569-aecb07228459` (orphan-outreach mandou "crie sua
conta" pra 105 clientes ATIVOS porque `profiles.select("email")` sem range devolve
no máximo 1000 linhas e a tabela tem 1294).

Data: 2026-08-20 (antes do cron `0 14 * * *` disparar de novo).
Autor: coder (Frank fleet), branch `feat/orphan-outreach-teto-1000`.

## 1. O fix (orphan-outreach.ts + route)

- `profiles`: em vez de puxar a tabela inteira, a guarda `hasAccount` agora consulta
  SÓ os e-mails dos compradores, `.in("email", chunk)` em blocos de 500 (URL não
  estoura). Premissa verificada em produção 20/08: os 1294 `profiles.email` são
  100% minúsculos (Supabase Auth normaliza), e as chaves de `buyers` já são
  minúsculas — o `.in()` case-sensitive bate. Comparação segue em lowercase.
- `payment_events` (MESMA função, mesmo bug, já estourado): 1099 linhas
  PURCHASE_APPROVED em 19/08 — sem range o código via só 1000 e compradores
  sumiam da varredura (direção: convite deixa de sair). Agora pagina com
  `.order("id").range(...)` até a página vir incompleta.
- Guarda que falha ABORTA a varredura (throw) em vez de seguir com Set
  incompleto — antes, um erro na query de profiles viraria Set VAZIO e todo
  mundo receberia convite. A rota devolve 500 `sweep_failed` logado.

## 2. Prova do fix (réplica read-only da lógica nova contra produção, 20/08)

Nenhum e-mail enviado no teste; só as consultas de seleção/guarda.

```
payment_events paginado: 1099 (antes do fix o codigo via so 1000)
buyers unicos: 762
lucvila@gmail.com              velha: ORFAO(ERRADO) | nova: tem conta
lkolle@gmail.com               velha: ORFAO(ERRADO) | nova: tem conta
katiasalvador32@gmail.com      velha: ORFAO(ERRADO) | nova: tem conta
jolenesaraiva@gmail.com        velha: ORFAO(ERRADO) | nova: tem conta
chaplainfabio@gmail.com        velha: ORFAO(ERRADO) | nova: tem conta
paraguassutans@gmail.com       velha: ORFAO(ERRADO) | nova: tem conta
orfaos LOGICA VELHA: 203 | LOGICA NOVA: 52 | falsos positivos eliminados: 151
casos nova=orfao & velha=tem-conta (deve ser 0): 0
```

Ou seja: as 6 vítimas provadas do incidente voltam a ser reconhecidas como
clientes; 151 falsos positivos morrem; ZERO caso na direção inversa (o fix não
cria falso negativo). Os 52 órfãos restantes são órfãos de verdade e o dedupe
em `agent_state/orphan_invites` impede reenvio a quem já recebeu.

`tsc --noEmit` exit 0 e `eslint` exit 0, rodados em worktree isolado com
`NODE_ENV=development npm ci` do zero (tsc 5.9.3 / eslint 9.39.4 confirmados
instalados).

## 3. Varredura do repo — mesmo padrão em outros lugares (Tarefa 2)

Método: agente de busca varreu `frontend/src` atrás de `.from(X).select(...)`
sem `.range()`/`.limit()` alimentando Set/Map/loop de decisão; EU conferi cada
achado crítico no código e medi as tabelas em produção (contagens de 20/08).
NÃO consertei nada abaixo — só listo, por severidade real (medida, não chutada).

### JÁ TRUNCANDO HOJE (agir logo)

| Onde | Query | Tabela hoje | Consequência |
|---|---|---|---|
| `lib/admin/churn.ts:53` | `payment_events .eq(PURCHASE_APPROVED)` sem range | **1099 > 1000** | Sets `paid`/`freeOnly` que classificam churn por tier já estão cegos pra ~99 compras; churn pago×trial sai ERRADO no admin HOJE. Métrica, não ação contra cliente. |

### VAI ESTOURAR COM O CRESCIMENTO (bomba-relógio; consertar no mesmo padrão)

| Onde | Query | Tabela hoje | Consequência quando passar de 1000 |
|---|---|---|---|
| `lib/admin/churn.ts:49-52` | `payment_events .eq(SUBSCRIPTION_CANCELLATION)` sem range | 198 | Cancelamentos somem; churn subestimado. |
| `lib/admin/churn.ts:54-57` | `subscription_cancellations` sem range | 175 | Motivos de cancelamento somem do painel. |
| `lib/admin/churn.ts:69` | `profiles .in("id", surveyUserIds)` | ids ≤ 175 | Só estoura se surveyUserIds > ~1000; herdará o fix do de cima. |
| `lib/admin/totals.ts:77` | `runpod_spend_log .select("balance_usd")` sem range | 622 | Leituras de saldo somem → custo GPU subavaliado → lucro acumulado INFLADO no /admin. Cresce ~1/dia+, estoura em ~1 ano ou menos. |
| `lib/admin/queries.ts:130-134` | `runpod_spend_log` por período | 622 | Igual acima, para períodos longos. |
| `lib/courtesy/service.ts:45-48` | `courtesy_grants` / `courtesy_campaigns` sem range | 1 / 1 | Painel de cortesia incompleto se campanha grande. |
| `lib/incidents/ingest.ts:40-43` | `incident_occurrences .in("ref_id", ...)` | 163 | Dedupe do Sentinela falha → mesma falha recontada. Escopo já limitado pelos ref_ids da RPC. |

### BAIXA (tabela pequena por natureza)

- `orphan-outreach.ts` `admin_emails` (2 usos): 4 linhas, nunca chega perto do teto.

### Correção da varredura do agente

O agente apontou `totals.ts:65-68` (firstReadAt) como risco — **falso**: essa
query tem `.limit(1)` com order ascending, está correta. Conferido por mim.

### Regra geral que sai disso

Qualquer `.select()` do Supabase sem `.range()`/`.limit()`/filtro-de-linha-única
que alimente guarda ou agregação é bug latente: o corte em 1000 é SILENCIOSO
(sem erro, sem aviso). Padrão de conserto: (a) se dá pra filtrar pelo conjunto
que interessa, `.in()` em blocos; (b) senão, paginar com ordem estável até a
página vir incompleta; (c) guarda que falha aborta, nunca degrada pra Set vazio.
