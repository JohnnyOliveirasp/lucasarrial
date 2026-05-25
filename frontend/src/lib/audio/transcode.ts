/**
 * Transcodifica o áudio gerado (WAV) para MP3 no R2. Server-only.
 *
 * O worker RunPod sobe o resultado da inferência como WAV (audio/wav). Para
 * entregar MP3 ao usuário (arquivo menor, compatibilidade ampla) SEM rebuild do
 * container, a conversão acontece aqui, no backend Next.js, via ffmpeg.
 *
 * Espelha `convert_wav_to_mp3` do VoiceLoraStudio:
 *   ffmpeg -i <wav> -codec:a libmp3lame -qscale:a 2 <mp3>   (~190 kbps VBR)
 *
 * Idempotente: se o MP3 já existe, não reconverte.
 */
import { spawn } from "node:child_process";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { deleteKeys } from "@/lib/r2/delete";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const QSCALE = "2"; // 0 (melhor) .. 9 (pior); 2 ≈ 190 kbps VBR

/** Deriva a chave .mp3 a partir da .wav. Retorna a mesma chave se não for .wav. */
export function mp3KeyFromWav(wavKey: string): string {
  return wavKey.replace(/\.wav$/i, ".mp3");
}

async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** WAV buffer -> MP3 buffer via ffmpeg (pipe stdin->stdout, sem arquivo temp). */
function ffmpegWavToMp3(wav: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
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
      "pipe:1",
    ];
    const proc = spawn(FFMPEG, args);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => out.push(d));
    proc.stderr.on("data", (d: Buffer) => err.push(d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`));
    });
    proc.stdin.on("error", () => {
      /* EPIPE se o ffmpeg morrer antes — o 'close' já reporta o erro real */
    });
    proc.stdin.write(wav);
    proc.stdin.end();
  });
}

/**
 * Converte o WAV de uma geração para MP3 no bucket de generations.
 * Retorna a chave final (.mp3). Idempotente e tolerante a corrida
 * webhook+polling: se o MP3 já existe, reaproveita.
 */
export async function transcodeGenerationToMp3(wavKey: string): Promise<string> {
  const bucket = R2_BUCKETS.generations;
  const mp3Key = mp3KeyFromWav(wavKey);
  if (mp3Key === wavKey) return wavKey; // não era .wav

  // Já convertido por outro caller (webhook x polling)?
  if (await objectExists(bucket, mp3Key)) {
    await deleteKeys(bucket, [wavKey]).catch(() => 0);
    return mp3Key;
  }

  const got = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: wavKey }));
  if (!got.Body) throw new Error(`R2 object sem corpo: ${wavKey}`);
  const wavBuf = Buffer.from(await got.Body.transformToByteArray());

  const mp3Buf = await ffmpegWavToMp3(wavBuf);

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: mp3Key,
      Body: mp3Buf,
      ContentType: "audio/mpeg",
    }),
  );

  await deleteKeys(bucket, [wavKey]).catch(() => 0);
  return mp3Key;
}
