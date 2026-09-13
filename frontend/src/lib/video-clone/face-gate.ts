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

/**
 * POR QUE o gate deixou passar sem olhar (#372). Antes era só `skipped: true`,
 * o que juntava três coisas muito diferentes num booleano: escolha nossa,
 * configuração faltando e detector caído. A distinção importa porque só as
 * duas últimas são CEGUEIRA — e cegueira é o que precisa virar linha na
 * `face_gate_recusas`.
 *
 * `presign_falhou` não nasce aqui: é da rota, que nem chega a chamar esta
 * função quando não consegue a URL assinada. Mora no tipo porque é a mesma
 * classe de evento e o rastro trata os três igual.
 */
export type FaceGateSkip =
  /** `VIDEO_CLONE_FACE_GATE=0`. Desligamos de propósito. */
  | "desligado"
  /** Sem `ANTHROPIC_API_KEY`. Não é escolha: é configuração faltando. */
  | "sem_api_key"
  /** A visão foi chamada e não respondeu direito (HTTP, timeout, JSON torto). */
  | "falha_tecnica"
  /** A rota não conseguiu a URL assinada da imagem — a visão nem foi chamada. */
  | "presign_falhou";

export type FaceGateResult =
  /**
   * `skipped` ausente = a visão OLHOU e aprovou. `skipped` presente = NINGUÉM
   * olhou e o fail-open deixou passar. Os dois são `ok: true` pro fluxo, mas
   * só o primeiro é uma aprovação de verdade.
   */
  | { ok: true; skipped?: FaceGateSkip; erro?: string }
  | { ok: false; reason: string };

export async function checkFrontalFace(imageUrl: string): Promise<FaceGateResult> {
  if (process.env.VIDEO_CLONE_FACE_GATE === "0") return { ok: true, skipped: "desligado" };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: true, skipped: "sem_api_key" };

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
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[video-clone/face-gate] visão falhou (fail-open):", erro);
    // `erro` sobe junto pro rastro: "falha_tecnica" sozinho não distingue
    // timeout de 429 de JSON torto, e é essa distinção que diz se vale
    // retentar ou se o modelo mudou de comportamento.
    return { ok: true, skipped: "falha_tecnica", erro };
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
