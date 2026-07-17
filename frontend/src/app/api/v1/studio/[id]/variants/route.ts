/**
 * POST /api/v1/studio/[id]/variants — Máquina E4 (§2.8): o vídeo montado vira
 * N variações trocando SÓ a legenda estática de hook (custo ~zero, só ffmpeg).
 * Body: { variants: [{ text, yfrac? }] } (máx 6). GET /studio/[id]/variants
 * devolve o status + URLs presignadas quando prontas.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet, createPresignedPut } from "@/lib/r2/presigned";
import { runpodSubmitTrain, runpodGetStatus } from "@/lib/runpod/client";

type Ctx = { params: Promise<{ id: string }> };
const JOB_EXPIRES_SECONDS = 7200;
const MAX_VARIANTS = 6;

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const { id } = await ctx.params;
  const admin = getAdmin();

  let body: { variants?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const raw = Array.isArray(body.variants) ? body.variants : [];
  const variants = raw
    .map((v) => {
      const r = (v ?? {}) as Record<string, unknown>;
      return {
        text: typeof r.text === "string" ? r.text.trim().slice(0, 120) : "",
        yfrac: typeof r.yfrac === "number" && r.yfrac > 0 && r.yfrac < 1 ? r.yfrac : 0.14,
      };
    })
    .slice(0, MAX_VARIANTS);
  if (variants.length === 0) return badRequest("'variants' é obrigatório (1 a 6).");

  const { data: project } = await admin
    .from("studio_projects")
    .select("id, montage_status, video_path, variants_status")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Studio project");
  if (project.montage_status !== "ready" || !project.video_path) {
    return badRequest("Monte o vídeo antes de gerar variações.");
  }
  if (project.variants_status === "processing") {
    return badRequest("As variações já estão sendo geradas.");
  }

  const keys = variants.map((_, i) => `${auth.user_id}/studio/${id}/variant_${i}.mp4`);
  let videoUrl: string;
  let putUrls: string[];
  try {
    videoUrl = await createPresignedGet(imagesBucket(), project.video_path, JOB_EXPIRES_SECONDS);
    putUrls = await Promise.all(
      keys.map((k) => createPresignedPut(imagesBucket(), k, "video/mp4", JOB_EXPIRES_SECONDS)),
    );
  } catch {
    return serverError("Não consegui preparar os arquivos das variações.");
  }

  let jobId: string;
  try {
    const job = await runpodSubmitTrain({
      type: "caption_variants",
      video_url: videoUrl,
      variants,
      output_upload_urls: putUrls,
    });
    jobId = job.id;
  } catch {
    return serverError("Falha ao iniciar as variações.");
  }

  await admin
    .from("studio_projects")
    .update({ variants_job_id: jobId, variants_status: "processing", variant_paths: keys } as never)
    .eq("id", id);

  return jsonOk({ variants: { status: "processing", count: variants.length } }, 201);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const { id } = await ctx.params;
  const admin = getAdmin();

  const { data: project } = await admin
    .from("studio_projects")
    .select("id, variants_job_id, variants_status, variant_paths")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Studio project");

  let status = project.variants_status ?? "idle";
  if (status === "processing" && project.variants_job_id) {
    try {
      const resp = await runpodGetStatus(project.variants_job_id);
      if (resp.status === "COMPLETED") {
        const out = (resp.output ?? {}) as { caption_variants?: boolean; error?: string };
        status = out.caption_variants ? "ready" : "failed";
        await admin.from("studio_projects").update({ variants_status: status } as never).eq("id", id);
      } else if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(resp.status)) {
        status = "failed";
        await admin.from("studio_projects").update({ variants_status: "failed" } as never).eq("id", id);
      }
    } catch {
      /* próximo poll tenta de novo */
    }
  }

  let urls: string[] = [];
  if (status === "ready" && Array.isArray(project.variant_paths)) {
    urls = await Promise.all(
      (project.variant_paths as string[]).map((k) =>
        createPresignedGet(imagesBucket(), k, 3600).catch(() => ""),
      ),
    );
  }
  return jsonOk({ variants: { status, urls: urls.filter(Boolean) } });
}
