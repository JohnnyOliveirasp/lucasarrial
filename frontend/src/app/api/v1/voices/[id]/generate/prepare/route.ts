/**
 * POST /api/v1/voices/[id]/generate/prepare
 *
 * Gera presigned URL PUT pro browser subir o áudio de referência (≥60s).
 * Body: { filename, content_type }
 * Retorna: { reference_audio_key, upload_url }
 */
import { randomUUID } from "node:crypto";
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
import { R2_BUCKETS } from "@/lib/r2/client";
import {
  buildReferenceKey,
  createPresignedPut,
  isAllowedAudioMime,
} from "@/lib/r2/presigned";

type Ctx = { params: Promise<{ id: string }> };
type Body = { filename: string; content_type: string };

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id: voiceId } = await ctx.params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (!body.filename || !body.content_type) {
    return badRequest("'filename' and 'content_type' required");
  }
  if (!isAllowedAudioMime(body.content_type)) {
    return badRequest(`Unsupported content_type: ${body.content_type}`);
  }

  const admin = getAdmin();
  const { data: voice } = await admin
    .from("voices")
    .select("id, status")
    .eq("id", voiceId)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (!voice) return notFound("Voice");
  if (voice.status !== "ready") return badRequest(`Voice not ready (${voice.status})`);

  const refId = randomUUID();
  const key = buildReferenceKey(auth.user_id, voiceId, refId);

  let url: string;
  try {
    url = await createPresignedPut(R2_BUCKETS.voices, key, body.content_type);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "R2 error");
  }

  return jsonOk({ reference_audio_key: key, upload_url: url });
}
