/**
 * Transcrição com timestamp POR PALAVRA (Whisper API OpenAI) — server-only.
 * Porte do whisperApiTimings do render/subtitles.mjs (worker Node antigo) pra
 * dentro do app: o wizard W5 precisa das words de um áudio do R2 pra queimar
 * legenda karaokê num MP4 pronto (job caption_burn). Os timestamps casam 1:1
 * com o vídeo porque o áudio É o que gerou o vídeo (invariante do wizard).
 */
import { createPresignedGet } from "@/lib/r2/presigned";

export type CaptionWord = { word: string; start: number; end: number };

/** Baixa o áudio do R2 e devolve words[] do Whisper. Lança em erro. */
export async function transcribeWords(bucket: string, key: string): Promise<CaptionWord[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");

  const url = await createPresignedGet(bucket, key, 600);
  const audio = await fetch(url, { cache: "no-store" });
  if (!audio.ok) throw new Error(`download do áudio: ${audio.status}`);
  const buf = Buffer.from(await audio.arrayBuffer());

  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { words?: { word?: unknown; start?: unknown; end?: unknown }[] };
  const words = (Array.isArray(json.words) ? json.words : [])
    .filter(
      (w): w is { word: string; start: number; end: number } =>
        typeof w.word === "string" && Number.isFinite(w.start) && Number.isFinite(w.end),
    )
    .map((w) => ({ word: w.word.trim(), start: w.start, end: w.end }))
    .filter((w) => w.word.length > 0);
  if (words.length === 0) throw new Error("Whisper não devolveu palavras");
  return words;
}
