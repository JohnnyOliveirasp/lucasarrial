/**
 * POST /api/v1/webhooks/kie
 *
 * Callback que o Kie chama quando a task de imagem termina. Como o payload
 * exato varia, extraímos só o `taskId` e RECONSULTAMOS o Kie (recordInfo) como
 * fonte da verdade — mesma robustez do webhook do RunPod.
 *
 * Segurança: URL secreta (NEXT_PUBLIC_SITE_URL) + match obrigatório de
 * kie_task_id na tabela image_generations.
 */
import type { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { syncImageTask } from "@/lib/images/sync";
import { syncSceneImage } from "@/lib/video/image-sync";

function extractTaskId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.taskId === "string") return p.taskId;
  const data = p.data as Record<string, unknown> | undefined;
  if (data && typeof data.taskId === "string") return data.taskId;
  return null;
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("bad_request", "Invalid JSON", 400);
  }

  const taskId = extractTaskId(payload);
  if (!taskId) return jsonOk({ handled: "ignored", reason: "no taskId" });

  const admin = getAdmin();

  // 1) Gerador de imagem convencional.
  const { data: row } = await admin
    .from("image_generations")
    .select("id, user_id, status")
    .eq("kie_task_id", taskId)
    .maybeSingle();

  if (row) {
    if (row.status === "ready" || row.status === "failed") {
      return jsonOk({ handled: "noop", status: row.status });
    }
    try {
      await syncImageTask(row.id, row.user_id, taskId);
    } catch {
      // best-effort; o poll do cliente ainda cobre
    }
    return jsonOk({ handled: "image" });
  }

  // 2) Imagem de cena do wizard de vídeo.
  const { data: scene } = await admin
    .from("video_scenes")
    .select("id, user_id, video_project_id, image_status")
    .eq("image_kie_task_id", taskId)
    .maybeSingle();

  if (scene) {
    if (scene.image_status === "ready" || scene.image_status === "failed") {
      return jsonOk({ handled: "noop", status: scene.image_status });
    }
    try {
      await syncSceneImage(scene.id, scene.user_id, scene.video_project_id, taskId);
    } catch {
      // best-effort; o poll do cliente ainda cobre
    }
    return jsonOk({ handled: "video_scene" });
  }

  return jsonOk({ handled: "ignored", reason: "task not found" });
}
