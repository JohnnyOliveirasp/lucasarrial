/**
 * Geração dinâmica de ROTEIROS DE LEITURA para clonagem de voz, via Claude Haiku.
 *
 * O usuário escolhe um TEMA/estilo (conversa casual, história infantil,
 * jornalístico, piadas, drama…). O Haiku gera uma narrativa NAQUELE estilo,
 * quebrada em blocos com DIREÇÃO EMOCIONAL variada — a pessoa lê em voz alta
 * mudando o tom, o que captura o range da voz pro treino.
 *
 * Server-only. Usa fetch direto (sem @anthropic-ai/sdk). Sem ANTHROPIC_API_KEY
 * ou em erro/timeout, retorna null (o caller decide o fallback).
 */
import { SCRIPT_THEMES, findScriptTheme } from "./script-themes";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 30_000;

export type ScriptBlock = { emotion: string; text: string };
export type VoiceScript = {
  title: string;
  style: string;
  blocks: ScriptBlock[];
};

/** Paleta de direções emocionais (referência; o modelo adapta ao estilo do tema). */
const EMOTIONS = [
  "Animado / Narrativa",
  "Divertido / Brincalhão",
  "Surpresa / Descrença",
  "Conspiratório / Fofoca",
  "Sem emoção / Seco",
  "Tranquilo / Leve",
  "Curioso / Reflexivo",
  "Indignado / Exagerado",
];

const SYSTEM = `Você cria ROTEIROS DE LEITURA em português do Brasil para clonagem de voz.

O usuário vai LER o roteiro em voz alta, variando o tom em cada bloco, para
treinar um modelo da própria voz. O texto precisa soar NATURAL para ser falado.

Regras OBRIGATÓRIAS:
- Siga o ESTILO/TEMA pedido pelo usuário (o gênero e o tom são definidos por ele).
- Uma narrativa com começo, meio e fim, dividida em 7 blocos.
- Cada bloco tem UMA direção emocional, e o tom deve MUDAR de um bloco pro outro
  (pra capturar o range da voz). Use estas direções como referência, adaptando ao
  estilo: ${EMOTIONS.join("; ")}.
- Cada bloco com 3 a 6 frases.
- 100% em português do Brasil, linguagem pensada para ser FALADA.
- NÃO use números, símbolos, emojis, siglas ou abreviações — escreva tudo por
  extenso (ex.: "dois mil reais", "vinte por cento"), inclusive no título.
- NÃO inclua instruções, títulos de seção extras nem comentários fora do JSON.

Responda APENAS com JSON válido neste formato exato:
{"title": "<título curto>", "blocks": [{"emotion": "<direção emocional>", "text": "<parágrafo do bloco>"}]}`;

type AnthropicBlock = { type: string; text?: string };

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Gera um roteiro novo no estilo do tema (`themeId`). Tema inválido/ausente →
 * sorteia um. Retorna null se não houver key ou se a resposta não for parseável.
 */
export async function generateVoiceScript(themeId?: string): Promise<VoiceScript | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const theme = findScriptTheme(themeId) ?? pick(SCRIPT_THEMES);

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2400,
        temperature: 1,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Crie um roteiro novo no seguinte estilo: ${theme.instruction}.`,
          },
          // Prefill força a saída a começar como JSON.
          { role: "assistant", content: "{" },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { content?: AnthropicBlock[] };
    const raw = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("")
      .trim();

    // A resposta começa depois do prefill "{" — recompõe e isola o objeto.
    const jsonText = "{" + raw.slice(0, raw.lastIndexOf("}") + 1).replace(/^\{/, "");
    const parsed = JSON.parse(jsonText) as {
      title?: string;
      blocks?: Array<{ emotion?: string; text?: string }>;
    };

    const blocks = (parsed.blocks ?? [])
      .filter((b) => b && typeof b.text === "string" && b.text.trim())
      .map((b) => ({ emotion: (b.emotion ?? "").trim() || "Narrativa", text: b.text!.trim() }));

    if (blocks.length === 0) return null;

    return {
      title: (parsed.title ?? "").trim() || "Roteiro de gravação",
      style: theme.label,
      blocks,
    };
  } catch {
    return null;
  }
}
