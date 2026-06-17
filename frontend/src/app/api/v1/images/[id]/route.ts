/**
 * /api/v1/images/[id]
 *   GET   → estado da geração; se pending/generating, sincroniza com o Kie
 *           (fallback até o callback chegar). Quando ready, inclui image_url.
 *   PATCH → renomeia { name: string } ("" volta pro fallback).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { syncImageTask } from "@/lib/images/sync";
import type { ImageGenerationStatus } from "@/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

const POLLING: ImageGenerationStatus[] = ["pending", "generating"];
const SELECT =
  "id, user_id, name, prompt, aspect_ratio, resolution, credits_cost, image_path, status, error_message, kie_task_id, created_at";

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: gen, error } = await admin
    .from("image_generations")
    .select(SELECT)
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (error) return serverError("Failed to load image");
  if (!gen) return notFound("Image");

  let current = gen;
  if (POLLING.includes(gen.status) && gen.kie_task_id) {
    try {
      await syncImageTask(gen.id, gen.user_id, gen.kie_task_id);
      const { data: refreshed } = await admin
        .from("image_generations")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (refreshed) current = refreshed;
    } catch {
      // ignora — devolve estado atual
    }
  }

  let image_url: string | null = null;
  if (current.status === "ready" && current.image_path) {
    try {
      image_url = await createPresignedGet(imagesBucket(), current.image_path, 60 * 60);
    } catch {
      image_url = null;
    }
  }

  return jsonOk({ image: { ...current, image_url } });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (typeof body.name !== "string") return badRequest("Nome inválido");
  const trimmed = body.name.trim().slice(0, 120);

  const admin = getAdmin();
  const { data, error } = await admin
    .from("image_generations")
    .update({ name: trimmed === "" ? null : trimmed })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id, name")
    .maybeSingle();

  if (error) return serverError("Failed to rename image");
  if (!data) return notFound("Image");

  return jsonOk({ image: data });
}
