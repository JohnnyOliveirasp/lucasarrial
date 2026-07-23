/**
 * /api/v1/admin/scenes — F3: curadoria do acervo COMPARTILHADO de b-roll.
 *   GET  → lista cenas b-roll prontas (candidatas + já compartilhadas)
 *   POST → { scene_id, shared } marca/desmarca cena no acervo global
 *
 * Regra do acervo (reunião 21/07, formalização final pendente com o Lucas):
 * só CENA GENÉRICA — sem rosto, sem produto, sem marca. A curadoria é manual
 * e 100% do admin; consentimento explícito do aluno entra antes de abrir a
 * plataforma pra não-admin gerar cena que possa ser compartilhada.
 */
import type { NextRequest } from "next/server";
import { getAdminContext } from "@/lib/admin/guard";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return unauthorized();

  const { data, error } = await getAdmin()
    .from("studio_scenes")
    .select("id, user_id, concept, shared, video_path, created_at")
    .eq("status", "ready")
    .eq("kind", "broll")
    .order("shared", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) return serverError("Failed to list scenes");

  const rows = (data ?? []) as {
    id: string; user_id: string; concept: string; shared: boolean;
    video_path: string | null; created_at: string;
  }[];
  const scenes = await Promise.all(
    rows.map(async (s) => ({
      id: s.id,
      concept: s.concept,
      shared: s.shared,
      created_at: s.created_at,
      video_url: s.video_path
        ? await createPresignedGet(imagesBucket(), s.video_path, 3600).catch(() => null)
        : null,
    })),
  );
  return jsonOk({ scenes });
}

export async function POST(request: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx) return unauthorized();

  let body: { scene_id?: unknown; shared?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const sceneId = typeof body.scene_id === "string" ? body.scene_id : "";
  if (!sceneId || typeof body.shared !== "boolean") {
    return badRequest("Envie scene_id e shared (boolean).");
  }

  // Só b-roll PRONTO entra no acervo (produto/rosto nunca — regra do plano).
  const { data: updated, error } = await getAdmin()
    .from("studio_scenes")
    .update({ shared: body.shared } as never)
    .eq("id", sceneId)
    .eq("kind", "broll")
    .eq("status", "ready")
    .select("id, shared")
    .maybeSingle();
  if (error) return serverError("Failed to update scene");
  if (!updated) return notFound("Cena b-roll pronta");
  return jsonOk({ scene: updated });
}
