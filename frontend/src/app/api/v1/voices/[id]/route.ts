/**
 * /api/v1/voices/[id]
 *   GET    → detalhes da voz (com presigned download URLs onde aplicável)
 *   DELETE → remove voice (cascade)
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { syncTrainingJob } from "@/lib/runpod/sync";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data, error } = await admin
    .from("voices")
    .select(
      "id, name, status, duration_seconds, raw_audio_paths, lora_path, runpod_job_id, error_message, trained_at, created_at, updated_at",
    )
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (error) return serverError("Failed to load voice");
  if (!data) return notFound("Voice");

  // Slice 3 fallback: enquanto não tem webhook (Slice 4), polling-pull do RunPod.
  // Se status="training" e tem runpod_job_id, consulta RunPod e atualiza local.
  if (data.status === "training" && data.runpod_job_id) {
    try {
      const synced = await syncTrainingJob(data.id, data.runpod_job_id);
      if (synced.changed) {
        const { data: refreshed } = await admin
          .from("voices")
          .select(
            "id, name, status, duration_seconds, raw_audio_paths, lora_path, runpod_job_id, error_message, trained_at, created_at, updated_at",
          )
          .eq("id", id)
          .maybeSingle();
        if (refreshed) return jsonOk({ voice: refreshed });
      }
    } catch {
      // ignora — devolve o estado antigo
    }
  }

  return jsonOk({ voice: data });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { error } = await admin
    .from("voices")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user_id);

  if (error) return serverError("Failed to delete voice");
  return jsonOk({ deleted: id });
}
