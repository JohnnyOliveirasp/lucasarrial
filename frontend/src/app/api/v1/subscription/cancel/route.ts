/**
 * POST /api/v1/subscription/cancel
 *
 * Cancela a assinatura SEM burocracia. Sempre registra o motivo informado
 * (subscription_cancellations) — não bloqueia o cancelamento. Em seguida tenta
 * cancelar na Hotmart via API (se as credenciais estiverem configuradas).
 *
 * Body: { reason?: string, detail?: string }
 * Retorna: { status: "canceled" | "registered" }
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { cancelSubscription, isConfigured } from "@/lib/hotmart/subscription";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { reason?: string; detail?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* corpo opcional */
  }
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
  const detail = typeof body.detail === "string" ? body.detail.slice(0, 1000) : null;

  const admin = getAdmin();

  // 1. Registra o motivo SEMPRE (não trava o cancelamento).
  await admin
    .from("subscription_cancellations")
    .insert({ user_id: auth.user_id, reason, detail });

  // 2. Tenta cancelar na Hotmart (pelo código do assinante = entitlements.external_id).
  const { data: ent } = await admin
    .from("entitlements")
    .select("external_id")
    .eq("user_id", auth.user_id)
    .eq("provider", "hotmart")
    .eq("status", "active")
    .maybeSingle();

  if (ent?.external_id && isConfigured()) {
    try {
      await cancelSubscription(ent.external_id);
      return jsonOk({ status: "canceled" });
    } catch {
      // Falhou na API → o pedido fica registrado; o webhook de cancelamento
      // (SUBSCRIPTION_CANCELLATION) ainda revoga o acesso quando processar.
      return jsonOk({ status: "registered" });
    }
  }

  return jsonOk({ status: "registered" });
}
