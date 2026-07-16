/**
 * Transcrição (Whisper API) de um áudio ENVIADO pelo usuário pro wizard de
 * vídeo. Server-only. Devolve o texto (vira `script_text` — as cenas nascem
 * dele) e a DURAÇÃO REAL medida pelo Whisper — validação server-side do teto
 * de 90s (o browser já valida antes do upload, mas aqui é à prova de burla).
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

export type Transcription = { text: string; durationSeconds: number };

/** Baixa o objeto do bucket de generations e devolve os bytes. */
async function downloadAudio(key: string): Promise<Uint8Array> {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKETS.generations, Key: key }),
  );
  if (!res.Body) throw new Error("Audio object has no body");
  return res.Body.transformToByteArray();
}

/**
 * Whisper `verbose_json` traz `duration` (segundos) + `text`.
 * Mesmo padrão do worker de render (render/subtitles.mjs).
 */
export async function transcribeUploadedAudio(key: string): Promise<Transcription> {
  const bytes = await downloadAudio(key);
  return transcribeAudioBuffer(bytes, key.split("/").pop() || "audio.mp3");
}

/** Transcreve bytes de áudio direto (usado também pelo agente de suporte). */
export async function transcribeAudioBuffer(
  bytes: Uint8Array,
  filename: string,
  /** ISO-639-1 ("pt" | "es" | "en"...) — default pt, comportamento inalterado. */
  language = "pt",
): Promise<Transcription> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const form = new FormData();
  form.append("file", new Blob([Buffer.from(bytes)]), filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("language", language);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string; duration?: number };

  return {
    text: (json.text ?? "").trim(),
    durationSeconds: Number.isFinite(json.duration) ? Number(json.duration) : 0,
  };
}
