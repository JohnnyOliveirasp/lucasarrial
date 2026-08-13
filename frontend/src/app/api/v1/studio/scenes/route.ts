/**
 * GET /api/v1/studio/scenes — Banco de Cenas (galeria, 13/08).
 *
 * Devolve as cenas PRONTAS em dois grupos:
 *   mine   → todas as cenas do próprio usuário (inclui as privadas com pessoa)
 *   acervo → cenas compartilhadas de TODO MUNDO (shared=true, sem rosto — C3),
 *            excluindo as que já são do próprio usuário.
 *
 * Só leitura (galeria); o reuso continua automático no planejador.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import type { StudioSceneRow } from "@/lib/db/types";

const MAX_MINE = 60;
const MAX_ACERVO = 60;

type Item = {
  id: string;
  concept: string;
  created_at: string;
  video_url: string | null;
  /** Cena privada com a pessoa (C4) — só aparece em "mine". */
  com_pessoa: boolean;
};

async function toItems(rows: StudioSceneRow[]): Promise<Item[]> {
  return Promise.all(
    rows.map(async (s) => ({
      id: s.id,
      concept: s.concept,
      created_at: String(s.created_at),
      video_url: s.video_path
        ? await createPresignedGet(imagesBucket(), s.video_path, 3600).catch(() => null)
        : null,
      com_pessoa: (s.ref_image_paths ?? []).length > 0,
    })),
  );
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const SELECT = "id, user_id, concept, prompt_en, dialect, status, kie_task_id, qa_retried, anim_retried, debit_ref, image_path, video_path, ref_image_paths, error_message, created_at";

  const [{ data: mineRows, error: e1 }, { data: acervoRows, error: e2 }] = await Promise.all([
    admin
      .from("studio_scenes")
      .select(SELECT)
      .eq("user_id", auth.user_id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(MAX_MINE),
    admin
      .from("studio_scenes")
      .select(SELECT)
      .eq("shared", true)
      .eq("status", "ready")
      .neq("user_id", auth.user_id)
      .order("created_at", { ascending: false })
      .limit(MAX_ACERVO),
  ]);
  if (e1 || e2) return serverError("Falha ao listar o banco de cenas");

  const [mine, acervo] = await Promise.all([
    toItems((mineRows ?? []) as StudioSceneRow[]),
    toItems((acervoRows ?? []) as StudioSceneRow[]),
  ]);

  return jsonOk({ mine, acervo });
}
