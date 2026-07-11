/**
 * Vídeo Estúdio F5 — QA automático de cena (checklist item 4 do export):
 * "cena com texto quebrado não sobe". Olha o STILL gerado (antes de gastar a
 * animação) e detecta texto ilegível/deformado típico de imagem de IA.
 *
 * Fail-open: qualquer erro (download, LLM fora, parse) devolve `false` —
 * o QA nunca pode travar o fluxo do usuário. Haiku (barato, 1 chamada/cena).
 * Server-only.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SYSTEM = `Você é o QA visual de cenas de b-roll geradas por IA. Vai receber UMA imagem. Responda se ela contém TEXTO QUEBRADO: letras deformadas, palavras sem sentido (gibberish), rótulos/legendas/telas com escrita ilegível ou errada — o defeito clássico de imagem de IA.

NÃO é texto quebrado: tela/papel desfocado sem intenção de leitura, formas abstratas, ausência total de texto.

Responda APENAS com JSON: {"broken": true} ou {"broken": false}. Na dúvida, {"broken": false}.`;

/** true = o still tem texto quebrado/ilegível (reprovar); false = ok/indeterminado. */
export async function stillTextLooksBroken(stillUrl: string): Promise<boolean> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return false;

    const img = await fetch(stillUrl, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!img.ok) return false;
    const ct = img.headers.get("content-type") || "image/png";
    const media_type = ct.includes("jpeg") || ct.includes("jpg")
      ? "image/jpeg"
      : ct.includes("webp")
        ? "image/webp"
        : "image/png";
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) return false;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 50,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type, data: buf.toString("base64") } },
              { type: "text", text: "Esta cena tem texto quebrado?" },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("");
    return /"broken"\s*:\s*true/i.test(text);
  } catch {
    return false;
  }
}
