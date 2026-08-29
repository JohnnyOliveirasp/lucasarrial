/**
 * Onboarding — o aluno mandou VÍDEO como fonte de áudio, e o vídeo é grande.
 *
 * Por que existe (29/08, medido no caso Johnathan / incidente #180): a pasta
 * dele tinha 15 `.mp4` de gravações do próprio YouTube, somando ~45GB. O
 * caminho de áudio baixa cada arquivo INTEIRO pra um Buffer com teto de
 * `MAX_AUDIO_BYTES` (400MB), então **8 dos 15 eram descartados por tamanho** —
 * entre eles um de 490MB que sozinho tem **28min22s de fala**, ou seja, sozinho
 * abriria a porta de 20min. Os 7 que cabiam somam **19min15s**: o aluno era
 * reprovado por **45 segundos** e lia "seu áudio é curto, grave mais".
 *
 * O lado das FOTOS já resolvia isso desde 14/08 (`video-frames.ts`: vídeo
 * grande → streaming pro disco → ffmpeg extrai). O lado do ÁUDIO nunca ganhou
 * o equivalente. Este arquivo é esse equivalente: a faixa de áudio de um vídeo
 * de 10GB tem dezenas de MB — o que não cabe é o VÍDEO, não a voz do aluno.
 *
 * Sempre em disco, nunca Buffer gigante na RAM (mesma lição do A248, 878MB).
 * Copia a faixa sem reencodar quando dá (`-c:a copy`): o áudio do aluno chega
 * ao treino bit a bit como ele gravou. Só reencoda quando o codec não tem
 * contêiner óbvio, e aí é mp3 mono — o que o treino usa de qualquer jeito.
 */
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { dirTemporario } from "./tmp";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

/** Teto do ffmpeg por arquivo — a extração nunca pode travar a linha inteira. */
const EXTRACAO_TIMEOUT_MS = 240_000;

/**
 * Codec da faixa → contêiner que aceita `-c:a copy`. Fora desta tabela a
 * cópia crua não é segura e a gente reencoda pra mp3.
 */
const CONTAINER_POR_CODEC: Record<string, { ext: string; mime: string }> = {
  aac: { ext: "m4a", mime: "audio/mp4" },
  mp3: { ext: "mp3", mime: "audio/mpeg" },
  opus: { ext: "ogg", mime: "audio/ogg" },
  vorbis: { ext: "ogg", mime: "audio/ogg" },
  flac: { ext: "flac", mime: "audio/flac" },
};

export type AudioExtraido = { bytes: Buffer; ext: string; mime: string; reencodado: boolean };

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`${cmd} passou de ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(out.trim())
        : reject(new Error(`${cmd} exit ${code}: ${err.slice(-200)}`));
    });
  });
}

/** Codec da PRIMEIRA faixa de áudio do arquivo, ou null se não houver faixa. */
async function codecDeAudio(src: string): Promise<string | null> {
  const saida = await run(
    FFPROBE,
    [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name",
      "-of", "csv=p=0",
      src,
    ],
    60_000,
  );
  const codec = saida.split(/\s+/)[0]?.trim().toLowerCase();
  return codec ? codec : null;
}

/**
 * Extrai a faixa de áudio de um arquivo JÁ em disco.
 *
 * Lança quando o arquivo não tem faixa de áudio nenhuma — quem chama trata
 * como "não é áudio" e o arquivo vira `ignored`, não derruba a voz.
 */
export async function extrairAudioDeArquivo(src: string): Promise<AudioExtraido> {
  const codec = await codecDeAudio(src);
  if (!codec) throw new Error("o arquivo não tem faixa de áudio");

  const dir = await dirTemporario("onbaud-");
  try {
    const alvo = CONTAINER_POR_CODEC[codec];
    if (alvo) {
      const out = join(dir, `audio.${alvo.ext}`);
      try {
        // `-vn` derruba o vídeo, `-c:a copy` não reencoda: o que sai é a
        // mesma faixa que estava dentro do mp4, sem perda e em segundos.
        await run(FFMPEG, ["-y", "-loglevel", "error", "-i", src, "-vn", "-c:a", "copy", out], EXTRACAO_TIMEOUT_MS);
        const bytes = await readFile(out);
        if (bytes.length > 0) {
          return { bytes, ext: alvo.ext, mime: alvo.mime, reencodado: false };
        }
      } catch {
        // Contêiner recusou a cópia crua (fluxo raro, ex.: aac com header
        // exótico) — cai no reencode abaixo em vez de perder o áudio.
      }
    }
    const out = join(dir, "audio.mp3");
    await run(
      FFMPEG,
      ["-y", "-loglevel", "error", "-i", src, "-vn", "-ac", "1", "-c:a", "libmp3lame", "-q:a", "2", out],
      EXTRACAO_TIMEOUT_MS,
    );
    const bytes = await readFile(out);
    if (bytes.length === 0) throw new Error("a extração de áudio saiu vazia");
    return { bytes, ext: "mp3", mime: "audio/mpeg", reencodado: true };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
