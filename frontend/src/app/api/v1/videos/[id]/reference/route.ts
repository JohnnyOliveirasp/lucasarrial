/**
 * PATCH /api/v1/videos/[id]/reference
 *   Salva as fotos de referência (1 a 6, keys já enviadas ao R2 via
 *   /api/v1/images/upload-url) + o aceite de ciência. Sem ciência não salva.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

const MAX_REFS = 6;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { keys?: unknown; consent?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }

  const keys = Array.isArray(body.keys)
    ? [...new Set(body.keys.filter((k): k is string => typeof k === "string" && k.trim() !== ""))]
    : [];
  if (keys.length === 0) return badRequest("Envie ao menos 1 foto de referência.");
  if (keys.length > MAX_REFS) return badRequest(`Máximo de ${MAX_REFS} fotos.`);
  // Defesa: as keys precisam ser do próprio usuário.
  if (!keys.every((k) => k.startsWith(`${auth.user_id}/`))) {
    return badRequest("Foto inválida.");
  }
  if (body.consent !== true) {
    return badRequest("Você precisa confirmar a ciência sobre a foto de referência.");
  }

  const admin = getAdmin();
  const { data: row, error } = await admin
    .from("video_projects")
    .update({ reference_image_paths: keys, image_consent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id")
    .maybeSingle();

  if (error) return serverError("Falha ao salvar a referência");
  if (!row) return notFound("Video project");

  return jsonOk({ ok: true, count: keys.length });
}
