/**
 * Agente de suporte — escalação REAL pra humano. Server-only.
 *
 * A Mary sinaliza a escalação com um marcador interno na última linha da
 * resposta: "[ESCALAR: resumo do que o aluno precisa]" (instrução no manual).
 * Aqui a gente: extrai/remove o marcador, pausa a IA no chat (mode=human) e
 * avisa a equipe — primeiro por WhatsApp (números em AGENT_TEAM_WHATSAPP),
 * depois por e-mail (allowlist admin_emails + suporte@).
 * ERRO TÉCNICO ([ESCALAR-TECNICO: ...]): avisa SÓ o responsável técnico
 * (AGENT_TECH_WHATSAPP) + e-mail pro suporte@ como registro — decisão do
 * Johnny 2026-07-13: falha de sistema não aciona o resto da equipe.
 * Best-effort: aviso falhar nunca derruba a resposta ao aluno.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendAgentText } from "@/lib/agent/provider";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import type { AgentChatRow } from "@/lib/db/types";

const MARKER = /\[ESCALAR(-TECNICO)?:\s*([^\]]{1,300})\]/i;
const PANEL_URL = "https://fastcloner.com/admin/agente";

/** Separa o marcador de escalação da resposta visível ao aluno. */
export function extractEscalation(reply: string): {
  clean: string;
  reason: string | null;
  /** true = [ESCALAR-TECNICO: ...] — falha de sistema, avisa SÓ o técnico. */
  technical: boolean;
} {
  const m = reply.match(MARKER);
  if (!m) return { clean: reply.trim(), reason: null, technical: false };
  return { clean: reply.replace(MARKER, "").trim(), reason: m[2].trim(), technical: Boolean(m[1]) };
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

/** Números (dígitos com país, separados por vírgula) → JIDs. */
function envJids(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter(Boolean)
    .map((d) => `${d}@s.whatsapp.net`);
}

/**
 * Pra quem vai o zap da escalação: técnico → AGENT_TECH_WHATSAPP (só o
 * responsável); resto → AGENT_TEAM_WHATSAPP. Técnico sem env configurada
 * cai na equipe (melhor avisar alguém do que ninguém).
 */
function escalationJids(technical: boolean): string[] {
  if (technical) {
    const tech = envJids("AGENT_TECH_WHATSAPP");
    if (tech.length > 0) return tech;
  }
  return envJids("AGENT_TEAM_WHATSAPP");
}

/**
 * Avisa a equipe que um aluno pediu/precisa de humano: WhatsApp primeiro
 * (mensagem pronta pra agir), e-mail em seguida (registro + quem não usa zap).
 */
export async function notifyTeamEscalation(args: {
  chat: AgentChatRow;
  reason: string;
  lastUserText: string | null;
  /** Falha de sistema → avisa SÓ o técnico (zap) + suporte@ (registro). */
  technical?: boolean;
}): Promise<void> {
  try {
    const student = args.chat.name || "Aluno sem nome";
    const phone = args.chat.wa_phone ? `+${args.chat.wa_phone}` : args.chat.wa_jid;
    const excerpt = (args.lastUserText ?? "").slice(0, 300);
    const technical = args.technical === true;

    const waText = [
      technical
        ? `⚙️ *Suporte FastCloner — ERRO TÉCNICO reportado por aluno*`
        : `🙋 *Suporte FastCloner — aluno pedindo humano*`,
      ``,
      `*Quem:* ${student} (${phone})`,
      `*Situação:* ${args.reason}`,
      excerpt ? `*Última mensagem:* "${excerpt}"` : "",
      ``,
      `A Mary já pausou nessa conversa — responda pelo painel: ${PANEL_URL}`,
    ]
      .filter(Boolean)
      .join("\n");
    for (const jid of escalationJids(technical)) {
      try {
        await sendAgentText(jid, waText);
      } catch {
        /* tenta o próximo número */
      }
    }

    await sendEmail({
      to: technical ? [SUPPORT_EMAIL] : await teamEmails(),
      subject: technical
        ? `⚙️ WhatsApp: erro técnico reportado por ${student}`
        : `🙋 WhatsApp: ${student} precisa de atendimento humano`,
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
