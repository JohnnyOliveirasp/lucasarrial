/**
 * /api/v1/videos/[id]
 *   GET   → estado do projeto de vídeo (consumido pelo wizard), com presigned
 *           URL do áudio escolhido pra tocar no passo 1.
 *   PATCH → renomeia { name }.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS, imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

const SELECT =
  "id, name, kind, status, source_generation_id, audio_path, audio_duration_seconds, script_text, aspect_ratio, scene_count, video_tier, final_video_path, error_message, created_at, product_image_paths, product_price, product_link, product_description, product_analysis, reference_image_paths";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: row, error } = await admin
    .from("video_projects")
    .select(SELECT)
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (error) return serverError("Failed to load video project");
  if (!row) return notFound("Video project");

  let audio_url: string | null = null;
  if (row.audio_path) {
    try {
      audio_url = await createPresignedGet(R2_BUCKETS.generations, row.audio_path, 60 * 60);
    } catch {
      audio_url = null;
    }
  }

  // Vídeo Vendas: URLs assinadas das fotos (produto + pessoa) pro F5/reabertura
  // re-hidratar as miniaturas no setup.
  const signAll = async (keys: string[] | null | undefined) =>
    Promise.all(
      (keys ?? []).map((k) =>
        createPresignedGet(imagesBucket(), k, 60 * 60)
          .then((url) => ({ key: k, url }))
          .catch(() => null),
      ),
    ).then((arr) => arr.filter((x): x is { key: string; url: string } => !!x));

  const product_images =
    row.kind === "sales" ? await signAll(row.product_image_paths as string[] | null) : [];
  const reference_images =
    row.kind === "sales" ? await signAll(row.reference_image_paths as string[] | null) : [];

  return jsonOk({ project: { ...row, audio_url, product_images, reference_images } });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  if (typeof body.name !== "string") return badRequest("Nome inválido");
  const name = body.name.trim().slice(0, 120) || null;

  const admin = getAdmin();
  const { data: row, error } = await admin
    .from("video_projects")
    .update({ name })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id, name")
    .maybeSingle();

  if (error) return serverError("Failed to rename video project");
  if (!row) return notFound("Video project");

  return jsonOk({ project: row });
}
