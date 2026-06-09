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
import { sendEmail, escapeHtml } from "@/lib/email/resend";

/** E-mails de aviso de cancelamento (best-effort — nunca trava o fluxo). */
async function notifyCancellation(
  userEmail: string | null,
  userId: string,
  reason: string | null,
  detail: string | null,
): Promise<void> {
  try {
    // Confirmação pro usuário.
    if (userEmail) {
      await sendEmail({
        to: userEmail,
        subject: "Sua assinatura foi cancelada — AICloneVerse",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2>Assinatura cancelada</h2>
          <p>Recebemos o seu pedido de cancelamento. Seu acesso continua ativo até o
          fim do período já pago — depois disso ele não será renovado.</p>
          <p>Mudou de ideia? É só reativar a assinatura quando quiser.</p>
          <p style="color:#666;font-size:13px">Obrigado por usar a AICloneVerse.</p>
        </div>`,
      });
    }
    // Aviso pro time (com o motivo) — retenção/follow-up.
    const adminList = (
      process.env.CANCELLATION_NOTIFY_EMAIL ||
      process.env.ADMIN_EMAILS ||
      ""
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (adminList.length) {
      await sendEmail({
        to: adminList,
        subject: `Cancelamento de assinatura — ${userEmail ?? userId}`,
        html: `<div style="font-family:sans-serif;color:#111">
          <h3>Um usuário cancelou a assinatura</h3>
          <p><strong>Usuário:</strong> ${escapeHtml(userEmail ?? userId)}</p>
          <p><strong>Motivo:</strong> ${escapeHtml(reason ?? "(não informado)")}</p>
          <p><strong>Detalhe:</strong> ${escapeHtml(detail ?? "(vazio)")}</p>
        </div>`,
      });
    }
  } catch {
    /* e-mail é best-effort; ignora qualquer falha */
  }
}

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

  // 1b. Dispara os e-mails de aviso (best-effort; no-op se Resend não configurado).
  await notifyCancellation(auth.email, auth.user_id, reason, detail);

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
