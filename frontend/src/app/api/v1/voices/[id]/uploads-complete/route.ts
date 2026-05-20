/**
 * POST /api/v1/voices/[id]/uploads-complete
 *
 * Frontend chama depois de fazer PUTs nas presigned URLs. Body:
 *   {
 *     uploaded_keys: string[]        // chaves R2 que foram subidas
 *     client_durations?: number[]    // duração medida no browser por arquivo (seconds)
 *   }
 *
 * Validação Slice 2: soma client_durations >= MIN_TOTAL_SECONDS.
 * Slice 3 vai re-validar no worker RunPod com Demucs+VAD reais.
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
import type { VoiceStatus } from "@/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };
type Body = {
  uploaded_keys: string[];
  client_durations?: number[];
};

const MIN_TOTAL_SECONDS = 20 * 60; // 20 minutos

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!Array.isArray(body.uploaded_keys) || body.uploaded_keys.length === 0) {
    return badRequest("'uploaded_keys' must be a non-empty array");
  }

  const admin = getAdmin();

  const { data: existing, error: loadErr } = await admin
    .from("voices")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (loadErr) return serverError("Failed to load voice");
  if (!existing) return notFound("Voice");
  if (existing.status !== "uploading") {
    return badRequest(
      `Voice status is '${existing.status}', cannot mark uploads complete`,
    );
  }

  // Slice 2: validação de duração via medição do browser.
  // Soma totalSec e decide status final.
  const durations = Array.isArray(body.client_durations) ? body.client_durations : [];
  const totalSec = durations
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0)
    .reduce((acc, d) => acc + d, 0);

  let nextStatus: VoiceStatus;
  let errorMessage: string | null = null;

  if (durations.length === 0) {
    // Não medimos — passa pra "validating", Slice 3 valida no worker
    nextStatus = "validating";
  } else if (totalSec < MIN_TOTAL_SECONDS) {
    nextStatus = "rejected_too_short";
    errorMessage = `Áudio total ${Math.round(totalSec / 60)}min < mínimo de ${MIN_TOTAL_SECONDS / 60}min`;
  } else {
    nextStatus = "awaiting_training";
  }

  const { data, error } = await admin
    .from("voices")
    .update({
      raw_audio_paths: body.uploaded_keys,
      duration_seconds: totalSec > 0 ? Math.round(totalSec) : null,
      status: nextStatus,
      error_message: errorMessage,
    })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id, status, duration_seconds, raw_audio_paths, error_message")
    .single();

  if (error || !data) return serverError("Failed to update voice");
  return jsonOk({ voice: data });
}
