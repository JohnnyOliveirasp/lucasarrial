/**
 * Geração dinâmica de ROTEIROS DE LEITURA para clonagem de voz, via Claude Haiku.
 *
 * Inspirado no formato dos scripts da ElevenLabs (o PDF de exemplo): uma história
 * casual e contínua do cotidiano, quebrada em blocos com DIREÇÃO EMOCIONAL
 * (Animado, Divertido, Surpresa, Conspiratório, Sem emoção, Tranquilo...). A
 * pessoa lê em voz alta variando o tom → captura o range da voz pro treino.
 *
 * Server-only. Usa fetch direto (sem @anthropic-ai/sdk). Sem ANTHROPIC_API_KEY
 * ou em erro/timeout, retorna null (o caller decide o fallback).
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 30_000;

export type ScriptBlock = { emotion: string; text: string };
export type VoiceScript = {
  title: string;
  style: string;
  blocks: ScriptBlock[];
};

/** Paleta de direções emocionais (mesma ideia do roteiro da ElevenLabs). */
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

/** Temas cotidianos pra variar o roteiro a cada geração. */
const THEMES = [
  "um perrengue no supermercado",
  "um encontro estranho no transporte público",
  "uma confusão com um aplicativo de entrega",
  "um vizinho excêntrico",
  "um dia caótico no trabalho",
  "uma viagem que deu tudo errado",
  "um bicho de estimação aprontando",
  "um reencontro inesperado com alguém",
  "uma reforma na casa que virou novela",
  "uma fofoca que se espalhou rápido demais",
  "um mal-entendido num restaurante",
  "uma tentativa frustrada de cozinhar algo novo",
];

const STYLE = "Português (Brasil) / Conversacional / Casual / Amigável";

const SYSTEM = `Você cria ROTEIROS DE LEITURA em português do Brasil para clonagem de voz.

O usuário vai LER o roteiro em voz alta, variando o tom em cada bloco, para
treinar um modelo da própria voz. Por isso o texto precisa soar como uma pessoa
real CONVERSANDO com um amigo — natural, espontâneo, com gírias leves e ritmo de
fala (não texto formal de livro).

Regras OBRIGATÓRIAS:
- Uma ÚNICA história contínua e cotidiana (começo, meio e fim), dividida em blocos.
- Cada bloco tem UMA direção emocional da paleta a seguir, e o tom deve MUDAR
  visivelmente de um bloco pro outro (pra capturar o range da voz):
  ${EMOTIONS.join("; ")}.
- 7 blocos. Cada bloco com 3 a 6 frases.
- 100% em português do Brasil, linguagem falada e informal.
- NÃO use números, símbolos, emojis, siglas ou abreviações — escreva tudo por
  extenso em palavras (ex.: "dois mil reais", "vinte por cento"), porque o texto
  será LIDO em voz alta. Isso vale TAMBÉM no título (sem dígitos no título).
- NÃO inclua instruções, títulos de seção extras, nem comentários fora do JSON.

Responda APENAS com JSON válido neste formato exato:
{"title": "<título curto e divertido da história>", "blocks": [{"emotion": "<uma direção da paleta>", "text": "<parágrafo do bloco>"}]}`;

type AnthropicBlock = { type: string; text?: string };

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Gera um roteiro novo. `theme` opcional força o tema; senão sorteia um.
 * Retorna null se não houver key ou se a resposta não for parseável.
 */
export async function generateVoiceScript(theme?: string): Promise<VoiceScript | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const chosenTheme = theme || pick(THEMES);

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
          { role: "user", content: `Crie um roteiro novo sobre: ${chosenTheme}.` },
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
      style: STYLE,
      blocks,
    };
  } catch {
    return null;
  }
}
