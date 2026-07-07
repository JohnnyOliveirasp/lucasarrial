/**
 * /api/v1/videos/[id]/scenes
 *   GET  → lista as cenas do projeto (ordenadas).
 *   POST → gera as cenas (LLM divide o roteiro em N). GRÁTIS. Idempotente:
 *          se o projeto já tem cenas, devolve as existentes (não regera, não
 *          sobrescreve edições do usuário).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { sceneCountForDuration } from "@/lib/video/config";
import { generateScenes } from "@/lib/video/generate-scenes";

const SCENE_SELECT = "id, idx, prompt_pt, prompt_en, script_excerpt, created_at";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const { data: scenes, error } = await admin
    .from("video_scenes")
    .select(SCENE_SELECT)
    .eq("video_project_id", id)
    .order("idx", { ascending: true });
  if (error) return serverError("Failed to list scenes");

  return jsonOk({ scenes: scenes ?? [] });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("id, kind, status, script_text, audio_duration_seconds, scene_count, product_analysis, product_price")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  // Já tem cenas? Devolve as existentes (não regera nem sobrescreve).
  const { data: existing } = await admin
    .from("video_scenes")
    .select(SCENE_SELECT)
    .eq("video_project_id", id)
    .order("idx", { ascending: true });
  if (existing && existing.length > 0) {
    return jsonOk({ scenes: existing, regenerated: false });
  }

  const script = (project.script_text ?? "").trim();
  if (!script) return serverError("Projeto sem roteiro");

  const n = project.scene_count ?? sceneCountForDuration(project.audio_duration_seconds ?? 0);

  let generated;
  try {
    // Vídeo Vendas: cenas product-aware (Sonnet + análise) — o produto na mão/
    // em uso na maioria das cenas. História: Haiku, comportamento original.
    const product =
      project.kind === "sales"
        ? { analysis: project.product_analysis ?? null, price: project.product_price ?? null }
        : null;
    generated = await generateScenes(script, n, product);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao gerar cenas");
  }

  const rows = generated.map((s, i) => ({
    video_project_id: id,
    user_id: auth.user_id,
    idx: i + 1,
    prompt_pt: s.prompt_pt,
    script_excerpt: s.script_excerpt || null,
  }));

  const { data: inserted, error: insErr } = await admin
    .from("video_scenes")
    .insert(rows)
    .select(SCENE_SELECT);
  if (insErr) return serverError("Falha ao salvar cenas");

  await admin
    .from("video_projects")
    .update({ status: "scenes", scene_count: rows.length })
    .eq("id", id)
    .eq("user_id", auth.user_id);

  const ordered = (inserted ?? []).sort((a, b) => a.idx - b.idx);
  return jsonOk({ scenes: ordered, regenerated: true });
}
