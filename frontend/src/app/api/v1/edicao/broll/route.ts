/**
 * Wizard Vídeo Edição — W5 fase 4: b-roll POR CIMA do vídeo clone.
 *
 * Pré-requisito: um projeto do Estúdio (criado pelo fluxo import-audio do
 * wizard) com o MESMO áudio do clone, cenas geradas pras frases escolhidas
 * (POST /studio/[id]/scenes com sentences[]). Aqui só juntamos: janela de
 * cada frase (sentencesWithTimes, MESMA segmentação do worker) + MP4 de cada
 * cena → job broll_overlay (áudio e duração do clone intocados).
 *
 * POST { project_id, video: {kind:"clone-padrao"|"clone-heygen", id} }
 *   → { job_id, output_key }
 * GET ?job=&key= → { status, video_url?, error? }  (poll, estorno em falha)
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { EDICAO_BROLL_COST } from "@/lib/edicao/pricing";
import { sentencesWithTimes, type StudioWord } from "@/lib/studio/pricing";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet, createPresignedPut } from "@/lib/r2/presigned";
import { runpodGetStatus, runpodSubmitTrain } from "@/lib/runpod/client";
import { handleTechFailure } from "@/lib/support/failure-alert";
import type { StudioScenePlanItem, StudioSceneRow } from "@/lib/db/types";

const JOB_EXPIRES_SECONDS = 7200;
const MAX_INSERTS = 12;

type VideoRef = { kind: "clone-padrao" | "clone-heygen"; id: string };

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

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { project_id?: unknown; video?: VideoRef } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
  const v = body.video;
  if (!projectId) return badRequest("project_id ausente");
  if (!v || (v.kind !== "clone-padrao" && v.kind !== "clone-heygen") || typeof v.id !== "string") {
    return badRequest("Vídeo inválido.");
  }

  const video = await resolveVideo(auth.user_id, v);
  if (!video) return notFound("Vídeo do clone");

  const admin = getAdmin();
  const { data: project } = await admin
    .from("studio_projects")
    .select("id, status, scenes_status, scene_plan, transcript_words")
    .eq("id", projectId)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Projeto de b-roll");
  if (project.scenes_status !== "ready") return badRequest("As cenas ainda não estão prontas.");
  const plan = (project.scene_plan ?? []) as StudioScenePlanItem[];
  const words = (project.transcript_words ?? []) as StudioWord[];
  if (plan.length === 0 || words.length === 0) return badRequest("Projeto sem cenas planejadas.");

  // Janela de cada frase escolhida + MP4 da cena correspondente.
  const sents = sentencesWithTimes(words);
  const ids = [...new Set(plan.map((p) => p.scene_id))];
  const { data: rows } = await admin
    .from("studio_scenes")
    .select("id, status, video_path")
    .in("id", ids);
  const byId = new Map(
    ((rows ?? []) as Pick<StudioSceneRow, "id" | "status" | "video_path">[])
      .filter((s) => s.status === "ready" && s.video_path)
      .map((s) => [s.id, s.video_path as string]),
  );
  const inserts: { t0: number; t1: number; key: string }[] = [];
  for (const p of plan.slice().sort((a, b) => a.sentence - b.sentence)) {
    const sent = sents[p.sentence];
    const key = byId.get(p.scene_id);
    if (!sent || !key) continue;
    inserts.push({ t0: Math.max(0, sent.start), t1: sent.end, key });
    if (inserts.length >= MAX_INSERTS) break;
  }
  if (inserts.length === 0) return badRequest("Nenhuma cena pronta pra aplicar.");

  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: EDICAO_BROLL_COST,
    action: "aplicar o b-roll",
  });
  if (!gate.ok) return gate.deny;

  const outputKey = `${auth.user_id}/edicao/broll/${v.kind}-${v.id}.mp4`;
  let baseUrl: string;
  let putUrl: string;
  let insertsSigned: { t0: number; t1: number; video_url: string }[];
  try {
    baseUrl = await createPresignedGet(video.bucket, video.key, JOB_EXPIRES_SECONDS);
    putUrl = await createPresignedPut(imagesBucket(), outputKey, "video/mp4", JOB_EXPIRES_SECONDS);
    insertsSigned = await Promise.all(
      inserts.map(async (i) => ({
        t0: i.t0,
        t1: i.t1,
        video_url: await createPresignedGet(imagesBucket(), i.key, JOB_EXPIRES_SECONDS),
      })),
    );
  } catch {
    return serverError("Não consegui preparar os arquivos do b-roll.");
  }

  let jobId: string;
  try {
    const job = await runpodSubmitTrain({
      type: "broll_overlay",
      base_video_url: baseUrl,
      inserts: insertsSigned,
      output_upload_url: putUrl,
    });
    jobId = job.id;
  } catch (e) {
    await handleTechFailure({
      feature: "Vídeo Edição (b-roll no clone W5)",
      userId: auth.user_id,
      refId: v.id,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Falha ao iniciar o b-roll.");
  }

  if (gate.billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: EDICAO_BROLL_COST,
      kind: "video",
      refType: "edicao_broll",
      refId: jobId,
      note: "Vídeo Edição — b-roll por cima do vídeo clone",
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
  if (!key.startsWith(`${auth.user_id}/edicao/broll/`) || key.includes("..")) {
    return badRequest("key inválida");
  }

  let status: string;
  let output: { error?: string } | null = null;
  try {
    const st = await runpodGetStatus(jobId);
    status = st.status;
    output = (st as { output?: { error?: string } }).output ?? null;
  } catch {
    return jsonOk({ status: "processing" });
  }

  const failed =
    status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT" || Boolean(output?.error);
  if (failed) {
    await handleTechFailure({
      feature: "Vídeo Edição (b-roll no clone W5)",
      userId: auth.user_id,
      refId: jobId,
      jobId,
      rawError: output?.error || `RunPod ${status}`,
      debitRefType: "edicao_broll",
      refundRefType: "edicao_broll_refund",
    });
    return jsonOk({ status: "failed", error: "O b-roll falhou e os créditos foram estornados." });
  }
  if (status === "COMPLETED") {
    const video_url = await createPresignedGet(imagesBucket(), key, 3600).catch(() => null);
    return jsonOk({ status: "ready", video_url });
  }
  return jsonOk({ status: "processing" });
}
