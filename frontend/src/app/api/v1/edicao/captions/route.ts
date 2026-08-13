/**
 * Wizard Vídeo Edição — W5 fase 2: legendas karaokê num VÍDEO CLONE pronto.
 *
 * POST { video: {kind:"clone-padrao"|"clone-heygen", id},
 *        audio: {kind:"generation", id} | {kind:"take", key} }
 *   → { job_id, output_key }
 *   Resolve o MP4 do clone + transcreve o áudio da E2 com timestamps POR
 *   PALAVRA (o áudio É o que gerou o vídeo — timestamps casam 1:1) e submete
 *   o job caption_burn no worker. Cobra EDICAO_CAPTION_COST após o job no ar.
 *
 * GET ?job=<id>&key=<output_key>
 *   → { status: "processing"|"ready"|"failed", video_url?, error? }
 *   Poll sem webhook (padrão caption_variants); falha → estorno idempotente.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { EDICAO_CAPTION_COST } from "@/lib/edicao/pricing";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet, createPresignedPut } from "@/lib/r2/presigned";
import { runpodGetStatus, runpodSubmitTrain } from "@/lib/runpod/client";
import { transcribeWords } from "@/lib/video/transcribe-words";
import { handleTechFailure } from "@/lib/support/failure-alert";

const JOB_EXPIRES_SECONDS = 7200;

type VideoRef = { kind: "clone-padrao" | "clone-heygen"; id: string };
type AudioRef = { kind: "generation"; id: string } | { kind: "take"; key: string };

/** MP4 do clone → (bucket, key), validando posse e prontidão. */
async function resolveVideo(userId: string, v: VideoRef): Promise<{ bucket: string; key: string } | null> {
  const admin = getAdmin();
  if (v.kind === "clone-padrao") {
    const { data } = await admin
      .from("video_clones")
      .select("user_id, status, video_path")
      .eq("id", v.id)
      .maybeSingle();
    const row = data as { user_id: string; status: string; video_path: string | null } | null;
    if (!row || row.user_id !== userId || row.status !== "ready" || !row.video_path) return null;
    return { bucket: imagesBucket(), key: row.video_path };
  }
  const { data } = await admin
    .from("heygen_videos")
    .select("user_id, status, video_path")
    .eq("id", v.id)
    .maybeSingle();
  const row = data as { user_id: string; status: string; video_path: string | null } | null;
  if (!row || row.user_id !== userId || !row.video_path) return null;
  return { bucket: R2_BUCKETS.generations, key: row.video_path };
}

/** Áudio da E2 → (bucket, key) pro Whisper por palavra. */
async function resolveAudio(userId: string, a: AudioRef): Promise<{ bucket: string; key: string } | null> {
  if (a.kind === "take") {
    if (!a.key.startsWith(`${userId}/recorder-test/`) || a.key.includes("..")) return null;
    return { bucket: R2_BUCKETS.voices, key: a.key };
  }
  const { data } = await getAdmin()
    .from("generations")
    .select("audio_path, status, user_id")
    .eq("id", a.id)
    .maybeSingle();
  const gen = data as { audio_path: string | null; status: string; user_id: string } | null;
  if (!gen || gen.user_id !== userId || gen.status !== "ready" || !gen.audio_path) return null;
  return { bucket: R2_BUCKETS.generations, key: gen.audio_path };
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { video?: VideoRef; audio?: AudioRef; source_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const v = body.video;
  const a = body.audio;
  if (!v || (v.kind !== "clone-padrao" && v.kind !== "clone-heygen") || typeof v.id !== "string") {
    return badRequest("Vídeo inválido.");
  }
  if (!a || (a.kind !== "generation" && a.kind !== "take")) return badRequest("Áudio inválido.");

  // Encadeamento W5: b-roll aplicado ANTES → a legenda queima por cima do
  // resultado (source_key = saída do broll, sempre do próprio usuário).
  const sourceKey = typeof body.source_key === "string" ? body.source_key.trim() : "";
  let video: { bucket: string; key: string } | null;
  if (sourceKey) {
    if (!sourceKey.startsWith(`${auth.user_id}/edicao/`) || sourceKey.includes("..")) {
      return badRequest("source_key inválida.");
    }
    video = { bucket: imagesBucket(), key: sourceKey };
  } else {
    video = await resolveVideo(auth.user_id, v);
  }
  if (!video) return notFound("Vídeo do clone");
  const audio = await resolveAudio(auth.user_id, a);
  if (!audio) return badRequest("Áudio não encontrado.");

  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: EDICAO_CAPTION_COST,
    action: "legendar o vídeo",
  });
  if (!gate.ok) return gate.deny;

  let words;
  try {
    words = await transcribeWords(audio.bucket, audio.key);
  } catch (e) {
    console.error("[edicao/captions] transcrição falhou:", e instanceof Error ? e.message : e);
    return serverError("Não consegui transcrever o áudio pra legenda. Tente novamente.");
  }

  // Saída determinística por vídeo (re-legendar sobrescreve), bucket permanente.
  const outputKey = `${auth.user_id}/edicao/captions/${v.kind}-${v.id}.mp4`;
  let videoUrl: string;
  let putUrl: string;
  try {
    videoUrl = await createPresignedGet(video.bucket, video.key, JOB_EXPIRES_SECONDS);
    putUrl = await createPresignedPut(imagesBucket(), outputKey, "video/mp4", JOB_EXPIRES_SECONDS);
  } catch {
    return serverError("Não consegui preparar os arquivos da legenda.");
  }

  let jobId: string;
  try {
    const job = await runpodSubmitTrain({
      type: "caption_burn",
      video_url: videoUrl,
      words,
      output_upload_url: putUrl,
    });
    jobId = job.id;
  } catch (e) {
    await handleTechFailure({
      feature: "Vídeo Edição (legenda no clone W5)",
      userId: auth.user_id,
      refId: v.id,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Falha ao iniciar a legendagem.");
  }

  // Débito depois do job no ar (padrão da casa); ref = jobId, único por tentativa.
  if (gate.billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: EDICAO_CAPTION_COST,
      kind: "video",
      refType: "edicao_captions",
      refId: jobId,
      note: "Vídeo Edição — legendas no vídeo clone",
    });
  }

  return jsonOk({ job_id: jobId, output_key: outputKey }, 201);
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const jobId = request.nextUrl.searchParams.get("job") ?? "";
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!jobId) return badRequest("job ausente");
  // A key é escolhida pelo servidor no POST — aqui só re-validamos a posse.
  if (!key.startsWith(`${auth.user_id}/edicao/captions/`) || key.includes("..")) {
    return badRequest("key inválida");
  }

  let status: string;
  let output: { error?: string } | null = null;
  try {
    const st = await runpodGetStatus(jobId);
    status = st.status;
    output = (st as { output?: { error?: string } }).output ?? null;
  } catch {
    return jsonOk({ status: "processing" }); // RunPod fora do ar → tenta de novo
  }

  const failed =
    status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT" || Boolean(output?.error);
  if (failed) {
    await handleTechFailure({
      feature: "Vídeo Edição (legenda no clone W5)",
      userId: auth.user_id,
      refId: jobId,
      jobId,
      rawError: output?.error || `RunPod ${status}`,
      debitRefType: "edicao_captions",
      refundRefType: "edicao_captions_refund",
    });
    return jsonOk({ status: "failed", error: "A legendagem falhou e os créditos foram estornados." });
  }
  if (status === "COMPLETED") {
    const video_url = await createPresignedGet(imagesBucket(), key, 3600).catch(() => null);
    return jsonOk({ status: "ready", video_url });
  }
  return jsonOk({ status: "processing" });
}
