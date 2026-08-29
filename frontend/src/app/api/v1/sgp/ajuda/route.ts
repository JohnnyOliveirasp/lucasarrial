/**
 * Fast dentro do SGP — o botão "Ajuda" das telas do formulário.
 * POST { text, history?, passo?, locale? } → { reply }
 *
 * Sem login: quem está do outro lado é o COOKIE da sessão do SGP, então a
 * Fast enxerga o pedido inteiro (fotos reprovadas e por quê, minutos de fala,
 * código confirmado ou não) e responde com número, não com achismo.
 * Igual à landing, o histórico mora no navegador — a API é stateless.
 *
 * ESCALAÇÃO (ordem do Johnny 29/08: "se as pessoas não conseguirem fazer
 * algo, ela escala pro Frank ou pra um humano no WhatsApp"):
 *   [ESCALAR-TECNICO] → chamado na fila TÉCNICA (a que o Frank varre).
 *   [ESCALAR]         → chamado de ATENDIMENTO + aviso no grupo do WhatsApp
 *                       do time, que responde a pessoa no zap/e-mail dela.
 * O chamado vem primeiro porque é o registro que sobrevive: o e-mail é aviso,
 * não memória (lição do #150 — 11 alunos com promessa e zero chamado).
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { criarLimitePorIp, ipDaRequisicao } from "@/lib/api/rate-ip";
import { buildAgentReply } from "@/lib/agent/brain";
import { extractEscalation } from "@/lib/agent/escalate";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import { entregarAoTime } from "@/lib/incidents/entregar";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import { ajudaSystemExtra, contextoDoPedido, manualDoSgp } from "@/lib/sgp/ajuda";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SGP_PASSOS, type SgpPasso, type SgpPedidoRow } from "@/lib/sgp/types";
import type { AgentMessageRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const TEXT_MAX = 1000;
const HISTORY_MAX = 12;
const POR_MINUTO = 5;
const POR_DIA = Number(process.env.SGP_AJUDA_RATE_LIMIT_PER_DAY ?? 40);

const limite = criarLimitePorIp({ porMinuto: POR_MINUTO, porDia: POR_DIA });

/** Como o time acha essa pessoa: WhatsApp primeiro (é o canal dela). */
function contatoDe(pedido: SgpPedidoRow | null): string | null {
  if (!pedido) return null;
  const partes = [
    pedido.nome,
    pedido.whatsapp ? `+${pedido.whatsapp}` : null,
    pedido.email,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/** Chamado do SGP: fila técnica (Frank) ou de atendimento (gente). */
async function abrirChamadoDoSgp(args: {
  pedido: SgpPedidoRow | null;
  passo: SgpPasso | null;
  reason: string;
  texto: string;
  technical: boolean;
}): Promise<number | null> {
  try {
    // Sem conta, a chave é o pedido (uuid da sessão); sem pedido, o e-mail não
    // existe ainda e a assinatura cai no assunto — não pode agrupar estranhos.
    const dono = args.pedido?.email || args.pedido?.sessao || "anonimo";
    const emails = args.pedido?.email ? [args.pedido.email] : undefined;
    return await abrirChamadoReportado({
      signature: `sgp:${args.technical ? "tec" : "atend"}:${dono}`,
      title: `Fast (SGP${args.technical ? "" : ", atendimento"}): ${args.reason.slice(0, 90)}`,
      description:
        (args.technical
          ? `Falha relatada no FORMULÁRIO DO SGP (pessoa SEM conta, preenchendo o wizard) — a Fast não resolveu e escalou. Resumo dela: ${args.reason}`
          : `Pedido de ATENDIMENTO no FORMULÁRIO DO SGP (pessoa SEM conta, preenchendo o wizard) — a Fast prometeu que alguém do time responde. Resumo dela: ${args.reason}`) +
        (args.passo ? `\n\nTela em que ela estava: ${args.passo}` : "") +
        `\n\nContato: ${contatoDe(args.pedido) ?? "⚠️ NÃO informado ainda (ela não passou da tela 1)"}` +
        `\n\n⚠️ Ela NÃO tem login: não adianta responder pelo painel do app. Responda no WhatsApp ou no e-mail acima.`,
      reportedBy: "fast-sgp",
      categoria: args.technical ? "tecnico" : "atendimento",
      affectedEmails: emails,
      sampleError: args.texto,
    });
  } catch (e) {
    console.error("[sgp/ajuda] chamado não abriu:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Registro por e-mail — aviso, nunca a única memória. */
async function avisarPorEmail(args: {
  pedido: SgpPedidoRow | null;
  passo: SgpPasso | null;
  reason: string;
  texto: string;
  technical: boolean;
  numero: number | null;
}): Promise<void> {
  try {
    await sendEmail({
      to: [SUPPORT_EMAIL, "johnny.oliveirasp@gmail.com"],
      subject: `${args.technical ? "⚙️ ERRO TÉCNICO" : "🙋 Pedindo humano"} — SGP${
        args.numero != null ? ` — #${args.numero}` : ""
      } — ${contatoDe(args.pedido) ?? "sem contato"}`,
      html:
        `<p>Escalação da Fast no <strong>formulário do SGP</strong> (pessoa sem conta).</p><ul>` +
        (args.numero != null
          ? `<li><strong>Chamado:</strong> #${args.numero}</li>`
          : `<li><strong>Chamado:</strong> ⚠️ NÃO abriu — este e-mail é o único registro</li>`) +
        `<li><strong>Contato:</strong> ${escapeHtml(contatoDe(args.pedido) ?? "não informado")}</li>` +
        (args.passo ? `<li><strong>Tela:</strong> ${escapeHtml(args.passo)}</li>` : "") +
        `<li><strong>Situação:</strong> ${escapeHtml(args.reason)}</li>` +
        `<li><strong>Última mensagem:</strong> "${escapeHtml(args.texto.slice(0, 300))}"</li>` +
        `</ul><p>Ela não tem login — responda no WhatsApp ou no e-mail dela.</p>`,
    });
  } catch {
    /* best-effort */
  }
}

export async function POST(request: NextRequest) {
  if (limite.limitado(ipDaRequisicao(request.headers))) {
    return jsonError(
      "rate_limited",
      "Muitas mensagens em sequência — espere um pouco ou escreva pra suporte@fastcloner.com.",
      429,
    );
  }

  let body: { text?: unknown; history?: unknown; passo?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, TEXT_MAX) : "";
  if (!text) return badRequest("Mensagem vazia");
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : "pt-BR";
  const passo =
    typeof body.passo === "string" && (SGP_PASSOS as readonly string[]).includes(body.passo)
      ? (body.passo as SgpPasso)
      : null;

  // O pedido é a identidade aqui — cookie httpOnly, não dá pra forjar pelo body.
  let pedido: SgpPedidoRow | null = null;
  try {
    pedido = await pedidoDaSessaoOuNull();
  } catch (e) {
    console.error("[sgp/ajuda] pedido não carregou:", e instanceof Error ? e.message : e);
  }

  const rawHist = Array.isArray(body.history) ? body.history.slice(-HISTORY_MAX) : [];
  const history = rawHist
    .filter(
      (m): m is { from_me: boolean; content: string } =>
        !!m &&
        typeof m === "object" &&
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
      account: contextoDoPedido(pedido, passo),
      systemExtra: [
        manualDoSgp(),
        ajudaSystemExtra({ passo, locale, temContato: Boolean(pedido?.email || pedido?.whatsapp) }),
        "OBS: o bloco de conta acima fala em telefone do WhatsApp porque é o texto padrão do outro canal — aqui a identificação vem do formulário aberto neste navegador, e os dados são os do pedido dela.",
      ].join("\n\n"),
    });
  } catch (e) {
    console.error("[sgp/ajuda] Fast falhou:", e instanceof Error ? e.message : e);
    return serverError("Assistente indisponível agora — tente de novo em instantes.");
  }

  const { clean, reason, technical } = extractEscalation(reply);
  if (reason) {
    const numero = await abrirChamadoDoSgp({ pedido, passo, reason, texto: text, technical });
    await avisarPorEmail({ pedido, passo, reason, texto: text, technical, numero });
    // Atendimento precisa de PESSOA: o grupo do WhatsApp é onde o time vê.
    if (numero != null && !technical) {
      try {
        await entregarAoTime({
          numero,
          canal: "SGP (formulário, sem login)",
          aluno: contatoDe(pedido) ?? "⚠️ sem contato — ela não passou da tela 1",
          resumo: reason,
          texto: text,
        });
      } catch (e) {
        console.error("[sgp/ajuda] entrega ao time falhou:", e instanceof Error ? e.message : e);
      }
    }
  }

  return jsonOk({ reply: clean || reply });
}
