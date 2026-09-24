# PATCH PROPOSTO — NÃO APLICADO (aguarda Johnny)
Card 9003fa4f · access_until NULL/divergente com pagamento APPROVED

## FIX 1 — `extractNextChargeIso` aceita número EM TEXTO
Arquivo: frontend/src/lib/payments/hotmart-payload.ts

Hoje (linha ~163):
```ts
if (typeof raw !== "number" || raw <= 0) return null;
return new Date(raw < 1e11 ? raw * 1000 : raw).toISOString();
```
Problema: `extractPurchaseValue` já aceita número em texto ("97"), este NÃO.
Se a Hotmart mandar `date_next_charge: "1792756800000"`, isto devolve null —
e null, num entitlement `active`, significa VITALÍCIO (acesso de graça pra
sempre). Falha de extração vira concessão, em silêncio.

Proposto:
```ts
export function extractNextChargeIso(data: Record<string, unknown>): string | null {
  const raw =
    asRecord(data.purchase).date_next_charge ??
    asRecord(data.subscription).date_next_charge ??
    data.date_next_charge;
  let n: number | null = null;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string" && raw.trim()) {
    const p = Number(raw);
    if (Number.isFinite(p)) n = p;
  }
  if (n === null || !Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e11 ? n * 1000 : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();  // data ilegível NUNCA vira vitalício
}
```

## FIX 2 — assinatura SEM data de renovação é ANOMALIA, não vitalício
Arquivo: frontend/src/app/api/v1/webhooks/hotmart/route.ts (~linha 230)

Hoje o handler faz `accessUntil: extractNextChargeIso(data)` e segue. Se o
payload TEM `data.subscription` (logo é recorrente) e a data não saiu, gravar
NULL entrega acesso vitalício a um assinante mensal — e ninguém fica sabendo.

Proposto: detectar e REGISTRAR em vez de engolir.
```ts
const ehAssinatura = Object.keys(asRecord(data.subscription)).length > 0;
const proxima = extractNextChargeIso(data);
let anomaliaData: string | null = null;
if (ehAssinatura && proxima === null) {
  anomaliaData =
    `assinatura sem date_next_charge no payload — access_until ficaria NULL ` +
    `(=vitalício) [${externalId}] buyer: ${buyerEmail}`;
}
await grantAccess({ ..., accessUntil: proxima, ... });
```
e somar `anomaliaData` ao `processError` devolvido (o evento fica processado,
mas o erro aparece em `payment_events.error` — mesmo padrão já usado pra
compra órfã). Sem isto, o caso é invisível até virar prejuízo.

## FIX 3 — a ferramenta de ronda ignora `access_source` (falso positivo)
Arquivo: _frank/ferramentas/pagante_trancado.cjs

Hoje:
```js
.select("id,email,access_until,credits_subscription,credits_extra")
...
return saldo > 0 && (!p.access_until || new Date(p.access_until) <= agora);
```
`!p.access_until` trata NULL como "sem acesso". Mas a regra REAL da casa
(frontend/src/lib/credits/access-window.ts) diz: NULL + `access_source`
preenchido = VITALÍCIO, TEM acesso. A ferramenta não lê `access_source`, então
não consegue distinguir — e é isso que produz "vencido há Infinityd"
(`Infinity` vem do próprio ternário `: Infinity` quando access_until é falsy).

Proposto: incluir `access_source` no select e usar a regra do gate:
```js
.select("id,email,access_until,access_source,credits_subscription,credits_extra")
...
const janelaAberta = p.access_until
  ? new Date(p.access_until).getTime() > agora.getTime()
  : !!(p.access_source && String(p.access_source).trim());
return saldo > 0 && !janelaAberta;
```

## FIX 4 — GUARD novo (read-only): cache x entitlement
Arquivo novo proposto: _frank/ferramentas/cache_de_acesso_divergente.cjs
(pronto em /tmp/audit2.cjs — só leitura, não escreve nada)

Alarma em três estados que hoje ninguém mede:
- CACHE CURTO: profile.access_until < entitlement.access_until -> o pagante vai
  ser trancado ANTES do fim do que pagou. (hoje: 1 — aprocamgerencia)
- VITALÍCIO ILEGÍTIMO: entitlement `active` + access_until NULL cujo
  product_code é CURSO -> plataforma paga de graça pra sempre.
  (hoje: 1 — drfabiovilhena29, produto 7283335)
- CACHE LONGO: profile dá mais acesso que o entitlement. (hoje: 0)
