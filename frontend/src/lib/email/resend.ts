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
 *
 * ⚠️ POR QUE AS TRÊS SAÍDAS LOGAM (incidente #305/e8885d03, medido 16/09). Este
 * é o único transporte dos avisos INTERNOS da casa (13 chamadores; e-mail de
 * aluno anda por SMTP, `sendSupportMail`). No `orphan_alerts` de produção, 19 de
 * 19 avisos de compra órfã saíram sem "email": a chamada aconteceu 19 vezes e
 * devolveu `false` 19 vezes, e NENHUMA das três saídas daqui escrevia uma linha
 * — então não havia como distinguir "env ausente" de "403 de domínio" de
 * "exceção de rede", e a medição ficou ininvestigável para trás. É o mesmo
 * defeito do #239 (descartar o boolean e engolir exceção), que foi consertado no
 * CHAMADOR e não aqui, no ponto por onde todos passam. O log não conserta a
 * entrega: conserta o fato de ninguém saber por que ela não aconteceu.
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

/** Quantos destinatários, sem despejar endereço de ninguém no log. */
function quantosDestinos(to: string | string[]): number {
  return Array.isArray(to) ? to.length : 1;
}

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    // Silêncio aqui é indistinguível de sucesso pra quem lê só o boolean.
    console.warn(
      `[resend] envio IGNORADO: falta ${!apiKey ? "RESEND_API_KEY" : ""}${!apiKey && !from ? " e " : ""}${!from ? "RESEND_FROM_EMAIL" : ""} — assunto="${subject.slice(0, 120)}" destinos=${quantosDestinos(to)}`,
    );
    return false; // não configurado → no-op
  }

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
    if (!res.ok) {
      // Status + corpo: é o que separa 403 de domínio não verificado de 422 de
      // destinatário inválido (um endereço podre na lista reprova o lote todo).
      const corpo = await res.text().catch(() => "");
      console.warn(
        `[resend] envio RECUSADO: HTTP ${res.status} — assunto="${subject.slice(0, 120)}" destinos=${quantosDestinos(to)} corpo=${corpo.slice(0, 400)}`,
      );
    }
    return res.ok;
  } catch (e) {
    console.warn(
      `[resend] envio FALHOU (exceção): ${e instanceof Error ? e.message : String(e)} — assunto="${subject.slice(0, 120)}" destinos=${quantosDestinos(to)}`,
    );
    return false;
  }
}
