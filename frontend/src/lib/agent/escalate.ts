/**
 * Agente de suporte — escalação REAL pra humano. Server-only.
 *
 * A Fast sinaliza a escalação com um marcador interno na última linha da
 * resposta: "[ESCALAR: resumo do que o aluno precisa]" (instrução no manual).
 * Aqui a gente: extrai/remove o marcador, pausa a IA no chat (mode=human) e
 * avisa a equipe — primeiro por WhatsApp (números em AGENT_TEAM_WHATSAPP),
 * depois por e-mail (allowlist admin_emails + suporte@).
 * ERRO TÉCNICO ([ESCALAR-TECNICO: ...]): avisa SÓ o responsável técnico
 * (AGENT_TECH_WHATSAPP) + e-mail pro suporte@ como registro — decisão do
 * Johnny 2026-07-13: falha de sistema não aciona o resto da equipe.
 * Best-effort: aviso falhar nunca derruba a resposta ao aluno.
 */
import { createHash } from "node:crypto";

import { sendAgentText } from "@/lib/agent/provider";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
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
      `A Fast já pausou nessa conversa — responda pelo painel: ${PANEL_URL}`,
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
        `<li><strong>Situação (resumo da Fast):</strong> ${escapeHtml(args.reason)}</li>` +
        (excerpt ? `<li><strong>Última mensagem:</strong> ${escapeHtml(excerpt)}</li>` : "") +
        `</ul>` +
        `<p>A Fast foi pausada nessa conversa — assuma pelo painel: <a href="${PANEL_URL}">${PANEL_URL}</a></p>`,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Chamado pro Frank a partir do WhatsApp — inclusive do GRUPO.
 *
 * Pedido do Johnny 22/08: *"quando alguém marcar a Carol no grupo e pedir
 * ajuda, ela precisa pegar o pedido da pessoa e abrir um chamado para que o
 * Frank investigue"*. O gatilho é ela NÃO resolver sozinha (o marcador
 * [ESCALAR] que ela já usa) — decisão dele: pergunta que morre no grupo não
 * vira chamado, senão a fila do Frank enche de coisa já resolvida.
 *
 * Até aqui o zap só avisava e pausava a conversa; o chamado existia apenas no
 * caminho do e-mail. Best-effort: falhar aqui nunca derruba o atendimento.
 */
export async function abrirChamadoDaEscalacao(args: {
  chat: AgentChatRow;
  /** Quem falou (participante, no grupo). */
  senderJid: string | null;
  reason: string;
  lastUserText: string | null;
  technical?: boolean;
}): Promise<void> {
  try {
    const grupo = args.chat.kind === "group";
    const technical = args.technical === true;
    const quem = grupo
      ? (args.senderJid ?? "").replace(/\D/g, "") || "desconhecido"
      : args.chat.wa_phone || args.chat.wa_jid;
    // ⚠️ No grupo o chat é UM só. Assinar pelo chat faria TODO pedido cair no
    // mesmo chamado eterno — a chave tem que ser quem pediu + o assunto.
    const assunto = createHash("sha1")
      .update(args.reason.toLowerCase().replace(/\s+/g, " ").trim())
      .digest("hex")
      .slice(0, 10);
    const onde = grupo ? "grupo" : "privado";
    const excerpt = (args.lastUserText ?? "").slice(0, 1000);

    await abrirChamadoReportado({
      signature: `wa-${onde}:${quem}:${assunto}`,
      title: grupo
        ? `Carol (grupo): ${args.reason.slice(0, 90)}`
        : `Carol (zap${technical ? "" : ", atendimento"}): ${args.reason.slice(0, 90)}`,
      description: grupo
        ? `Pedido feito no GRUPO do suporte e marcando a Carol — ela não resolve sozinha e escalou. ` +
          `Quem pediu: ${args.chat.name || "grupo"} / participante ${quem}. Resumo dela: ${args.reason}`
        : `Pedido por WhatsApp de ${args.chat.name || "aluno sem nome"} (${quem}) — a Carol escalou. ` +
          `Resumo dela: ${args.reason}`,
      reportedBy: grupo ? "carol-grupo" : "carol-zap",
      sampleError: excerpt,
    });
  } catch (e) {
    console.error("[agent/escalate] chamado não abriu:", e instanceof Error ? e.message : e);
  }
}
