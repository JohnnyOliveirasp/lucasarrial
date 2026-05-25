/**
 * GET /api/v1/generations/[id]
 *
 * Retorna a row de generation. Se status="pending"|"generating" e tem
 * runpod_job_id, sincroniza com RunPod (fallback até webhook chegar).
 * Quando status="ready", inclui `audio_url` (presigned GET).
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
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { runpodGetStatus } from "@/lib/runpod/client";
import { finalizeGenerationSuccess } from "@/lib/generations/finalize";
import type { GenerationStatus } from "@/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

const POLLING_STATUSES: GenerationStatus[] = ["pending", "generating"];

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: gen, error } = await admin
    .from("generations")
    .select(
      "id, voice_id, text_raw, text_normalized, reference_audio_path, reference_transcript, audio_path, sample_rate, duration_seconds, elapsed_seconds, status, error_message, runpod_job_id, created_at",
    )
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (error) return serverError("Failed to load generation");
  if (!gen) return notFound("Generation");

  let current = gen;

  if (POLLING_STATUSES.includes(gen.status) && gen.runpod_job_id) {
    try {
      const resp = await runpodGetStatus(gen.runpod_job_id);
      if (resp.status === "COMPLETED") {
        const out = (resp.output ?? {}) as { uploaded?: boolean; error?: string; sample_rate?: number; duration_s?: number; elapsed_s?: number };
        const ok = out.uploaded && !out.error;
        if (ok) {
          // Converte WAV->MP3 e marca ready (audio_path passa a apontar pro .mp3).
          await finalizeGenerationSuccess(id, gen.audio_path, out);
        } else {
          await admin
            .from("generations")
            .update({
              status: "failed",
              error_message: (out.error ?? "unknown").slice(0, 500),
            })
            .eq("id", id);
        }

        const { data: refreshed } = await admin
          .from("generations")
          .select(
            "id, voice_id, text_raw, text_normalized, reference_audio_path, reference_transcript, audio_path, sample_rate, duration_seconds, elapsed_seconds, status, error_message, runpod_job_id, created_at",
          )
          .eq("id", id)
          .maybeSingle();
        if (refreshed) current = refreshed;
      } else if (resp.status === "FAILED" || resp.status === "CANCELLED" || resp.status === "TIMED_OUT") {
        await admin
          .from("generations")
          .update({
            status: "failed",
            error_message: `RunPod ${resp.status}: ${resp.error ?? ""}`.slice(0, 500),
          })
          .eq("id", id);
      }
    } catch {
      // ignora — devolve estado atual
    }
  }

  // Anexa presigned GET URL do áudio quando disponível
  let audio_url: string | null = null;
  if (current.status === "ready" && current.audio_path) {
    try {
      audio_url = await createPresignedGet(
        R2_BUCKETS.generations,
        current.audio_path,
        60 * 60, // 1h
      );
    } catch {
      audio_url = null;
    }
  }

  return jsonOk({ generation: { ...current, audio_url } });
}
