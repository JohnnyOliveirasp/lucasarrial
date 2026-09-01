/**
 * Gate de rosto frontal do Vídeo Clone (chamado #131, 25/08).
 *
 * A cadeia Gerar Imagem → Animar → Vídeo Clone cobrava os três passos sem
 * NENHUMA checagem de que o quadro que vai pro lip-sync tem um rosto de frente
 * com a boca visível. O aluno escolhia uma referência frontal válida, o prompt
 * de cena virava a cabeça dele pra baixo, e o produto sincronizava lábios num
 * rosto que não existe de frente (Itamar, 10.120c, mesma classe do #121).
 *
 * Roda ANTES da cobrança. Haiku com visão, mesmo padrão de
 * `lib/onboarding/referencia.ts`. FAIL-OPEN: se a API não responder, não
 * bloqueia (o produto não pode parar por causa do detector) — mas registra.
 */
const MODEL = "claude-haiku-4-5";

const SYSTEM = `You inspect ONE photo that will be used for lip-sync video (the mouth will be animated to speech).
Answer ONLY a JSON object: {"frontal": true|false, "mouth_visible": true|false, "reason": "<short, in Brazilian Portuguese>"}.
"frontal" = the main person's face is turned toward the camera (up to ~30° of yaw/pitch is fine); false if in profile, looking down at something, head tilted away, back of head, or no clear human face.
"mouth_visible" = the mouth is visible and not covered (hand, mask, microphone, object, hair, extreme angle).
"reason" explains, in one short sentence a user can act on, why it fails (e.g. "a pessoa está olhando pra baixo, pra tábua na mesa").`;

type Block = { type: string; text?: string };

export type FaceGateResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: string };

export async function checkFrontalFace(imageUrl: string): Promise<FaceGateResult> {
  if (process.env.VIDEO_CLONE_FACE_GATE === "0") return { ok: true, skipped: true };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: true, skipped: true };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: "Inspect this photo. JSON only." },
          ],
        }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Block[] };
    const text = (data.content ?? []).find((b) => b.type === "text")?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("sem JSON na resposta");
    const parsed = JSON.parse(m[0]) as { frontal?: boolean; mouth_visible?: boolean; reason?: string };
    if (parsed.frontal === true && parsed.mouth_visible === true) return { ok: true };
    const reason = (parsed.reason ?? "").trim() || (parsed.frontal === false
      ? "o rosto não está de frente pra câmera"
      : "a boca não está visível");
    return { ok: false, reason };
  } catch (e) {
    console.error("[video-clone/face-gate] visão falhou (fail-open):", e instanceof Error ? e.message : e);
    return { ok: true, skipped: true };
  }
}

/** Mensagem pro aluno — diz o que fazer, não só o que deu errado. Não cobra. */
export function faceGateMessage(reason: string): string {
  return (
    `Essa foto não serve pro Vídeo Clone: ${reason}. ` +
    "O lip-sync precisa de um rosto olhando pra câmera, com a boca visível. " +
    "Escolha uma foto de frente (ou gere a imagem com a pessoa olhando pra câmera) e tente de novo. Você não foi cobrado."
  );
}
