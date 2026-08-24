/**
 * Onboarding — aluno mandou VÍDEO em vez de fotos (padrão do lote 1, 14/08:
 * 10/10 linhas tinham 1 vídeo de 165-304MB como "fotos"). É o que o time
 * fazia na mão: tirar prints do vídeo. Aqui o ffmpeg extrai 3 frames
 * espalhados (15%/45%/75% da duração) e eles viram as fotos de referência.
 * ffmpeg já existe no servidor (mesmo binário do recorder-test/upload).
 */
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirTemporario } from "./tmp";
import { tmpdir } from "node:os";
import { join } from "node:path";

const POSICOES = [0.15, 0.45, 0.75];

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exit ${code}: ${err.slice(0, 200)}`)),
    );
  });
}

/** Extrai até 3 frames JPEG de um vídeo JÁ em disco (streaming — A248). */
export async function extrairFramesDeArquivo(src: string): Promise<Buffer[]> {
  const dir = await dirTemporario("onbvid-");
  try {
    const durStr = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src,
    ]);
    const dur = parseFloat(durStr) || 0;
    if (dur < 1) throw new Error("vídeo sem duração legível");

    const frames: Buffer[] = [];
    for (let i = 0; i < POSICOES.length; i++) {
      const t = Math.max(0.5, dur * POSICOES[i]);
      const out = join(dir, `frame_${i}.jpg`);
      await run("ffmpeg", [
        "-y", "-loglevel", "error", "-ss", t.toFixed(2), "-i", src,
        "-frames:v", "1", "-q:v", "2", out,
      ]);
      frames.push(await readFile(out));
    }
    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Compat: extrai frames de um Buffer (grava temp e delega). */
export async function extrairFramesDeVideo(videoBytes: Buffer): Promise<Buffer[]> {
  const dir = await dirTemporario("onbvidbuf-");
  try {
    const src = join(dir, "video.bin");
    await writeFile(src, videoBytes);
    return await extrairFramesDeArquivo(src);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
