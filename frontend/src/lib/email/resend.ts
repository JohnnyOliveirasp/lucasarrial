/**
 * Envio de e-mail transacional via Resend (REST, sem SDK — padrão do projeto,
 * igual Stripe/RunPod/Anthropic). Usado só no servidor.
 *
 * Envs:
 *  - RESEND_API_KEY   (re_...)  — sem ela, o envio é um no-op gracioso.
 *  - RESEND_FROM_EMAIL          — remetente verificado (ex.: "AICloneVerse <no-reply@seudominio>").
 *
 * Best-effort: nunca lança. Retorna true/false só pra log; o chamador não deve
 * travar o fluxo do usuário por causa de e-mail.
 */
const RESEND_API = "https://api.resend.com/emails";

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/** Escapa texto livre antes de injetar no HTML de um e-mail. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false; // não configurado → no-op

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
