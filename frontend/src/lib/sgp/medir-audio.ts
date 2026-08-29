/**
 * SGP tela 3 — mede a QUALIDADE de um áudio de treino antes de aceitar.
 * Hoje o app só media duração no browser; aqui (decisão 29/08) cada arquivo
 * sai ✅/❌ com motivo:
 *   1. duração REAL por decode (mp3 VBR mente no header — lição 17/08)
 *   2. volume: mudo/muito baixo (caso Fernanda, −91 dB) ou estourado
 *   3. silêncio: % do arquivo sem fala — só a fala conta pros minutos
 *   4. idioma: Whisper nos primeiros 45s precisa ouvir português
 * Limite declarado: "duas vozes" (caso marcelo) NÃO é medido nesta versão —
 * diarização confiável é cara; entra depois como alerta.
 *
 * Um único passe de ffmpeg (volumedetect + silencedetect) + 1 clipe curto pro
 * Whisper. Roda em `dirTemporario` (NUNCA /tmp: no Hetzner é RAM). Nunca lança
 * por causa do arquivo — falha de infra vira `indeciso`.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { dirTemporario } from "@/lib/onboarding/tmp";

const exec = promisify(execFile);

const MUDO_DB = -45; // média abaixo disso = praticamente silêncio
const ESTOURADO_DB = -0.3; // pico encostado em 0 dBFS = clipping
const SILENCIO_MAX = 0.6; // mais de 60% do arquivo sem fala
const SILENCE_THRESHOLD = "-35dB";
const CLIPE_IDIOMA_S = 45;

export type Medicao = {
  segundos: number;
  falaSegundos: number;
  meanDb: number | null;
  maxDb: number | null;
  idioma: string | null;
  aprovado: boolean;
  motivos: string[];
  indeciso?: boolean;
};

export async function medirAudio(key: string): Promise<Medicao> {
  const dir = await dirTemporario("sgp-audio-");
  try {
    const bytes = await baixar(key);
    const entrada = join(dir, "in" + (key.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".bin"));
    await writeFile(entrada, bytes);

    const { stderr } = await exec(
      "ffmpeg",
      ["-v", "info", "-i", entrada, "-af", `volumedetect,silencedetect=n=${SILENCE_THRESHOLD}:d=0.6`, "-f", "null", "-"],
      { timeout: 10 * 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const log = String(stderr);
    const segundos = duracaoDoLog(log);
    if (!segundos) return { ...vazio(), aprovado: false, motivos: ["não conseguimos abrir este áudio"] };

    const meanDb = numero(log, /mean_volume:\s*(-?[\d.]+) dB/);
    const maxDb = numero(log, /max_volume:\s*(-?[\d.]+) dB/);
    const silencio = [...log.matchAll(/silence_duration:\s*([\d.]+)/g)].reduce((a, m) => a + Number(m[1]), 0);
    const falaSegundos = Math.max(0, segundos - silencio);

    const motivos: string[] = [];
    if (meanDb !== null && meanDb < MUDO_DB) motivos.push("áudio mudo ou volume muito baixo");
    else if (maxDb !== null && maxDb > ESTOURADO_DB) motivos.push("volume estourado (distorcendo)");
    if (segundos > 30 && silencio / segundos > SILENCIO_MAX) motivos.push("mais da metade do arquivo é silêncio");

    let idioma: string | null = null;
    if (motivos.length === 0) {
      idioma = await idiomaDoClipe(entrada, join(dir, "clipe.mp3"));
      if (idioma && idioma !== "pt" && idioma !== "portuguese") motivos.push(`a fala não está em português (${idioma})`);
    }

    return { segundos, falaSegundos, meanDb, maxDb, idioma, aprovado: motivos.length === 0, motivos };
  } catch (e) {
    console.error("[sgp/medir-audio] falhou:", e instanceof Error ? e.message : e);
    return { ...vazio(), indeciso: true };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function vazio(): Medicao {
  return { segundos: 0, falaSegundos: 0, meanDb: null, maxDb: null, idioma: null, aprovado: false, motivos: [] };
}

async function baixar(key: string): Promise<Uint8Array> {
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKETS.voices, Key: key }));
  if (!res.Body) throw new Error("objeto sem corpo");
  return res.Body.transformToByteArray();
}

function duracaoDoLog(log: string): number {
  const m = [...log.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function numero(log: string, re: RegExp): number | null {
  const m = log.match(re);
  return m ? Number(m[1]) : null;
}

/** Whisper sem `language` forçado devolve o idioma detectado em `verbose_json`. */
async function idiomaDoClipe(entrada: string, clipe: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    await exec("ffmpeg", ["-v", "error", "-i", entrada, "-t", String(CLIPE_IDIOMA_S), "-ac", "1", "-ar", "16000", "-b:a", "48k", "-y", clipe], {
      timeout: 60_000,
    });
    const form = new FormData();
    form.append("file", new Blob([await readFile(clipe)]), "clipe.mp3");
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { language?: string };
    return (json.language ?? "").toLowerCase() || null;
  } catch {
    return null;
  }
}
