/**
 * Agente de suporte — escalação REAL pra humano. Server-only.
 *
 * A Mary sinaliza a escalação com um marcador interno na última linha da
 * resposta: "[ESCALAR: resumo do que o aluno precisa]" (instrução no manual).
 * Aqui a gente: extrai/remove o marcador, pausa a IA no chat (mode=human) e
 * avisa a equipe — primeiro por WhatsApp (números em AGENT_TEAM_WHATSAPP),
 * depois por e-mail (allowlist admin_emails + suporte@).
 * Best-effort: aviso falhar nunca derruba a resposta ao aluno.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendAgentText } from "@/lib/agent/provider";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import type { AgentChatRow } from "@/lib/db/types";

const MARKER = /\[ESCALAR:\s*([^\]]{1,300})\]/i;
const PANEL_URL = "https://fastcloner.com/admin/agente";

/** Separa o marcador de escalação da resposta visível ao aluno. */
export function extractEscalation(reply: string): { clean: string; reason: string | null } {
  const m = reply.match(MARKER);
  if (!m) return { clean: reply.trim(), reason: null };
  return { clean: reply.replace(MARKER, "").trim(), reason: m[1].trim() };
}

/** E-mails da equipe: allowlist admin_emails + caixa oficial do suporte. */
async function teamEmails(): Promise<string[]> {
  const out = new Set<string>([SUPPORT_EMAIL]);
  try {
    const { data } = await getAdmin().from("admin_emails").select("email");
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) out.add(r.email.toLowerCase());
    }
  } catch {
    /* segue só com o suporte@ */
  }
  return [...out];
}

/** Números da equipe (dígitos com país, separados por vírgula) → JIDs. */
function teamWhatsappJids(): string[] {
  return (process.env.AGENT_TEAM_WHATSAPP ?? "")
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter(Boolean)
    .map((d) => `${d}@s.whatsapp.net`);
}

/**
 * Avisa a equipe que um aluno pediu/precisa de humano: WhatsApp primeiro
 * (mensagem pronta pra agir), e-mail em seguida (registro + quem não usa zap).
 */
export async function notifyTeamEscalation(args: {
  chat: AgentChatRow;
  reason: string;
  lastUserText: string | null;
}): Promise<void> {
  try {
    const student = args.chat.name || "Aluno sem nome";
    const phone = args.chat.wa_phone ? `+${args.chat.wa_phone}` : args.chat.wa_jid;
    const excerpt = (args.lastUserText ?? "").slice(0, 300);

    const waText = [
      `🙋 *Suporte FastCloner — aluno pedindo humano*`,
      ``,
      `*Quem:* ${student} (${phone})`,
      `*Situação:* ${args.reason}`,
      excerpt ? `*Última mensagem:* "${excerpt}"` : "",
      ``,
      `A Mary já pausou nessa conversa — responda pelo painel: ${PANEL_URL}`,
    ]
      .filter(Boolean)
      .join("\n");
    for (const jid of teamWhatsappJids()) {
      try {
        await sendAgentText(jid, waText);
      } catch {
        /* tenta o próximo número */
      }
    }

    await sendEmail({
      to: await teamEmails(),
      subject: `🙋 WhatsApp: ${student} precisa de atendimento humano`,
      html:
        `<p>Um aluno pediu (ou precisa de) atendimento humano no WhatsApp do suporte.</p>` +
        `<ul>` +
        `<li><strong>Quem:</strong> ${escapeHtml(student)} (${escapeHtml(phone)})</li>` +
        `<li><strong>Situação (resumo da Mary):</strong> ${escapeHtml(args.reason)}</li>` +
        (excerpt ? `<li><strong>Última mensagem:</strong> ${escapeHtml(excerpt)}</li>` : "") +
        `</ul>` +
        `<p>A Mary foi pausada nessa conversa — assuma pelo painel: <a href="${PANEL_URL}">${PANEL_URL}</a></p>`,
    });
  } catch {
    /* best-effort */
  }
}
