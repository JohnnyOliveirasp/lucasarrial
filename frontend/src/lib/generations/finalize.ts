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
  /** Telemetria do QA do worker (mig 94, #52): echo/coverage/intrusion/regens/rescue. */
  qa?: Record<string, unknown>;
  coverage_failed_chunk?: number;
  coverage_best?: number;
  coverage_min?: number;
};

/** O que vai pra `generations.qa` — o bloco `qa` + os campos coverage_* da falha. */
export function qaTelemetria(out: GenerationOutput): Record<string, unknown> | null {
  const extra: Record<string, unknown> = {};
  if (typeof out.coverage_failed_chunk === "number") extra.coverage_failed_chunk = out.coverage_failed_chunk;
  if (typeof out.coverage_best === "number") extra.coverage_best = out.coverage_best;
  if (typeof out.coverage_min === "number") extra.coverage_min = out.coverage_min;
  if (!out.qa && Object.keys(extra).length === 0) return null;
  return { ...(out.qa ?? {}), ...extra };
}

/**
 * Teto FÍSICO de letras por segundo. Acima disso o áudio não contém o texto —
 * ninguém fala tão rápido.
 *
 * Medido na própria base (2.189 gerações em 30 dias): a média real é ~16,5
 * letras/s e o pior caso legítimo bate em ~31. O corte em 28 pega o áudio
 * truncado sem encostar em quem fala rápido; na prática, 4 gerações em 2.189
 * (0,18%) ficaram acima disso — e duas eram a mesma frase da mesma aluna.
 *
 * O padrão é o modelo PARAR CEDO DEMAIS, e acontece quase só em texto curto:
 * nos textos de até 39 letras o pior caso chegou a 62,9 letras/s (o dobro de
 * qualquer outra faixa). Com frase curta o modelo tem pouca informação pra
 * acertar onde parar de falar. Caso Katia, 18/08: "Bem-vinda ao Portal da
 * Morgana" (30 letras) saiu com 0,477s — deveria dar ~1,8s.
 */
const MAX_LETRAS_POR_SEGUNDO = 28;

/**
 * O áudio é curto demais pro texto que deveria conter?
 *
 * Só decide quando tem os dois números; sem duração ou sem texto, não opina —
 * `false` aqui significa "não sei", e entregar é melhor que recusar às cegas.
 * Texto muito curto (< 12 letras) fica de fora: "Oi!" legitimamente dá uma
 * fração de segundo e a razão explode sem haver problema.
 */
export function audioCurtoDemais(texto: string | null, duracaoSegundos: number | null): boolean {
  if (!texto || !duracaoSegundos || duracaoSegundos <= 0) return false;
  const letras = texto.trim().length;
  if (letras < 12) return false;
  return letras / duracaoSegundos > MAX_LETRAS_POR_SEGUNDO;
}

/** Texto que a geração deveria conter (o normalizado é o que foi falado). */
async function textoDaGeracao(generationId: string): Promise<string | null> {
  const { data } = await getAdmin()
    .from("generations")
    .select("text_normalized, text_raw")
    .eq("id", generationId)
    .maybeSingle();
  const row = data as { text_normalized: string | null; text_raw: string | null } | null;
  return row?.text_normalized ?? row?.text_raw ?? null;
}

/**
 * Converte o áudio pra MP3 e marca a geração como ready.
 * Devolve `null` quando o áudio saiu CURTO DEMAIS pro texto — nesse caso nada
 * é marcado como ready e o chamador deve tratar como falha (com estorno).
 * @param wavAudioPath valor atual de generations.audio_path (chave R2 do WAV).
 * @returns a chave final em uso (mp3 quando a conversão deu certo).
 */
export async function finalizeGenerationSuccess(
  generationId: string,
  wavAudioPath: string | null,
  out: GenerationOutput,
): Promise<string | null> {
  // ✂️ ÁUDIO CORTADO NÃO É ENTREGA (19/08). O worker devolve COMPLETED mesmo
  // quando o modelo parou cedo e o áudio não contém o texto todo — a aluna
  // recebia meio segundo de som, era cobrada, e a gente só descobria se ela
  // reclamasse. Aqui a gente pega antes de marcar ready: devolve `null`, o
  // chamador trata como falha, e o estorno segue o caminho normal.
  const texto = await textoDaGeracao(generationId);
  if (audioCurtoDemais(texto, out.duration_s ?? null)) {
    logger.warn("api", "generation.audio.truncado", {
      generationId,
      letras: texto?.trim().length ?? 0,
      duracaoSegundos: out.duration_s ?? null,
    });
    return null;
  }

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
      qa: qaTelemetria(out),
      error_message: null,
    } as never)
    .eq("id", generationId);

  return audioPath;
}
