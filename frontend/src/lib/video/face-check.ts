/**
 * Checagem de rosto FRONTAL na foto do Vídeo Clone (server-side, gpt-4o-mini).
 *
 * Por que existe (incidente 131, 25/08): o aluno subiu uma referência frontal
 * correta, gerou uma CENA no Gerador de Imagem ("examinando uma tábua de
 * madeira") e a imagem saiu com ele olhando PRA BAIXO, olhos e boca fora da
 * câmera. Essa imagem virou entrada do Vídeo Clone — lip-sync com rosto fora
 * de câmera é impossível — e o produto cobrou os TRÊS passos sem avisar em
 * nenhum (10.120 créditos estornados na mão). Este guard roda ANTES da
 * cobrança e do insert, no mesmo espírito do guard de áudio mudo do route.ts.
 *
 * ⚠️ FAIL-OPEN: se a API falhar, expirar, a chave faltar ou a resposta vier
 * inparseável, retorna { ok: true }. NUNCA bloquear aluno pagante por hiccup
 * de API — o custo de um falso bloqueio é maior que o do bug (mesma regra do
 * guard de silêncio do audio-silencio.ts).
 *
 * Usa fetch direto (sem SDK), mesmo padrão de lib/llm/normalize.ts e
 * lib/video/transcribe.ts.
 */

const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 15_000;

const PROMPT =
  "Você avalia se uma foto serve como entrada de lip-sync (sincronia labial). " +
  "Analise a imagem e responda APENAS um JSON, sem markdown, no formato " +
  '{"ok": boolean, "motivo": string}. ' +
  "ok=true SOMENTE se: (1) há um rosto humano claramente visível; (2) o rosto " +
  "está de frente ou quase de frente para a câmera (não olhando para baixo, " +
  "não de perfil, não de costas); (3) a boca está visível e não ocluída (sem " +
  "mão, objeto, máscara ou cabelo cobrindo). Em qualquer outro caso, ok=false " +
  'e "motivo" com UMA frase curta em português explicando o problema (ex.: ' +
  '"o rosto está olhando para baixo, com os olhos fora da câmera"). ' +
  "Na dúvida genuína (foto ambígua mas provavelmente utilizável), ok=true.";

export type FaceCheck = { ok: boolean; reason?: string };

/**
 * Olha a imagem (via URL presignada) e diz se o rosto serve pro lip-sync.
 * Qualquer falha técnica → { ok: true } (fail-open, ver cabeçalho).
 */
export async function checkFrontalFace(imageUrl: string): Promise<FaceCheck> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: true };

  try {
    const res = await fetch(OPENAI_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: true };

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) return { ok: true };

    // O modelo às vezes embrulha em ```json ... ``` mesmo com response_format.
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
      ok?: unknown;
      motivo?: unknown;
    };
    if (typeof parsed.ok !== "boolean") return { ok: true };
    if (parsed.ok) return { ok: true };
    return {
      ok: false,
      reason:
        typeof parsed.motivo === "string" && parsed.motivo.trim()
          ? parsed.motivo.trim()
          : "o rosto não está de frente pra câmera",
    };
  } catch {
    // timeout, rede, parse — fail-open
    return { ok: true };
  }
}
