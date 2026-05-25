/**
 * Finalização de uma geração de áudio. Server-only.
 *
 * Chamado tanto pelo webhook do RunPod (prod) quanto pelo polling do GET
 * /generations/[id] (dev, onde o RunPod não alcança o localhost). Centraliza:
 *   1. converter o WAV recém-subido para MP3 (ffmpeg, sem rebuild do worker)
 *   2. marcar a row como "ready" apontando audio_path pro .mp3
 *
 * Se a conversão falhar, preserva o áudio: mantém o WAV e marca ready mesmo
 * assim (melhor entregar WAV do que perder a geração).
 */
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getAdmin } from "@/lib/db/admin";
import { mp3KeyFromWav, transcodeGenerationToMp3 } from "@/lib/audio/transcode";
import { logger } from "@/lib/logger/server";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

export type GenerationOutput = {
  sample_rate?: number;
  duration_s?: number;
  elapsed_s?: number;
};

/**
 * Converte o áudio pra MP3 e marca a geração como ready.
 * @param wavAudioPath valor atual de generations.audio_path (chave R2 do WAV).
 * @returns a chave final em uso (mp3 quando a conversão deu certo).
 */
export async function finalizeGenerationSuccess(
  generationId: string,
  wavAudioPath: string | null,
  out: GenerationOutput,
): Promise<string | null> {
  let audioPath = wavAudioPath;

  if (audioPath && audioPath.toLowerCase().endsWith(".wav")) {
    try {
      audioPath = await transcodeGenerationToMp3(audioPath);
    } catch (e) {
      // Conversão falhou: se um MP3 já existe (corrida), usa ele; senão mantém WAV.
      const mp3Key = mp3KeyFromWav(wavAudioPath as string);
      const mp3Exists = await r2
        .send(new HeadObjectCommand({ Bucket: R2_BUCKETS.generations, Key: mp3Key }))
        .then(() => true)
        .catch(() => false);
      audioPath = mp3Exists ? mp3Key : wavAudioPath;
      logger.warn("api", "generation.transcode.failed", {
        generationId,
        error: e instanceof Error ? e.message : String(e),
        fallbackPath: audioPath,
      });
    }
  }

  await getAdmin()
    .from("generations")
    .update({
      status: "ready",
      audio_path: audioPath,
      sample_rate: out.sample_rate ?? null,
      duration_seconds: out.duration_s ?? null,
      elapsed_seconds: out.elapsed_s ?? null,
      error_message: null,
    } as never)
    .eq("id", generationId);

  return audioPath;
}
