/** SOMENTE LEITURA — mede tokens do gate via count_tokens (endpoint GRATUITO). */
const { supa, r2, BUCKETS, urlAssinada } = require("./_comum.cjs");

const SYS_ATUAL = `You inspect ONE photo that will be used for lip-sync video (the mouth will be animated to speech).
Answer ONLY a JSON object: {"frontal": true|false, "mouth_visible": true|false, "reason": "<short, in Brazilian Portuguese>"}.
"frontal" = the main person's face is turned toward the camera (up to ~30 of yaw/pitch is fine); false if in profile, looking down at something, head tilted away, back of head, or no clear human face.
"mouth_visible" = the mouth is visible and not covered (hand, mask, microphone, object, hair, extreme angle).
"reason" explains, in one short sentence a user can act on, why it fails.`;

const SYS_PROPOSTO = SYS_ATUAL + `
"face_height_ratio" = fraction (0.0-1.0) of the IMAGE HEIGHT occupied by the head, chin to top of hair.
"gaze" = "camera" | "tres_quartos_esq" | "tres_quartos_dir" | "perfil" | "baixo" | "cima" | "outro".`;

async function contar(apiKey, system, url) {
  const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      system,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: url.mt, data: url.b64 } },
        { type: "text", text: "Inspect this photo. JSON only." },
      ] }],
    }),
  });
  const j = await res.json();
  return j.input_tokens ?? JSON.stringify(j);
}

(async () => {
  const db = supa();
  const { data } = await db.from("sgp_pedidos").select("fotos").not("fotos", "eq", "[]").limit(20);
  const key = (data ?? []).flatMap((p) => p.fotos ?? []).map((f) => f.key).find(Boolean);
  if (!key) return console.log("sem foto pra medir");
  const signed = await urlAssinada(BUCKETS.imagens(), key, 600);
  const r = await fetch(signed);
  const buf = Buffer.from(await r.arrayBuffer());
  const url = { mt: r.headers.get("content-type") || "image/jpeg", b64: buf.toString("base64") };
  console.log("bytes da foto:", buf.length, "| mime:", url.mt);
  const k = process.env.ANTHROPIC_API_KEY;
  const a = await contar(k, SYS_ATUAL, url);
  const b = await contar(k, SYS_PROPOSTO, url);
  console.log("foto medida (chave ocultada):", key.slice(0, 18) + "...");
  console.log("input_tokens system ATUAL   :", a);
  console.log("input_tokens system PROPOSTO:", b);
  console.log("delta de ENTRADA por chamada:", b - a, "tokens");
})();
