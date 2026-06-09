/**
 * POST /api/v1/account/delete
 *
 * EXCLUSÃO DE CONTA — ação IRREVERSÍVEL. Diferente de cancelar assinatura:
 * aqui a conta inteira some. Em ordem:
 *   1. Valida o e-mail digitado (trava de segurança, igual ao digite-o-nome).
 *   2. Registra o motivo (sobrevive anonimizado em subscription_cancellations).
 *   3. Cancela a assinatura na Hotmart (best-effort) — não pode ficar cobrando.
 *   4. Limpa o R2 (não cascateia): áudios gerados + todos os arquivos de voz.
 *   5. Dispara e-mails de aviso (best-effort).
 *   6. Deleta o usuário no Supabase Auth → FK cascade apaga profiles, voices,
 *      generations, training_jobs, api_keys, user_consents, credit_transactions.
 *
 * Body: { reason?: string, detail?: string, email: string }
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS } from "@/lib/r2/client";
import { deleteByPrefix, deleteKeys } from "@/lib/r2/delete";
import { cancelSubscription, isConfigured } from "@/lib/hotmart/subscription";
import { sendEmail, escapeHtml } from "@/lib/email/resend";

async function notifyDeletion(
  userEmail: string | null,
  userId: string,
  reason: string | null,
  detail: string | null,
): Promise<void> {
  try {
    if (userEmail) {
      await sendEmail({
        to: userEmail,
        subject: "Sua conta foi excluída — AICloneVerse",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2>Conta excluída</h2>
          <p>Confirmamos a exclusão da sua conta na AICloneVerse. Todos os seus
          áudios foram apagados e a assinatura foi cancelada.</p>
          <p>Se quiser voltar no futuro, será preciso criar uma nova conta.</p>
          <p style="color:#666;font-size:13px">Obrigado por ter usado a plataforma.</p>
        </div>`,
      });
    }
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
        subject: `Exclusão de conta — ${userEmail ?? userId}`,
        html: `<div style="font-family:sans-serif;color:#111">
          <h3>Um usuário excluiu a conta</h3>
          <p><strong>Usuário:</strong> ${escapeHtml(userEmail ?? userId)}</p>
          <p><strong>Motivo:</strong> ${escapeHtml(reason ?? "(não informado)")}</p>
          <p><strong>Detalhe:</strong> ${escapeHtml(detail ?? "(vazio)")}</p>
        </div>`,
      });
    }
  } catch {
    /* best-effort */
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { reason?: string; detail?: string; email?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* corpo obrigatório validado abaixo */
  }
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
  const detail = typeof body.detail === "string" ? body.detail.slice(0, 1000) : null;

  // Trava de segurança: precisa digitar o e-mail EXATO da conta.
  const accountEmail = (auth.email ?? "").trim().toLowerCase();
  const typed = (body.email ?? "").trim().toLowerCase();
  if (!accountEmail || typed !== accountEmail) {
    return badRequest("Confirmação inválida — digite o e-mail exato da sua conta.");
  }

  const admin = getAdmin();

  // 1. Registra o motivo (user_id vira NULL no cascade, mas o registro fica).
  await admin.from("subscription_cancellations").insert({
    user_id: auth.user_id,
    reason,
    detail: detail ? `[exclusão de conta] ${detail}` : "[exclusão de conta]",
  });

  // 2. Cancela a assinatura na Hotmart (best-effort) antes de apagar tudo.
  try {
    const { data: ent } = await admin
      .from("entitlements")
      .select("external_id")
      .eq("user_id", auth.user_id)
      .eq("provider", "hotmart")
      .eq("status", "active")
      .maybeSingle();
    if (ent?.external_id && isConfigured()) {
      await cancelSubscription(ent.external_id).catch(() => {});
    }
  } catch {
    /* best-effort — não trava a exclusão */
  }

  // 3. Limpa o R2 (NÃO cascateia): áudios gerados + arquivos de voz do usuário.
  try {
    const { data: gens } = await admin
      .from("generations")
      .select("audio_path")
      .eq("user_id", auth.user_id);
    const genKeys = (gens ?? [])
      .map((g) => (g as { audio_path: string | null }).audio_path)
      .filter((k): k is string => !!k);
    if (genKeys.length) await deleteKeys(R2_BUCKETS.generations, genKeys);
    await deleteByPrefix(R2_BUCKETS.voices, `${auth.user_id}/`);
  } catch (e) {
    return serverError(e instanceof Error ? `R2 cleanup: ${e.message}` : "R2 cleanup failed");
  }

  // 4. E-mails de aviso ANTES de apagar (ainda temos o e-mail).
  await notifyDeletion(auth.email, auth.user_id, reason, detail);

  // 5. Deleta o usuário no Auth → FK cascade apaga o resto no banco.
  const { error: delErr } = await admin.auth.admin.deleteUser(auth.user_id);
  if (delErr) return serverError("Falha ao excluir a conta");

  return jsonOk({ deleted: true });
}
