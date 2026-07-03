/**
 * Alerta o SUPORTE por e-mail quando o provedor de vídeo (Kie) recusa geração
 * por falta de saldo/limite. Throttle via RPC `claim_alert` (1 e-mail por
 * janela de cooldown, não 1 por cena). Best-effort — nunca lança. Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendEmail, escapeHtml } from "@/lib/email/resend";

const COOLDOWN_SECONDS = 60 * 60; // no máx. 1 alerta por hora

function supportRecipients(): string[] {
  return (process.env.SUPPORT_NOTIFY_EMAIL || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Avisa o suporte que o Kie está sem créditos (throttled). */
export async function notifyKieOutOfCredits(args: {
  userEmail?: string | null;
  projectId: string;
  failedCount: number;
}): Promise<void> {
  try {
    const { data } = await getAdmin().rpc("claim_alert", {
      p_key: "kie_video_credits",
      p_cooldown_seconds: COOLDOWN_SECONDS,
    });
    if (data !== true) return; // ainda no cooldown

    const to = supportRecipients();
    if (!to.length) return;

    await sendEmail({
      to,
      subject: "⚠️ Kie sem créditos — geração de vídeo travada",
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h3>Geração de vídeo bloqueada por falta de saldo no Kie</h3>
        <p>O provedor de vídeo (<strong>Kie.ai</strong>) recusou a criação de clipes por
        <strong>créditos insuficientes</strong> (HTTP 402). Os usuários estão vendo
        "serviço de vídeo indisponível".</p>
        <p><strong>Ação:</strong> recarregar a conta do Kie. Assim que houver saldo, os
        usuários conseguem clicar em <em>Regerar</em> e a geração volta a funcionar.</p>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#666;font-size:13px">
          Último gatilho — projeto: ${escapeHtml(args.projectId)}<br/>
          Usuário afetado: ${escapeHtml(args.userEmail ?? "—")}<br/>
          Cenas que falharam nesta tentativa: ${args.failedCount}<br/>
          (Este alerta é limitado a 1 por hora.)
        </p>
      </div>`,
    });
  } catch {
    // best-effort
  }
}
