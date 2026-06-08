/**
 * POST /api/v1/webhooks/hotmart
 *
 * Recebe as notificações de compra/assinatura da Hotmart (Webhook 2.0) e
 * libera/revoga acesso na nossa base. Esta é a URL que o produtor cadastra em
 * Ferramentas → Webhook (API e notificações).
 *
 * Segurança: valida o token `hottok` (header X-HOTMART-HOTTOK) contra
 * HOTMART_HOTTOK do ambiente, em tempo constante.
 *
 * Idempotência: a Hotmart reenvia o mesmo evento até 5×. Gravamos cada evento
 * em `payment_events` (UNIQUE provider+event_id); só processamos uma vez.
 * Se o processamento falhar, respondemos 500 (sem marcar processed_at) pra a
 * Hotmart reenviar e tentarmos de novo.
 *
 * Modelo do produto: assinatura recorrente mensal (R$ 97), 7 dias de garantia.
 * Payload 2.0: { id, creation_date, event, version, data }.
 */
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { jsonOk, jsonError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { grantAccess, revokeAccess } from "@/lib/payments/entitlements";
import {
  grantSubscriptionCredits,
  resolveUserIdByEmail,
} from "@/lib/credits/service";
import { PLAN_MONTHLY_CREDITS } from "@/lib/credits/config";
import type { EntitlementStatus, Json } from "@/lib/db/types";

const PROVIDER = "hotmart" as const;

type HotmartPayload = {
  id?: string;
  event?: string;
  version?: string;
  data?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  // 1. Autenticidade (hottok)
  const headerTok = request.headers.get("x-hotmart-hottok");
  let payload: HotmartPayload;
  try {
    payload = (await request.json()) as HotmartPayload;
  } catch {
    return jsonError("bad_request", "Invalid JSON", 400);
  }
  // o "Enviar teste" da Hotmart às vezes manda o hottok no corpo — aceitamos os dois.
  const bodyTok =
    typeof payload === "object" && payload && "hottok" in payload
      ? String((payload as Record<string, unknown>).hottok)
      : null;
  if (!validHottok(headerTok ?? bodyTok)) return unauthorized();

  const eventType = (payload.event ?? "UNKNOWN").toUpperCase();
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const buyerEmail = extractBuyerEmail(data);
  const eventId = payload.id ?? `${eventType}:${extractExternalId(data, eventType)}`;

  const admin = getAdmin();

  // 2. Idempotência — grava o evento (ignora se já existe) e checa se já processado
  await admin.from("payment_events").upsert(
    {
      provider: PROVIDER,
      event_id: eventId,
      event_type: eventType,
      buyer_email: buyerEmail,
      payload: payload as unknown as Json,
    },
    { onConflict: "provider,event_id", ignoreDuplicates: true },
  );
  const { data: evRow } = await admin
    .from("payment_events")
    .select("id, processed_at")
    .eq("provider", PROVIDER)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!evRow) return jsonError("server_error", "could not record event", 500);
  if (evRow.processed_at) return jsonOk({ handled: "duplicate" });

  // 3. Processa o evento
  try {
    const handled = await processEvent(eventType, data, buyerEmail);
    await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", evRow.id);
    return jsonOk({ handled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("payment_events")
      .update({ error: msg.slice(0, 500) })
      .eq("id", evRow.id);
    // 500 → Hotmart reenvia; processed_at segue NULL, reprocessamos no retry.
    return jsonError("processing_error", "failed to process event", 500);
  }
}

/** Mapeia o evento da Hotmart para liberar/revogar acesso. */
async function processEvent(
  eventType: string,
  data: Record<string, unknown>,
  buyerEmail: string | null,
): Promise<string> {
  const externalId = extractExternalId(data, eventType);
  const productCode = extractProductCode(data);

  // libera/renova
  // Na Hotmart fica SÓ a assinatura recorrente. Os créditos avulsos são vendidos
  // pelo Stripe (ver /api/v1/webhooks/stripe). Aqui, toda aprovação = assinatura.
  if (eventType === "PURCHASE_APPROVED" || eventType === "PURCHASE_COMPLETE") {
    if (!buyerEmail) throw new Error("missing buyer email on approval");

    // Assinatura: libera o acesso + recarrega o bolsão mensal (reset).
    await grantAccess({
      provider: PROVIDER,
      buyerEmail,
      externalId,
      productCode,
      offerCode: extractOfferCode(data),
      accessUntil: extractNextChargeIso(data), // recorrente: acesso até a próxima cobrança; NULL se único
      rawEvent: data,
    });
    const userId = await resolveUserIdByEmail(buyerEmail);
    if (userId) {
      await grantSubscriptionCredits({
        userId,
        amount: PLAN_MONTHLY_CREDITS,
        refType: "payment_event",
        refId: externalId,
      });
    }
    return "granted";
  }

  // revoga
  const revokeStatus = mapRevokeStatus(eventType);
  if (revokeStatus) {
    // cancelamento de assinatura mantém o acesso até o fim do período já pago
    const keepUntil =
      eventType === "SUBSCRIPTION_CANCELLATION"
        ? extractNextChargeIso(data)
        : null;
    await revokeAccess({
      provider: PROVIDER,
      externalId,
      status: revokeStatus,
      accessUntil: keepUntil,
      rawEvent: data,
    });
    return `revoked:${revokeStatus}`;
  }

  return "ignored";
}

function mapRevokeStatus(eventType: string): Exclude<EntitlementStatus, "active"> | null {
  if (eventType === "SUBSCRIPTION_CANCELLATION") return "canceled";
  if (eventType === "PURCHASE_REFUNDED") return "refunded";
  if (eventType.includes("CHARGEBACK") || eventType === "PURCHASE_PROTEST") return "chargeback";
  if (eventType === "PURCHASE_EXPIRED" || eventType === "PURCHASE_CANCELED") return "expired";
  return null;
}

// ── extração defensiva do payload 2.0 ───────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function extractBuyerEmail(data: Record<string, unknown>): string | null {
  const email = asRecord(data.buyer).email;
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

/** Assinatura usa o código do assinante (estável entre renovações); compra usa a transação. */
function extractExternalId(data: Record<string, unknown>, eventType: string): string {
  const sub = asRecord(data.subscription);
  const subCode =
    asRecord(sub.subscriber).code ?? sub.code ?? asRecord(asRecord(data.purchase).subscription).code;
  const transaction = asRecord(data.purchase).transaction;
  const id = subCode ?? transaction;
  if (typeof id === "string" && id) return id;
  return `${eventType}:unknown`;
}

function extractProductCode(data: Record<string, unknown>): string | null {
  const id = asRecord(data.product).id ?? asRecord(data.product).ucode;
  return id != null ? String(id) : null;
}

function extractOfferCode(data: Record<string, unknown>): string | null {
  const code = asRecord(asRecord(data.purchase).offer).code;
  return typeof code === "string" ? code : null;
}

/** date_next_charge vem em ms desde 1970 (UTC). Retorna ISO ou null. */
function extractNextChargeIso(data: Record<string, unknown>): string | null {
  const ms =
    asRecord(data.purchase).date_next_charge ?? asRecord(data.subscription).date_next_charge;
  if (typeof ms === "number" && ms > 0) return new Date(ms).toISOString();
  return null;
}

function validHottok(received: string | null): boolean {
  const expected = process.env.HOTMART_HOTTOK ?? "";
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
