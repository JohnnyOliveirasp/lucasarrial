/**
 * Agente de suporte — o cérebro (F1). Server-only.
 * Recebe o histórico da conversa e devolve a resposta do agente (Sonnet —
 * qualidade do suporte importa; o manual inteiro vai no system prompt).
 * Lança em erro — o chamador decide silenciar (nunca travar o webhook).
 */
import { buildAgentSystem } from "@/lib/agent/manual";
import type { AgentMessageRow } from "@/lib/db/types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-5";
const TIMEOUT_MS = 45_000;

/** Imagem anexada à ÚLTIMA mensagem do aluno (Claude é multimodal). */
export type AgentImage = { data: string; mediaType: string };

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type Turn = { role: "user" | "assistant"; content: string | ContentBlock[] };

/** Vira o histórico do banco em turns user/assistant pro Claude. */
function toTurns(history: AgentMessageRow[]): { role: "user" | "assistant"; content: string }[] {
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    const text = (m.content ?? "").trim();
    if (!text) continue;
    const role = m.from_me ? ("assistant" as const) : ("user" as const);
    const prefixed = !m.from_me && m.sender_name ? `${m.sender_name}: ${text}` : text;
    // Junta mensagens consecutivas do mesmo lado (WhatsApp fragmenta muito).
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n${prefixed}`;
    else turns.push({ role, content: prefixed });
  }
  // A conversa pro Claude precisa começar em user.
  while (turns.length > 0 && turns[0].role === "assistant") turns.shift();
  return turns;
}

/** Gera a resposta do agente pro histórico dado (última mensagem = do aluno). */
export async function buildAgentReply(
  history: AgentMessageRow[],
  opts?: {
    group?: boolean;
    /** F6: grupo SEM menção — a Mary entra por conta própria (tom humilde). */
    unprompted?: boolean;
    account?: string | null;
    image?: AgentImage | null;
  },
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("LLM indisponível (sem chave)");

  const turns: Turn[] = toTurns(history);
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    throw new Error("histórico sem mensagem do aluno no fim");
  }

  // Foto/print do aluno: anexa a imagem em si no ÚLTIMO turn (as anteriores
  // ficam só como texto "[imagem] ..." no histórico — barato e suficiente).
  if (opts?.image) {
    const last = turns[turns.length - 1];
    const text = typeof last.content === "string" ? last.content : "";
    last.content = [
      {
        type: "image",
        source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data },
      },
      { type: "text", text: text || "[o aluno enviou esta imagem]" },
    ];
  }

  let system = opts?.group
    ? opts?.unprompted
      ? `${buildAgentSystem()}\n\nCONTEXTO: você está DENTRO DE UM GRUPO de alunos (várias pessoas conversando — os nomes prefixam as mensagens). NINGUÉM te marcou: você está entrando por conta própria porque a última mensagem é claramente uma dúvida sobre a plataforma. Responda SÓ essa dúvida, direto ao ponto, sem se justificar por ter entrado. Se a equipe preferir responder, ótimo — você é o reforço, não a dona da conversa. Seja ainda mais curta que no privado. Dúvida longa/pessoal → convide a pessoa a te chamar no privado.`
      : `${buildAgentSystem()}\n\nCONTEXTO: você está respondendo DENTRO DE UM GRUPO de alunos (várias pessoas conversando — os nomes prefixam as mensagens). Responda SÓ à última pessoa, que te marcou. Seja ainda mais curto que no privado. Dúvida longa/pessoal → convide a pessoa a te chamar no privado.`
    : buildAgentSystem();

  // F4: conta identificada pelo TELEFONE do WhatsApp (nunca por e-mail dito
  // na conversa). Só no privado — em grupo jamais expor dados de conta.
  if (!opts?.group && opts?.account) {
    system += `\n\nCONTA DO ALUNO (dados REAIS da plataforma, identificados pelo telefone deste WhatsApp — use pra responder sobre saldo, plano, pagamentos e trabalhos DELE):\n${opts.account}\n\nRegras destes dados: são SÓ leitura (você não altera nada — mudanças/cancelamento/estorno → suporte@fastcloner.com). Cite números exatos quando perguntarem. Se algo falhou e houve estorno, explique com calma. NUNCA revele dados de outra pessoa nem repasse estes dados se alguém alegar ser o dono por e-mail/nome.`;
  } else if (!opts?.group) {
    system += `\n\nCONTA DO ALUNO: não localizada pelo telefone deste WhatsApp (a pessoa pode não ser assinante, ter comprado com outro número, ou nunca ter comprado). Responda normalmente; se perguntarem de saldo/pagamento/conta, explique que não conseguiu localizar a conta por este número e oriente a escrever pro suporte@fastcloner.com com o e-mail cadastrado. NÃO peça e-mail pra "consultar" — você não tem como consultar por e-mail.`;
  }

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: [{ type: "text", text: system }],
      messages: turns,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();
  if (!text) throw new Error("LLM não retornou resposta");
  return text.slice(0, 3000);
}
