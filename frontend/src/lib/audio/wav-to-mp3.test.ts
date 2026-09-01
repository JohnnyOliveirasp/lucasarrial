/**
 * Teste do conversor WAV -> MP3 (bug do header Xing ausente, ronda 23/08).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/wav-to-mp3.test.ts
 *
 * O defeito coberto: com a saída do ffmpeg em `pipe:1` (não-seekável), o
 * libmp3lame não grava o header Xing/Info e a duração ANUNCIADA do MP3 (a que
 * o player usa) diverge da duração real decodificada — o player corta o final.
 * O teste gera um WAV sintético de 40s com bitrate variável (20s de seno baixo
 * + 20s de ruído: é a variação que faz a estimativa CBR errar feio), converte
 * com a função de produção e afirma que header e decodificado batem em 0.15s.
 * No código antigo (pipe:1) este teste FALHA com ~30s de divergência.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ffmpegWavToMp3 } from "./wav-to-mp3.ts";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const RATE = 44100;
const SECONDS = 40;

/** WAV PCM s16le mono 44.1k: 20s de seno baixo + 20s de ruído determinístico. */
function syntheticWav(): Buffer {
  const n = RATE * SECONDS;
  const pcm = Buffer.alloc(n * 2);
  let seed = 123456789; // LCG determinístico — mesmo áudio em toda execução
  const lcg = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const v = t < SECONDS / 2 ? Math.sin(2 * Math.PI * 220 * t) * 0.1 : (lcg() * 2 - 1) * 0.6;
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0);
  hdr.writeUInt32LE(36 + pcm.length, 4);
  hdr.write("WAVE", 8);
  hdr.write("fmt ", 12);
  hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(1, 20); // PCM
  hdr.writeUInt16LE(1, 22); // mono
  hdr.writeUInt32LE(RATE, 24);
  hdr.writeUInt32LE(RATE * 2, 28);
  hdr.writeUInt16LE(2, 32);
  hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36);
  hdr.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([hdr, pcm]);
}

function run(cmd: string, args: string[], stdin?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => err.push(d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`));
    });
    if (stdin) {
      p.stdin.on("error", () => undefined);
      p.stdin.write(stdin);
    }
    p.stdin.end();
  });
}

/** Duração que o PLAYER vê: a do container/header (ffprobe em arquivo local). */
async function headerDuration(mp3: Buffer): Promise<number> {
  const f = join(tmpdir(), `xing-test-${randomUUID()}.mp3`);
  await writeFile(f, mp3);
  try {
    const out = await run(FFPROBE, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      f,
    ]);
    return parseFloat(out.toString());
  } finally {
    await rm(f, { force: true });
  }
}

/** Duração REAL: decodifica tudo para PCM cru e conta amostras. */
async function decodedDuration(mp3: Buffer): Promise<number> {
  const pcm = await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error",
    "-i", "pipe:0",
    "-f", "s16le", "-ac", "1", "-ar", String(RATE),
    "pipe:1",
  ], mp3);
  return pcm.length / 2 / RATE;
}

test("duração do header do MP3 bate com a duração decodificada (header Xing presente)", async () => {
  const mp3 = await ffmpegWavToMp3(syntheticWav());
  assert.ok(mp3.length > 10_000, `mp3 suspeito de vazio: ${mp3.length} bytes`);

  const header = await headerDuration(mp3);
  const decoded = await decodedDuration(mp3);

  // Sanidade: o áudio decodificado tem mesmo ~40s (o encode não perdeu nada).
  assert.ok(
    Math.abs(decoded - SECONDS) < 0.5,
    `decodificado ${decoded.toFixed(3)}s longe dos ${SECONDS}s do WAV de entrada`,
  );
  // O bug: sem header Xing, |header - decodificado| passa de dezenas de segundos.
  assert.ok(
    Math.abs(header - decoded) <= 0.15,
    `duração anunciada (${header.toFixed(3)}s) diverge da real (${decoded.toFixed(3)}s) — header Xing ausente?`,
  );
});
