/**
 * Agente de suporte — classificador de grupo (F6). Server-only.
 * Decide se uma mensagem de grupo SEM menção à Mary é uma dúvida clara sobre
 * a plataforma que merece resposta do suporte (dúvida jogada no grupo ou
 * dirigida ao Lucas/equipe). CONSERVADOR: na dúvida, NÃO — melhor a Mary
 * ficar quieta do que virar "a chata do grupo".
 * Haiku (barato, 1 chamada por candidata). Erro/timeout → false (fail-closed).
 */
import type { AgentMessageRow } from "@/lib/db/types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.AGENT_CLASSIFIER_MODEL || "claude-haiku-4-5";
const TIMEOUT_MS = 10_000;
const CONTEXT_LIMIT = 12; // mensagens recentes do grupo que o filtro enxerga

const SYSTEM = `Você filtra mensagens de um grupo de WhatsApp de alunos da FastCloner (plataforma de clonagem de voz e criação de vídeos/imagens com IA). A assistente de suporte Mary só deve entrar na conversa SEM ser chamada quando a mensagem avaliada é CLARAMENTE uma dúvida ou problema sobre a plataforma (voz, vídeo, imagem, créditos, pagamento, acesso, erro) que ainda NÃO foi respondida — inclui dúvidas dirigidas ao Lucas ou à equipe/suporte.

Responda APENAS "SIM" ou "NAO". Na dúvida, "NAO".

"NAO" para: conversa social, piada, elogio, agradecimento, desabafo, aluno respondendo outro aluno, assunto fora da plataforma, mensagem ambígua ou incompleta, dúvida que alguém já respondeu nas mensagens seguintes, e mensagens dirigidas a uma pessoa específica sobre assunto pessoal.

OUTRAS FERRAMENTAS: os alunos também usam ferramentas de terceiros no curso (HeyGen, ElevenLabs e similares). Dúvida sobre essas ferramentas → "NAO" (não é a plataforma FastCloner). Dúvida ambígua que não diz a ferramenta (ex.: "meu vídeo não gerou", "a voz ficou ruim"): use as mensagens anteriores da conversa pra identificar o contexto; se não der pra ter CERTEZA de que é sobre o FastCloner → "NAO".`;

/**
 * A Mary deve responder esta mensagem de grupo mesmo sem ter sido marcada?
 * `history` = últimas mensagens do chat (asc); `targetId` marca a candidata
 * (as linhas DEPOIS dela chegaram durante a espera — servem pra detectar
 * "alguém já respondeu").
 */
export async function shouldAnswerUnprompted(
  history: AgentMessageRow[],
  targetId: string,
): Promise<boolean> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return false;

    const recent = history.slice(-CONTEXT_LIMIT);
    if (!recent.some((m) => m.id === targetId)) return false;
    const lines = recent
      .map((m) => {
        const text = (m.content ?? "").trim();
        if (!text) return null;
        const who = m.from_me ? "Mary (suporte)" : m.sender_name || "Aluno";
        const line = `${who}: ${text}`;
        return m.id === targetId ? `>>> ${line}` : line;
      })
      .filter(Boolean)
      .join("\n");

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 5,
        system: [{ type: "text", text: SYSTEM }],
        messages: [
          {
            role: "user",
            content: `CONVERSA RECENTE DO GRUPO (avalie SÓ a linha marcada com ">>>"; as linhas seguintes chegaram depois dela):\n${lines}\n\nA Mary deve responder a mensagem marcada?`,
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const verdict = (json.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("")
      .trim()
      .toUpperCase();
    return verdict.startsWith("SIM");
  } catch {
    return false; // classificador indisponível = Mary fica quieta
  }
}
