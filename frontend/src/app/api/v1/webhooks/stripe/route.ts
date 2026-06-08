/**
 * POST /api/v1/webhooks/stripe
 *
 * Recebe os eventos do Stripe (créditos avulsos). Valida a assinatura
 * (Stripe-Signature), e em `checkout.session.completed` paga → credita os
 * créditos avulsos ao usuário (metadata.user_id + metadata.credits).
 *
 * Idempotente via payment_events (provider='stripe', event_id). Em falha de
 * processamento responde 500 (sem marcar processed) p/ o Stripe reenviar.
 *
 * Env: STRIPE_WEBHOOK_SECRET (whsec_...).
 */
import type { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { verifyStripeSignature } from "@/lib/stripe/client";
import { addExtraCredits } from "@/lib/credits/service";
import type { Json } from "@/lib/db/types";

const PROVIDER = "stripe" as const;

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

export async function POST(request: NextRequest) {
  // 1. Assinatura — precisa do corpo CRU (não parseado).
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
    return jsonError("unauthorized", "invalid signature", 401);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return jsonError("bad_request", "invalid json", 400);
  }
  if (!event.id || !event.type) return jsonError("bad_request", "missing id/type", 400);

  const admin = getAdmin();

  // 2. Idempotência
  await admin.from("payment_events").upsert(
    {
      provider: PROVIDER,
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Json,
    },
    { onConflict: "provider,event_id", ignoreDuplicates: true },
  );
  const { data: evRow } = await admin
    .from("payment_events")
    .select("id, processed_at")
    .eq("provider", PROVIDER)
    .eq("event_id", event.id)
    .maybeSingle();
  if (!evRow) return jsonError("server_error", "could not record event", 500);
  if (evRow.processed_at) return jsonOk({ handled: "duplicate" });

  // 3. Processa
  try {
    let handled = "ignored";
    if (event.type === "checkout.session.completed") {
      const session = (event.data?.object ?? {}) as Record<string, unknown>;
      const metadata = (session.metadata ?? {}) as Record<string, string>;
      const userId = metadata.user_id;
      const credits = Number(metadata.credits);
      const paid = session.payment_status === "paid";

      if (paid && userId && Number.isFinite(credits) && credits > 0) {
        await addExtraCredits({
          userId,
          amount: credits,
          refType: "stripe_session",
          refId: String(session.id ?? event.id),
        });
        handled = `credited:${credits}`;
      } else {
        handled = "skipped";
      }
    }

    await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", evRow.id);
    return jsonOk({ handled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("payment_events").update({ error: msg.slice(0, 500) }).eq("id", evRow.id);
    return jsonError("processing_error", "failed to process event", 500);
  }
}
