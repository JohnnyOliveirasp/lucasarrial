/**
 * Extração defensiva do payload 2.0 da Hotmart ({ id, event, version, data }).
 *
 * Módulo PURO (sem imports de Next/DB) pra ser testável com `node --test`.
 * Usado pelo webhook /api/v1/webhooks/hotmart.
 *
 * ATENÇÃO: a POSIÇÃO do código do assinante muda conforme o evento:
 *  - PURCHASE_APPROVED / PURCHASE_COMPLETE → data.subscription.subscriber.code
 *  - SUBSCRIPTION_CANCELLATION             → data.subscriber.code
 *    (data.subscription vem SÓ com { id, plan } — sem subscriber, sem code).
 * Bug de 18/08/2026: sem o data.subscriber.code na cadeia, TODO cancelamento
 * caía no fallback "SUBSCRIPTION_CANCELLATION:unknown" e a revogação era um
 * no-op 100% silencioso (185 cancelamentos, zero entitlements 'canceled').
 */

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function extractBuyerEmail(data: Record<string, unknown>): string | null {
  const email = asRecord(data.buyer).email;
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

/** Status da transação (data.purchase.status), em maiúsculas; "" se ausente. */
export function extractPurchaseStatus(data: Record<string, unknown>): string {
  const s = asRecord(data.purchase).status;
  return typeof s === "string" ? s.toUpperCase() : "";
}

/**
 * Identificador do PAGAMENTO (uma cobrança específica), ao contrário do
 * externalId, que na assinatura é o código do assinante e não muda nunca.
 * É a chave de idempotência do crédito: um pagamento credita uma vez.
 * Sem transação no payload devolve null — aí o grant segue sem trava, que é o
 * comportamento antigo (melhor creditar do que deixar alguém sem o que pagou).
 */
export function extractTransactionId(data: Record<string, unknown>): string | null {
  const trx = asRecord(data.purchase).transaction;
  return typeof trx === "string" && trx ? trx : null;
}

/** Assinatura usa o código do assinante (estável entre renovações); compra usa a transação. */
export function extractExternalId(data: Record<string, unknown>, eventType: string): string {
  const sub = asRecord(data.subscription);
  const subCode =
    // SUBSCRIPTION_CANCELLATION: o código vem em data.subscriber.code (o
    // data.subscription desse evento NÃO traz subscriber). Nos eventos de
    // compra (PURCHASE_*) data.subscriber não existe → este termo dá
    // undefined e a cadeia segue idêntica ao comportamento anterior.
    asRecord(data.subscriber).code ??
    asRecord(sub.subscriber).code ??
    sub.code ??
    asRecord(asRecord(data.purchase).subscription).code;
  const transaction = asRecord(data.purchase).transaction;
  const id = subCode ?? transaction;
  if (typeof id === "string" && id) return id;
  return `${eventType}:unknown`;
}

/** true quando extractExternalId caiu no fallback (nenhum id real no payload). */
export function isUnknownExternalId(externalId: string, eventType: string): boolean {
  return externalId === `${eventType}:unknown`;
}

export function extractProductCode(data: Record<string, unknown>): string | null {
  const id = asRecord(data.product).id ?? asRecord(data.product).ucode;
  return id != null ? String(id) : null;
}

export function extractOfferCode(data: Record<string, unknown>): string | null {
  const code = asRecord(asRecord(data.purchase).offer).code;
  return typeof code === "string" ? code : null;
}

/**
 * date_next_charge → ISO (ou null).
 * POSIÇÃO: nos PURCHASE_* vem em data.purchase/data.subscription; no
 * SUBSCRIPTION_CANCELLATION vem DIRETO na raiz de data (payloads reais
 * conferidos em payment_events, 18/08/2026).
 * UNIDADE: os payloads reais misturam SEGUNDOS e MILISSEGUNDOS (ex.:
 * 1783598400 e 1783425600000, ambos jul/2026). Valor < 1e11 interpretado
 * como ms daria 1973 — logo é segundos e multiplicamos por 1000.
 */
export function extractNextChargeIso(data: Record<string, unknown>): string | null {
  const raw =
    asRecord(data.purchase).date_next_charge ??
    asRecord(data.subscription).date_next_charge ??
    data.date_next_charge;
  if (typeof raw !== "number" || raw <= 0) return null;
  return new Date(raw < 1e11 ? raw * 1000 : raw).toISOString();
}
