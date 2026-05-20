/**
 * /api/v1/voices
 *
 *   POST  → cria voice (status="uploading") + retorna presigned URLs PUT
 *   GET   → lista vozes do usuário (id, name, status, created_at, lora_path)
 *
 * Auth: cookie (frontend) OU header X-API-Key.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  jsonOk,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { createUploadSlots, isAllowedAudioMime } from "@/lib/r2/presigned";

const MAX_FILES_PER_VOICE = 20;
const MAX_NAME_LENGTH = 80;

type CreateBody = {
  name: string;
  files: Array<{ filename: string; content_type: string; size_bytes?: number }>;
};

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("Field 'name' is required");
  if (name.length > MAX_NAME_LENGTH)
    return badRequest(`'name' max length is ${MAX_NAME_LENGTH}`);

  if (!Array.isArray(body.files) || body.files.length === 0)
    return badRequest("Field 'files' must be a non-empty array");
  if (body.files.length > MAX_FILES_PER_VOICE)
    return badRequest(`Max ${MAX_FILES_PER_VOICE} files per voice`);

  for (const f of body.files) {
    if (!f.filename || !f.content_type)
      return badRequest("Each file needs 'filename' and 'content_type'");
    if (!isAllowedAudioMime(f.content_type))
      return badRequest(`Unsupported content_type: ${f.content_type}`);
  }

  const admin = getAdmin();

  const { data: voice, error: insertError } = await admin
    .from("voices")
    .insert({ user_id: auth.user_id, name, status: "uploading" })
    .select("id, name, status, created_at")
    .single();

  if (insertError || !voice) {
    return serverError("Failed to create voice");
  }

  let slots;
  try {
    slots = await createUploadSlots(auth.user_id, voice.id as string, body.files);
  } catch (e) {
    await admin.from("voices").delete().eq("id", voice.id);
    return serverError(
      e instanceof Error ? `Failed to create upload URLs: ${e.message}` : "R2 error",
    );
  }

  return jsonOk(
    {
      voice: {
        id: voice.id,
        name: voice.name,
        status: voice.status,
        created_at: voice.created_at,
      },
      upload_slots: slots,
    },
    201,
  );
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data, error } = await admin
    .from("voices")
    .select(
      "id, name, status, duration_seconds, lora_path, error_message, trained_at, created_at, updated_at",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list voices");
  return jsonOk({ voices: data ?? [] });
}
