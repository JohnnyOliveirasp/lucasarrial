/**
 * /api/v1/images
 *   GET    → lista as imagens geradas do usuário (com presigned URL do resultado)
 *   DELETE → apaga em lote { ids: string[] } (R2 da referência + resultado + banco)
 *
 * Histórico de imagens. Apagar é irreversível.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { deleteKeys } from "@/lib/r2/delete";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("image_generations")
    .select(
      "id, name, prompt, aspect_ratio, resolution, credits_cost, image_path, status, error_message, created_at",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list images");

  const items = await Promise.all(
    (rows ?? []).map(async (g) => {
      let image_url: string | null = null;
      if (g.status === "ready" && g.image_path) {
        try {
          image_url = await createPresignedGet(imagesBucket(), g.image_path, 60 * 60);
        } catch {
          image_url = null;
        }
      }
      return {
        id: g.id,
        name: g.name,
        prompt: g.prompt,
        aspect_ratio: g.aspect_ratio,
        resolution: g.resolution,
        credits_cost: g.credits_cost,
        status: g.status,
        error_message: g.error_message,
        created_at: g.created_at,
        image_url,
      };
    }),
  );

  return jsonOk({ images: items });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { ids?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return badRequest("Nenhuma imagem selecionada");

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("image_generations")
    .select("id, input_image_path, image_path")
    .eq("user_id", auth.user_id)
    .in("id", ids);
  if (error) return serverError("Failed to load images");
  const found = rows ?? [];
  if (found.length === 0) return jsonOk({ deleted: 0 });

  try {
    const keys = [
      ...found.map((r) => r.input_image_path),
      ...found.map((r) => r.image_path),
    ].filter((k): k is string => !!k);
    if (keys.length) await deleteKeys(imagesBucket(), keys);
  } catch (e) {
    return serverError(e instanceof Error ? `R2: ${e.message}` : "R2 cleanup failed");
  }

  const foundIds = found.map((r) => r.id);
  const { error: dErr } = await admin
    .from("image_generations")
    .delete()
    .eq("user_id", auth.user_id)
    .in("id", foundIds);
  if (dErr) return serverError("Failed to delete images");

  return jsonOk({ deleted: foundIds.length });
}
