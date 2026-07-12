/**
 * Vídeo Estúdio F4 — rosto do aluno nos pontos-âncora. Server-only.
 *
 * Regra C3 do export: o hook abre com uma PESSOA visível; o fechamento também
 * é âncora deliberada. v1: rosto na PRIMEIRA e na ÚLTIMA frase do áudio limpo.
 *
 * Fluxo: corta os 2 trechos do áudio limpo (ffmpeg no servidor, pipe — mesmo
 * padrão do transcode) → sobe pro R2 → 2 jobs InfiniteTalk TURBO (endpoint
 * próprio do Vídeo Clone, foto do aluno) → comfy worker grava o MP4 direto no
 * R2 → sync no poll do GET até os 2 ficarem prontos.
 */
import { spawn } from "node:child_process";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS, imagesBucket } from "@/lib/r2/client";
import { getAdmin } from "@/lib/db/admin";
import { createPresignedGet } from "@/lib/r2/presigned";
import { buildInfiniteTalkWorkflow } from "@/lib/video-clone/workflow";
import { runInfiniteTalk, getInfiniteTalkStatus } from "@/lib/video-clone/runpod";
import { cloneExecutionTimeoutMs, getCloneTier } from "@/lib/video-clone/config";
import { STUDIO_FACE_TIER_ID, sentencesWithTimes } from "@/lib/studio/pricing";
import { handleTechFailure } from "@/lib/support/failure-alert";
import type { StudioTranscriptWord } from "@/lib/db/types";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

export type FaceSegment = {
  role: "hook" | "close";
  sentence: number;
  start: number;
  end: number;
  audio_path: string;
  video_path: string;
  job_id: string | null;
  status: "processing" | "ready" | "failed";
};

/** Corta [start,end] de um WAV via ffmpeg (pipe, sem arquivo temporário). */
function cutWav(wav: Buffer, start: number, end: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = ["-hide_banner", "-loglevel", "error", "-y",
      "-ss", start.toFixed(3), "-to", end.toFixed(3), "-i", "pipe:0",
      "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"];
    const proc = spawn(FFMPEG, args);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => out.push(d));
    proc.stderr.on("data", (d: Buffer) => err.push(d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(0, 200)}`));
    });
    proc.stdin.on("error", () => {});
    proc.stdin.write(wav);
    proc.stdin.end();
  });
}

/**
 * Dispara os jobs de rosto (hook + fechamento). Retorna os segments criados.
 * Lança em erro (o chamador marca failed + alerta).
 */
export async function startFaceGeneration(args: {
  projectId: string;
  userId: string;
  cleanAudioPath: string;
  imageKey: string;
  words: StudioTranscriptWord[];
}): Promise<FaceSegment[]> {
  const sents = sentencesWithTimes(args.words);
  if (sents.length === 0) throw new Error("sem frases");
  const anchors: { role: "hook" | "close"; sentence: number; start: number; end: number }[] = [
    { role: "hook", sentence: 0, start: sents[0].start, end: sents[0].end },
  ];
  if (sents.length > 1) {
    const last = sents.length - 1;
    anchors.push({ role: "close", sentence: last, start: sents[last].start, end: sents[last].end });
  }

  // Baixa o áudio limpo uma vez
  const obj = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKETS.generations, Key: args.cleanAudioPath }),
  );
  if (!obj.Body) throw new Error("áudio limpo não encontrado");
  const wav = Buffer.from(await obj.Body.transformToByteArray());

  const tier = getCloneTier(STUDIO_FACE_TIER_ID);
  if (!tier) throw new Error("tier do rosto indisponível");
  const imageUrl = await createPresignedGet(R2_BUCKETS.generations, args.imageKey, 7200);

  const segments: FaceSegment[] = [];
  for (const a of anchors) {
    const piece = await cutWav(wav, a.start, a.end + 0.05);
    const audioKey = `${args.userId}/studio/${args.projectId}/face_${a.role}.wav`;
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKETS.generations, Key: audioKey, Body: piece, ContentType: "audio/wav",
      }),
    );
    const audioUrl = await createPresignedGet(R2_BUCKETS.generations, audioKey, 7200);
    const videoKey = `${args.userId}/studio/${args.projectId}/face_${a.role}.mp4`;
    const { workflow } = buildInfiniteTalkWorkflow({
      imageUrl,
      audioUrl,
      s3Key: videoKey,
      tier,
      durationSeconds: a.end - a.start + 0.05,
    });
    // Timeout por job (o default do endpoint, 15min, mata worker frio).
    const { jobId } = await runInfiniteTalk(workflow, {
      executionTimeoutMs: cloneExecutionTimeoutMs(tier, a.end - a.start + 0.05),
    });
    segments.push({
      role: a.role, sentence: a.sentence, start: a.start, end: a.end,
      audio_path: audioKey, video_path: videoKey, job_id: jobId, status: "processing",
    });
  }
  return segments;
}

/** Sincroniza os jobs de rosto pendentes; atualiza face_status do projeto. */
export async function syncFaceSegments(project: {
  id: string;
  user_id: string;
  face_status: string;
  face_segments: FaceSegment[] | null;
}): Promise<void> {
  const segs = project.face_segments ?? [];
  if (project.face_status !== "processing" || segs.length === 0) return;

  let changed = false;
  for (const s of segs) {
    if (s.status !== "processing" || !s.job_id) continue;
    try {
      const st = await getInfiniteTalkStatus(s.job_id);
      if (st.status === "COMPLETED") {
        s.status = "ready";
        changed = true;
      } else if (st.status === "FAILED" || st.status === "CANCELLED" || st.status === "TIMED_OUT") {
        s.status = "failed";
        changed = true;
        await handleTechFailure({
          feature: "Vídeo Estúdio (rosto F4)",
          userId: project.user_id,
          refId: project.id,
          jobId: s.job_id,
          rawError: st.error ?? st.status,
        });
      }
    } catch {
      /* próximo poll tenta de novo */
    }
  }
  if (!changed) return;

  const anyPending = segs.some((s) => s.status === "processing");
  const anyFailed = segs.some((s) => s.status === "failed");
  const nextStatus = anyPending ? "processing" : anyFailed ? "failed" : "ready";
  await getAdmin()
    .from("studio_projects")
    .update({ face_segments: segs, face_status: nextStatus } as never)
    .eq("id", project.id);

  // F5: falhou de vez → estorna a tentativa (débito ref = job do hook).
  // O alerta pro suporte já saiu por segmento acima; aqui é SÓ o estorno.
  if (nextStatus === "failed") {
    await handleTechFailure({
      feature: "Vídeo Estúdio (rosto F4 — estorno)",
      userId: project.user_id,
      refId: segs[0]?.job_id ?? project.id,
      rawError: "rosto falhou — estorno automático da tentativa",
      debitRefType: "studio_face",
      refundRefType: "studio_face_refund",
      alertSupport: false,
    });
  }
}

/** Bucket onde o comfy worker grava os MP4 do rosto (mesmo do Vídeo Clone). */
export function faceVideoBucket(): string {
  return imagesBucket();
}
