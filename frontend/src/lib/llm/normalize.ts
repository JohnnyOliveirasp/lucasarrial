/**
 * Normalização de texto para TTS via Claude Haiku (server-side).
 *
 * Expande números, moeda, abreviações, datas e símbolos em palavras faladas
 * pt-BR ANTES de mandar pro modelo de voz (o VoxCPM lê texto cru e gagueja em
 * "R$ 50" / "2026" / "Dr."). Roda no backend Next.js — sem rebuild do worker.
 *
 * Falha graciosamente: se ANTHROPIC_API_KEY não estiver setada ou a chamada
 * falhar/expirar, retorna o texto original (NUNCA bloqueia a geração).
 *
 * Usa fetch direto (sem @anthropic-ai/sdk) pra não exigir instalar dependência.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5"; // rápido e barato — ideal pra normalização
const TIMEOUT_MS = 15_000;

const SYSTEM = `Você normaliza texto para síntese de voz (TTS). O texto do
usuário pode estar em português, espanhol ou inglês: detecte o idioma e
normalize NO MESMO idioma — NUNCA traduza, NUNCA comente sobre o idioma.
Os exemplos abaixo são em pt-BR; para espanhol/inglês, aplique as mesmas regras
com a grafia falada daquele idioma (ex.: "42" -> "forty-two" / "cuarenta y dos").
Reescreva o texto do usuário expandindo tudo que não se fala literalmente:
- Números: "42" -> "quarenta e dois"; ano "2026" -> "dois mil e vinte e seis"
- Moeda: "R$ 50,90" -> "cinquenta reais e noventa centavos"
- Porcentagem: "30%" -> "trinta por cento"
- Datas e horas: "14/03" -> "quatorze de março"; "08:30" -> "oito e trinta"
- Abreviações: "Dr." -> "Doutor"; "Sra." -> "Senhora"; "etc." -> "etcétera"
- Símbolos: "&" -> "e"; "@" -> "arroba"; "#" -> "número"; "/" em medidas -> "por"
- Unidades: "5kg" -> "cinco quilos"; "10km" -> "dez quilômetros"
- Estrangeirismos (SÓ quando o texto é em português) em inglês que NÃO têm forma portuguesa: reescreva pela
  pronúncia aportuguesada. Ex.: "reels" -> "ríuls"; "influencer" -> "influéncer";
  "stories" -> "estóris"; "feed" -> "fíid"; "marketing" -> "márketin"; "design"
  -> "dizáin"; "post"/"posts" (o substantivo inglês) -> "póust"/"póusts".
  ATENÇÃO: palavras já incorporadas ao português ficam com a grafia NORMAL — não
  mexa em "postar/posta/postou", "vídeo", "digital", "online", "celular", "mídia"
  nem em verbos e adjetivos do português. Na dúvida, NÃO altere.
  NÃO toque em nomes próprios nem em siglas que se soletram (ex.: "IA", "CEO").
- Palavras longas ou técnicas que o sintetizador costuma "engolir" (trocar ou
  comer a sílaba final): reescreva preservando TODAS as sílabas e o MESMO som,
  trocando só "g" por "j" antes de e/i quando ajudar. Ex.: "cardiologista" ->
  "cardiolojista"; "otorrinolaringologista" -> "otorrinolaringolojista". Não use
  isso em palavras curtas/comuns que o sintetizador já fala bem.
Preserve o sentido, a pontuação e a ordem das frases. NÃO traduza frases, NÃO
resuma, NÃO adicione comentários ou explicações. A reescrita fonética vale só
para estrangeirismos sem forma portuguesa e termos técnicos longos — o resto do
texto em português permanece com a grafia normal.
Responda APENAS com o texto normalizado — sem aspas, sem preâmbulo.`;

type AnthropicBlock = { type: string; text?: string };

/**
 * Retorna o texto normalizado para fala, ou o texto original em caso de
 * ausência de API key / erro / timeout.
 */
export async function normalizeTextForTTS(text: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return text; // normalização desativada sem key

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
        max_tokens: 2048,
        // system estável + cache_control (prefix caching quando crescer)
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: text }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return text;

    const data = (await res.json()) as { content?: AnthropicBlock[] };
    const out = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("")
      .trim();

    return out || text;
  } catch {
    return text; // timeout, rede, parse — sempre cai pro texto cru
  }
}
