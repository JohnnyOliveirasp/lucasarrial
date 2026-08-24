# Cancelamentos de 23/08/2026 — apuração

Somente leitura. **Nenhum saldo foi alterado por esta apuração** (regra 9-A:
detector propõe, quem executa é passo separado e aprovado).

Reproduzir:

```bash
node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-08-23
node _Bugs/2026-08-24_cancelamentos/vazamento_trial.cjs
```

## Quem saiu

Janela UTC `2026-08-23T00:00Z → 2026-08-24T00:00Z`. 6 eventos
`SUBSCRIPTION_CANCELLATION` → **6 pessoas** (agrupado por e-mail, nunca por
assinatura). Classificação feita **na Hotmart viva**, não no nosso banco:
`GET /subscriptions/{code}/purchases` (array puro).

| e-mail | tipo | adesão → cancelou | dias | mensalidade | extra |
|---|---|---|---|---|---|
| alana.rossi@gmail.com | **ASSINANTE** | 29/07 → 23/08 | 25 | 100.000 | 0 |
| dirceu.walber64@gmail.com | trial | 17/08 → 23/08 | 6 | 33.152 | 2.000 |
| contatoperuchi@gmail.com | trial | 19/08 → 23/08 | 4 | 82.150 | 525 |
| correspondentes.pi@gmail.com | trial | 20/08 → 23/08 | 3 | 10.559 | 0 |
| natanaelp.filho@gmail.com | trial | 22/08 → 23/08 | 1 | 74.238 | 0 |
| lpsublimados@gmail.com | trial | 23/08 → 23/08 | 0 | 52.908 | 0 |

**Armadilha da pessoa vs. assinatura: conferida e negativa.** Consultei
`GET /subscriptions?subscriber_email=` para os 6, um a um. Todos HTTP 200 com
corpo real, **1 assinatura cada, todas `CANCELLED_*`**. Ninguém tem outra
assinatura viva — logo ninguém está sendo tratado como saída indevidamente.

### A única pagante: alana.rossi

Cobranças na Hotmart: rec#1 R$ 0 `COMPLETE` (29/07, trial) e **rec#2 R$ 97
`COMPLETE` (05/08)**. Pagou de verdade — vale nos dois filtros (valor > 0 e
status de pagamento).

Regra 9 diz **MANTÉM o crédito**, e mantém mesmo: `credits_subscription` =
100.000, intacto, **nenhum lançamento de zeramento** em
`credit_transactions`. Marcador `trial_credit_expirations` = `paid`, ou seja,
ela está fora da varredura de trial pra sempre. `access_until` = 29/08 12:00,
que bate **exatamente** com o `date_next_charge` da Hotmart
(`1788004800000`) — é o fim do ciclo que ela pagou, não corte antecipado.
Conferido e correto.

> Detalhe sem impacto, registrado: ela tem 3 lançamentos
> `subscription_grant` (29/07, 05/08, 06/08) para 2 cobranças. O de 06/08 é o
> par `PURCHASE_APPROVED`/`PURCHASE_COMPLETE` do mesmo pagamento. Como o grant
> **substitui** o saldo em vez de somar (saldo final = 100.000, exatamente o
> teto do plano), não houve crédito a mais. Não é vazamento.

## 🔴 O que está fora da regra

**A varredura `expire_trial_credits` está DESATIVADA desde 18/08.** Não é
suposição: li o corpo vivo da função no banco (`pg_get_functiondef`) e ela é
um stub que só devolve erro.

```
CREATE OR REPLACE FUNCTION public.expire_trial_credits(p_grace_days integer DEFAULT 10)
  -- DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas
  -- que PAGARAM (conferido na Hotmart, 6 de 6 na amostra). A deteccao de "pagou"
  -- dentro da funcao esta errada. Enquanto nao for corrigida e reprovada, ela
  -- NAO mexe em saldo - devolve erro alto para aparecer no log do sweep.
  return jsonb_build_object('ok', false, 'error', 'DESATIVADA MANUALMENTE 18/08: ...');
```

Confirmação independente: `trial_credit_expirations` com `debited > 0` tem
**0 linhas**. A função foi desligada por um bom motivo (regra 9-A), e
**continua certo mantê-la desligada** até a detecção de pagante ser corrigida
e reprovada. O problema não é ela estar off; é ninguém estar contando o preço
disso.

### Consequência para os 5 trials de ontem

O dia 10 de cada um ainda **não chegou** (27/08, 29/08, 30/08, 01/09, 02/09).
Então, hoje, nenhum deles está atrasado. Mas quando o dia 10 chegar, **não vai
acontecer nada**, porque a varredura que deveria agir está off. São
**253.007 créditos** de mensalidade que a regra manda expirar e não vão
expirar sozinhos.

`credits_extra` (2.000 do dirceu, 525 do contatoperuchi) **não é tocado por
nenhuma dessas regras** — é dele e continua sendo, corretamente.

### Consequência acumulada (o número que importa)

Quem cancelou, **nunca pagou** e ainda está com crédito de mensalidade:

```
FRACO: 44 pessoas, 3.384.474 cr
FORTE: 44 pessoas, 3.384.474 cr
os dois filtros concordam
```

Rodei os dois filtros de propósito — foi ler **valor** e ignorar **status**
que causou o incidente de 18/08. Aqui eles dão o mesmo conjunto, então a
classificação não reproduz aquele bug. Também confirmei que os campos usados
existem em 100% dos eventos (1.266 `PURCHASE_APPROVED` + 945
`PURCHASE_COMPLETE`, zero nulo em `buyer.email`, `price.value` e
`purchase.status`) — a contagem não está mentindo por campo ausente.

Controle negativo: **alana.rossi não aparece nessa lista** (ela pagou), e os
5 trials de ontem aparecem. É o comportamento esperado.

**Não existe incidente aberto rastreando isso** — conferido em `incidents`
(3 `open`, 9 `investigating`, nenhum sobre trial/varredura/zeramento).

## O que eu NÃO fiz, de propósito

Não zerei o crédito de ninguém e não reativei a função. Regra 9-A e 9-B:
retirar crédito é **sempre** decisão do Johnny, em qualquer valor. A lista dos
44 é um **detector**, não uma ordem de execução — e reativar a função sem
corrigir a detecção de pagante é literalmente repetir 18/08.

Decisão que precisa do Johnny: consertar a detecção de pagante dentro da
`expire_trial_credits` e reprovar com dry-run seco, ou aceitar
conscientemente o vazamento e escrever isso como política.

---

## O código que produziu cada número

`_Bugs/` é gitignorado (mesma situação do relatório de churn de 18/08), então o
script vai colado aqui inteiro pra poder ser auditado sem re-executar nada. A
cópia executável fica em `_Bugs/2026-08-24_cancelamentos/vazamento_trial.cjs`.

```js
/**
 * SOMENTE LEITURA. Nao toca em saldo, nao aplica DDL.
 *
 * Mede o vazamento aberto pela `expire_trial_credits` estar DESATIVADA desde
 * 18/08: quem cancelou, NUNCA pagou, e continua com credito de mensalidade.
 *
 * Roda os dois filtros de pagamento lado a lado, porque foi exatamente ler
 * "valor" e ignorar "status" que zerou 14 pagantes em 18/08 (regra 9-A):
 *   FRACO = price.value > 0
 *   FORTE = price.value > 0 E purchase.status IN (APPROVED, COMPLETE, COMPLETED)
 * Se os dois divergirem, a classificacao NAO e confiavel e nada deve ser feito
 * com esta lista ate a divergencia ser explicada.
 *
 * ⚠️ Esta lista e um DETECTOR, nao uma ordem de execucao. Regra 9-A: detector
 * propoe, quem executa e passo separado sobre lista ja aprovada pelo Johnny.
 *
 *   node _Bugs/2026-08-24_cancelamentos/vazamento_trial.cjs
 */
const fs = require("node:fs"), path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
for (const l of fs.readFileSync(path.join(RAIZ, "frontend", ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["'\r]$/g, "");
}
const TOK = process.env.SUPABASE_ACCESS_TOKEN;
const REF = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\./)?.[1];

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await r.text();
  // zero de um endpoint nao e prova: erro nunca vira "nao tem ninguem"
  if (r.status !== 200 && r.status !== 201) throw new Error(`HTTP ${r.status}: ${body.slice(0, 300)}`);
  try { return JSON.parse(body); } catch { throw new Error(`nao parseou: ${body.slice(0, 300)}`); }
}

const CANCEL = `select distinct lower(payload->'data'->'subscriber'->>'email') email
  from payment_events where event_type='SUBSCRIPTION_CANCELLATION'`;
const FRACO = `select distinct lower(payload->'data'->'buyer'->>'email') email
  from payment_events where event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
    and coalesce((payload->'data'->'purchase'->'price'->>'value')::numeric,0) > 0`;
const FORTE = FRACO + ` and payload->'data'->'purchase'->>'status' in ('APPROVED','COMPLETE','COMPLETED')`;

const alvo = (pagou) => `with cancel as (${CANCEL}), pagou as (${pagou})
  select lower(p.email) email, p.credits_subscription sub, p.credits_extra extra, p.access_until::date acesso
  from profiles p
  join cancel c on lower(p.email) = c.email
  left join pagou pg on lower(p.email) = pg.email
  where pg.email is null and coalesce(p.credits_subscription,0) > 0
  order by p.credits_subscription desc`;

(async () => {
  // 1) a funcao esta viva ou e stub? o relatorio inteiro depende disto.
  const [f] = await q(`select pg_get_functiondef(oid) as def from pg_proc where proname='expire_trial_credits'`);
  if (!f) { console.log("⚠️  expire_trial_credits NAO EXISTE no banco."); return; }
  const mexe = /\b(debit_credits|update\s+profiles|insert\s+into\s+credit_transactions)\b/i.test(f.def);
  console.log(`expire_trial_credits: ${mexe ? "ATIVA (mexe em saldo)" : "DESATIVADA (stub, so devolve erro)"}`);

  // 2) os caminhos do payload existem? (se algum vier nulo, a contagem mente)
  const cam = await q(`select event_type, count(*)::int total,
      count(payload->'data'->'buyer'->>'email')::int com_buyer,
      count(payload->'data'->'purchase'->'price'->>'value')::int com_valor,
      count(payload->'data'->'purchase'->>'status')::int com_status
    from payment_events where event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE') group by event_type`);
  console.log("\ncobertura dos campos usados (total tem que bater com os tres):");
  for (const c of cam) console.log(`  ${c.event_type.padEnd(18)} total=${c.total} buyer=${c.com_buyer} valor=${c.com_valor} status=${c.com_status}`);
  const furo = cam.find((c) => c.total !== c.com_buyer || c.total !== c.com_valor || c.total !== c.com_status);
  if (furo) console.log(`  ⚠️  ${furo.event_type} tem evento sem os campos — a classificacao NAO e confiavel.`);

  // 3) FRACO vs FORTE
  const fraco = await q(alvo(FRACO)), forte = await q(alvo(FORTE));
  const soma = (a) => a.reduce((s, x) => s + Number(x.sub), 0);
  console.log(`\nFRACO: ${fraco.length} pessoas, ${soma(fraco).toLocaleString("pt-BR")} cr`);
  console.log(`FORTE: ${forte.length} pessoas, ${soma(forte).toLocaleString("pt-BR")} cr`);
  if (fraco.length !== forte.length || soma(fraco) !== soma(forte)) {
    console.log("⚠️  OS DOIS FILTROS DIVERGEM — nao use esta lista pra nada ate explicar a diferenca.");
    const so = fraco.filter((x) => !forte.some((y) => y.email === x.email));
    console.log("   so no FRACO:", so.map((x) => x.email).join(", "));
    return;
  }
  console.log("os dois filtros concordam — a classificacao reproduz o mesmo conjunto.\n");
  for (const x of forte) {
    console.log(`  ${x.email.padEnd(40)} sub=${String(x.sub).padStart(7)} extra=${String(x.extra).padStart(6)} acesso_ate=${x.acesso ?? "-"}`);
  }
})().catch((e) => { console.error("FALHOU (isto NAO e 'ninguem vazando'):", e.message); process.exit(1); });
```

### Saída literal da execução em 24/08

```
expire_trial_credits: DESATIVADA (stub, so devolve erro)

cobertura dos campos usados (total tem que bater com os tres):
  PURCHASE_APPROVED  total=1266 buyer=1266 valor=1266 status=1266
  PURCHASE_COMPLETE  total=945 buyer=945 valor=945 status=945

FRACO: 44 pessoas, 3.384.474 cr
FORTE: 44 pessoas, 3.384.474 cr
os dois filtros concordam — a classificacao reproduz o mesmo conjunto.
```

O relatório por pessoa dos cancelamentos sai de
`_frank/ferramentas/cancelamentos_ontem.cjs` (já versionado), que faz a
classificação contra a Hotmart viva e imprime o corpo cru quando a consulta
falha — zero nunca vira "ninguém cancelou".
