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
export async function buildAgentReply(history: AgentMessageRow[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("LLM indisponível (sem chave)");

  const turns = toTurns(history);
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    throw new Error("histórico sem mensagem do aluno no fim");
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
      system: [{ type: "text", text: buildAgentSystem() }],
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
