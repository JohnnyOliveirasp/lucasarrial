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

/**
 * Determinismo (#371). O corpo NÃO mandava `temperature` e o default da API é
 * 1.0 — um classificador binário que decide se o aluno pode usar um produto
 * pago estava sorteando. Medido em 13/09 nas imagens da Alice, 3 chamadas
 * cada: DUAS imagens deram vereditos diferentes entre chamadas da MESMA
 * imagem, e duas das "7" são byte a byte o mesmo arquivo (md5 igual) com
 * placar diferente — 0/3 numa e 1/3 na outra.
 * ⚠️ `temperature: 0` não é garantia matemática (a inferência não é
 * bit-determinística), é a única alavanca que existe. A régua que mede é
 * `_Bugs/2026-09-13_gate371_determinismo.cjs`, 5 rodadas por imagem.
 */
const TEMPERATURE = 0;

/**
 * O SYSTEM anterior tinha dois defeitos medidos, além da temperatura:
 *
 * 1. ANCORAGEM. Trazia UM exemplo de reason — "a pessoa está olhando pra
 *    baixo, pra tábua na mesa" — e as 17 recusas das 21 chamadas do teste
 *    diziam TODAS "olhando para baixo", inclusive em foto com o olhar cravado
 *    na lente. O modelo repetia o exemplo. Agora não há exemplo de frase.
 *
 * 2. CONTRADIÇÃO. Dizia "up to ~30° of yaw/pitch is fine" e, na mesma frase,
 *    reprovava "looking down at something". Queixo recolhido cabe nos 30° e
 *    mesmo assim caía na cláusula categórica — foi o que barrou a Alice 6
 *    vezes em 6h. Resolvido separando POSE DA CABEÇA de DIREÇÃO DO OLHAR:
 *    inclinação até ~30° com o olhar na lente PASSA; o que reprova é o olhar
 *    preso num objeto fora do quadro — o caso Itamar do #131, que é a razão
 *    de o portão existir — e não o queixo.
 *
 * ⚠️ A cláusula do olhar é o que segura o controle negativo. Sem ela, a
 * imagem do #131 (rosto quase de frente, boca visível, olhos na tábua)
 * PASSARIA e o portão viraria enfeite. Medido: ver a tabela do PR.
 */
const SYSTEM = `You inspect ONE photo that will be used for lip-sync video (the mouth will be animated to speech).
Answer ONLY a JSON object: {"frontal": true|false, "mouth_visible": true|false, "reason": "<short, in Brazilian Portuguese>"}.

"frontal" = the main person's face is turned toward the camera AND their attention is on the camera.
Judge head pose and GAZE as two separate things. A tucked chin is not the same as looking away.
  frontal = true (all of these are acceptable, do not reject them):
   - head rotated or tilted up to ~30 degrees of yaw/pitch/roll;
   - chin tucked down, or the camera held above eye level, WHILE the eyes still look into the lens — this is an ordinary selfie and it PASSES;
   - eyes half-closed or narrowed, serious or neutral expression, mouth closed;
   - very tight close-up, or the face small in the frame.
  frontal = false:
   - profile or near-profile: the face is turned more than ~30 degrees and one side of it is hidden;
   - back of the head, or no clear human face in the photo;
   - the eyes are clearly fixed on something off-camera (an object in the hands, a screen, a window, another person) — decide this by where the EYES point, not by the chin;
   - the head is turned so far down or up that the eyes or the mouth are no longer visible.

"mouth_visible" = the mouth is visible and not covered by a hand, mask, microphone, object, hair, or deep shadow.

Judge ONLY the two axes above. Do not reject for lighting, background, clothing, makeup, image quality, framing, or how large the face is in the frame.

"reason" = one short sentence in Brazilian Portuguese describing what YOU see wrong in THIS photo, specific enough for the person to act on it. Do not reuse a generic phrase.`;

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
        temperature: TEMPERATURE,
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
