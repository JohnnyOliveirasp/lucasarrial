/**
 * Mary na LANDING (pedido Johnny 03/08) — visitante NÃO logado, pré-venda.
 * POST { text, history?, locale? } → resposta da Mary.
 *
 * Sem conta e sem banco: o histórico vem do navegador (sessionStorage) e
 * volta na requisição — API stateless. Anti-abuso: rate-limit em memória
 * por IP (janela de minuto + teto diário). Escalação vira e-mail marcado
 * como "visitante da landing" (a Mary pede o e-mail da pessoa na conversa).
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { buildAgentReply } from "@/lib/agent/brain";
import { extractEscalation } from "@/lib/agent/escalate";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import type { AgentMessageRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const TEXT_MAX = 1000;
const HISTORY_MAX = 12;
const PER_MINUTE = 4;
const PER_DAY = Number(process.env.LANDING_HELP_RATE_LIMIT_PER_DAY ?? 25);

/** Rate-limit em memória (pm2 = 1 processo; v1 é suficiente). */
const hits = new Map<string, { day: string; count: number; minute: number; minuteCount: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / 60_000);
  const h = hits.get(ip);
  if (!h || h.day !== day) {
    hits.set(ip, { day, count: 1, minute, minuteCount: 1 });
    if (hits.size > 5000) hits.clear(); // teto de memória
    return false;
  }
  if (h.minute !== minute) {
    h.minute = minute;
    h.minuteCount = 0;
  }
  h.count += 1;
  h.minuteCount += 1;
  return h.count > PER_DAY || h.minuteCount > PER_MINUTE;
}

function landingSystemExtra(locale: string): string {
  return [
    `CANAL: você está no CHAT DA PÁGINA PÚBLICA do site (fastcloner.com). A pessoa NÃO está logada — provavelmente ainda NÃO é aluna (pré-venda).`,
    `FOCO: explicar o que a plataforma faz (clonagem de voz, geração de áudio, imagens, vídeos), o preço e como assinar. Seja acolhedora e objetiva; convide a assinar quando fizer sentido, sem pressão.`,
    `NÃO invente dados de conta: você não tem acesso a conta nenhuma aqui. Dúvida de conta/pagamento de quem JÁ é aluno → oriente fazer login e usar o chat de ajuda de dentro do app, ou escrever pra suporte@fastcloner.com.`,
    `Se a pessoa quiser contato humano, peça o E-MAIL dela na conversa antes de escalar — sem e-mail a equipe não consegue responder.`,
    `IDIOMA: a página está em "${locale}". Responda SEMPRE nesse idioma (se a pessoa escrever em outro, siga o dela).`,
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (limited(ip)) {
    return jsonError(
      "rate_limited",
      "Muitas mensagens em sequência — espere um pouco ou escreva pra suporte@fastcloner.com.",
      429,
    );
  }

  let body: { text?: unknown; history?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, TEXT_MAX) : "";
  if (!text) return badRequest("Mensagem vazia");
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : "pt-BR";

  // Histórico do navegador → formato do cérebro (sanitizado e limitado).
  const rawHist = Array.isArray(body.history) ? body.history.slice(-HISTORY_MAX) : [];
  const history = rawHist
    .filter(
      (m): m is { from_me: boolean; content: string } =>
        !!m && typeof m === "object" &&
        typeof (m as { content?: unknown }).content === "string" &&
        typeof (m as { from_me?: unknown }).from_me === "boolean",
    )
    .map(
      (m) =>
        ({
          content: m.content.slice(0, TEXT_MAX),
          from_me: m.from_me,
          sender_name: null,
        }) as unknown as AgentMessageRow,
    );
  history.push({ content: text, from_me: false, sender_name: null } as unknown as AgentMessageRow);

  let reply: string;
  try {
    reply = await buildAgentReply(history, {
      account:
        "VISITANTE ANÔNIMO da página pública — não logado, sem conta identificada. Não há dados de conta.",
      systemExtra: landingSystemExtra(locale),
    });
  } catch (e) {
    console.error("[landing-help] Mary falhou:", e instanceof Error ? e.message : e);
    return serverError("Assistente indisponível agora — tente de novo em instantes.");
  }

  const { clean, reason, technical } = extractEscalation(reply);
  if (reason) {
    try {
      await sendEmail({
        to: [SUPPORT_EMAIL],
        subject: `🌐 Visitante da LANDING pedindo contato — Mary`,
        html:
          `<p>Escalação da Mary no <strong>chat da landing</strong> (visitante não logado).</p><ul>` +
          `<li><strong>Situação:</strong> ${escapeHtml(reason)}</li>` +
          `<li><strong>Última mensagem:</strong> "${escapeHtml(text.slice(0, 300))}"</li>` +
          `<li><strong>Técnico?</strong> ${technical ? "sim" : "não"}</li>` +
          `</ul><p>O e-mail do visitante (se ele deu) está na conversa acima — a Mary pede antes de escalar.</p>`,
      });
    } catch {
      /* best-effort */
    }
  }

  return jsonOk({ reply: clean || reply });
}
