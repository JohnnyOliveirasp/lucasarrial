/**
 * Conversão WAV -> MP3 via ffmpeg. Server-only, sem dependência de R2
 * (módulo puro, testável com `node --test`).
 *
 * POR QUE A SAÍDA VAI PARA ARQUIVO TEMPORÁRIO, E NÃO `pipe:1`:
 * o libmp3lame só consegue gravar o header Xing/Info (obrigatório para VBR)
 * se puder fazer seek de volta ao início do arquivo no fim do encode. Um pipe
 * não é seekável, então o MP3 sai SEM o header — e o player estima a duração
 * pelo bitrate do primeiro frame assumindo CBR. Como `-qscale:a 2` é VBR, a
 * estimativa erra proporcionalmente ao tamanho do áudio (caso real: geração
 * de 36.7s anunciando 31.7s; o player corta o final). A ENTRADA pode continuar
 * em `pipe:0` — só a saída precisa ser seekável.
 *
 * Coberto por wav-to-mp3.test.ts: duração do header == duração decodificada.
 */
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const QSCALE = "2"; // 0 (melhor) .. 9 (pior); 2 ≈ 190 kbps VBR

/** WAV buffer -> MP3 buffer via ffmpeg (stdin em pipe; saída em temp seekável). */
export function ffmpegWavToMp3(wav: Buffer): Promise<Buffer> {
  const tmpPath = join(tmpdir(), `wav2mp3-${randomUUID()}.mp3`);
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    "pipe:0",
    "-codec:a",
    "libmp3lame",
    "-qscale:a",
    QSCALE,
    "-f",
    "mp3",
    tmpPath,
  ];
  return new Promise<Buffer>((resolve, reject) => {
    const proc = spawn(FFMPEG, args);
    const err: Buffer[] = [];
    proc.stderr.on("data", (d: Buffer) => err.push(d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        readFile(tmpPath).then(resolve, reject);
      } else {
        reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`));
      }
    });
    proc.stdin.on("error", () => {
      /* EPIPE se o ffmpeg morrer antes — o 'close' já reporta o erro real */
    });
    proc.stdin.write(wav);
    proc.stdin.end();
  }).finally(() => rm(tmpPath, { force: true }).catch(() => undefined));
}
