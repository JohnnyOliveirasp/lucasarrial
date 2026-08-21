/**
 * Agente de suporte — escalação REAL pra humano. Server-only.
 *
 * A Fast sinaliza a escalação com um marcador interno na última linha da
 * resposta: "[ESCALAR: resumo do que o aluno precisa]" (instrução no manual).
 * Aqui a gente: extrai/remove o marcador, pausa a IA no chat (mode=human) e
 * avisa a equipe — primeiro por WhatsApp (grupo em AGENT_SUPPORT_GROUP_JID +
 * números em AGENT_TEAM_WHATSAPP), depois por e-mail (allowlist admin_emails
 * + suporte@). Desde 19/08 (autorização do Johnny) o aviso vale pros DOIS
 * canais da Fast: chat do site/zap E e-mail ao suporte@ — antes a escalação
 * por e-mail virava só uma linha de log e ninguém ficava sabendo.
 * ERRO TÉCNICO ([ESCALAR-TECNICO: ...]): avisa SÓ o responsável técnico
 * (AGENT_TECH_WHATSAPP) + e-mail pro suporte@ como registro — decisão do
 * Johnny 2026-07-13: falha de sistema não aciona o resto da equipe.
 * Best-effort: aviso falhar nunca derruba a resposta ao aluno.
 */
import { sendAgentText } from "@/lib/agent/provider";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import type { AgentChatRow } from "@/lib/db/types";

// Caso Anderson 10/08: resumo >300 chars não casava o regex → marcador VAZAVA
// pro chat do aluno e nenhum e-mail saía. Sem limite no match; o corte pra
// exibição/e-mail é feito por quem consome (slice), nunca no regex.
const MARKER = /\[ESCALAR(-TECNICO)?:\s*([^\]]+)\]/i;
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
  return { clean: reply.replace(MARKER, "").trim(), reason: m[2].trim().slice(0, 1000), technical: Boolean(m[1]) };
}

/** Pedido Johnny 05/08: escalações da Fast só pra ele + caixa oficial do suporte. */
async function teamEmails(): Promise<string[]> {
  return [SUPPORT_EMAIL, "johnny.oliveirasp@gmail.com"];
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
 * Grupo "FASTCLONER - Suporte" no WhatsApp (decisão Johnny 19/08): jid
 * COMPLETO em AGENT_SUPPORT_GROUP_JID (ex.: 120363428193217427@g.us — a
 * sessão do servidor já está dentro dele). Aceita mais de um, separado por
 * vírgula. Só dígitos também funciona (ganha @g.us). Env vazia = sem grupo.
 */
function supportGroupJids(): string[] {
  return (process.env.AGENT_SUPPORT_GROUP_JID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((j) => (j.includes("@") ? j : `${j.replace(/\D/g, "")}@g.us`));
}

/**
 * Pra quem vai o zap da escalação: técnico → AGENT_TECH_WHATSAPP (só o
 * responsável); resto → GRUPO de suporte + AGENT_TEAM_WHATSAPP. Grupo sem
 * env configurada cai no comportamento antigo (só os números individuais) —
 * melhor avisar alguém do que ninguém.
 */
function escalationJids(technical: boolean): string[] {
  if (technical) {
    const tech = envJids("AGENT_TECH_WHATSAPP");
    if (tech.length > 0) return tech;
  }
  return [...new Set([...supportGroupJids(), ...envJids("AGENT_TEAM_WHATSAPP")])];
}

/**
 * Avisa a equipe que um aluno pediu/precisa de humano: WhatsApp primeiro
 * (mensagem pronta pra agir), e-mail em seguida (registro + quem não usa zap).
 *
 * Dois canais de origem (passe UM dos dois):
 * - `chat`: escalação no WhatsApp (respond.ts) — a Fast pausa a conversa e
 *   quem assume responde pelo painel.
 * - `mail`: escalação que chegou por E-MAIL ao suporte@ (mail-respond.ts) —
 *   não existe painel pra isso; o aviso diz o ENDEREÇO do aluno pra quem
 *   assumir responder por e-mail.
 */
export async function notifyTeamEscalation(args: {
  /** Conversa do WhatsApp — fluxo do chat. */
  chat?: AgentChatRow;
  /** Escalação vinda por e-mail: endereço do aluno + nome, se conhecido. */
  mail?: { fromEmail: string; name?: string | null };
  reason: string;
  lastUserText: string | null;
  /** Falha de sistema → avisa SÓ o técnico (zap) + suporte@ (registro). */
  technical?: boolean;
}): Promise<void> {
  try {
    const viaEmail = !args.chat && Boolean(args.mail);
    const student = (args.chat ? args.chat.name : args.mail?.name) || "Aluno sem nome";
    // Por onde alcançar o aluno: telefone/jid no chat, endereço no e-mail.
    const contact = args.chat
      ? args.chat.wa_phone
        ? `+${args.chat.wa_phone}`
        : args.chat.wa_jid
      : (args.mail?.fromEmail ?? "contato desconhecido");
    const excerpt = (args.lastUserText ?? "").slice(0, 300);
    const technical = args.technical === true;

    const waText = [
      technical
        ? `⚙️ *Suporte FastCloner — ERRO TÉCNICO reportado por aluno*`
        : `🙋 *Suporte FastCloner — aluno pedindo humano*`,
      ``,
      `*Quem:* ${student} (${contact})`,
      `*Veio por:* ${viaEmail ? "e-mail ao suporte@" : "chat (WhatsApp)"}`,
      `*Situação:* ${args.reason}`,
      excerpt ? `*Última mensagem:* "${excerpt}"` : "",
      ``,
      viaEmail
        ? `A Fast já respondeu que a equipe vai verificar — quem assumir responde por E-MAIL pra ${contact}.`
        : `A Fast já pausou nessa conversa — responda pelo painel: ${PANEL_URL}`,
    ]
      .filter(Boolean)
      .join("\n");
    for (const jid of escalationJids(technical)) {
      try {
        await sendAgentText(jid, waText);
      } catch {
        /* tenta o próximo destino */
      }
    }

    const canal = viaEmail ? "E-mail" : "WhatsApp";
    await sendEmail({
      to: technical ? [SUPPORT_EMAIL] : await teamEmails(),
      subject: technical
        ? `⚙️ ${canal}: erro técnico reportado por ${student}`
        : `🙋 ${canal}: ${student} precisa de atendimento humano`,
      html:
        `<p>Um aluno pediu (ou precisa de) atendimento humano no ${viaEmail ? "e-mail do suporte@" : "WhatsApp do suporte"}.</p>` +
        `<ul>` +
        `<li><strong>Quem:</strong> ${escapeHtml(student)} (${escapeHtml(contact)})</li>` +
        `<li><strong>Situação (resumo da Fast):</strong> ${escapeHtml(args.reason)}</li>` +
        (excerpt ? `<li><strong>Última mensagem:</strong> ${escapeHtml(excerpt)}</li>` : "") +
        `</ul>` +
        (viaEmail
          ? `<p>A Fast já respondeu que a equipe vai verificar — quem assumir responde por e-mail pra ${escapeHtml(contact)}.</p>`
          : `<p>A Fast foi pausada nessa conversa — assuma pelo painel: <a href="${PANEL_URL}">${PANEL_URL}</a></p>`),
    });
  } catch {
    /* best-effort */
  }
}
