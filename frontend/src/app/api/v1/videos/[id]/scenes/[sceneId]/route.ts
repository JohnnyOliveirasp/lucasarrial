/**
 * /api/v1/videos/[id]/scenes/[sceneId]
 *   PATCH → edita o prompt da cena à mão { prompt_pt }. GRÁTIS.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

const PROMPT_MAX = 2000;

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id, sceneId } = await ctx.params;

  let body: { prompt_pt?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  if (typeof body.prompt_pt !== "string") return badRequest("Prompt inválido");
  const prompt = body.prompt_pt.trim().slice(0, PROMPT_MAX);
  if (!prompt) return badRequest("O prompt não pode ficar vazio");

  const admin = getAdmin();
  const { data: row, error } = await admin
    .from("video_scenes")
    .update({ prompt_pt: prompt })
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .select("id, idx, prompt_pt")
    .maybeSingle();

  if (error) return serverError("Falha ao salvar a cena");
  if (!row) return notFound("Scene");

  return jsonOk({ scene: row });
}
