/**
 * /api/v1/generations
 *   GET    → lista os áudios gerados do usuário (com nome da voz + presigned URL)
 *   DELETE → apaga em lote { ids: string[] } (R2 do áudio + referência + banco)
 *
 * Histórico de áudios gerados. Apagar é irreversível.
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
import { R2_BUCKETS } from "@/lib/r2/client";
import { deleteKeys } from "@/lib/r2/delete";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data: gens, error } = await admin
    .from("generations")
    .select("id, voice_id, text_raw, status, audio_path, duration_seconds, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list generations");
  const rows = gens ?? [];

  // Nomes das vozes (uma query, mapeada)
  const voiceIds = [...new Set(rows.map((g) => g.voice_id))];
  const nameById = new Map<string, string>();
  if (voiceIds.length) {
    const { data: voices } = await admin
      .from("voices")
      .select("id, name")
      .in("id", voiceIds);
    for (const v of voices ?? []) nameById.set(v.id, v.name);
  }

  const items = await Promise.all(
    rows.map(async (g) => {
      let audio_url: string | null = null;
      if (g.status === "ready" && g.audio_path) {
        try {
          audio_url = await createPresignedGet(R2_BUCKETS.generations, g.audio_path, 60 * 60);
        } catch {
          audio_url = null;
        }
      }
      return {
        id: g.id,
        voice_id: g.voice_id,
        voice_name: nameById.get(g.voice_id) ?? "—",
        text_raw: g.text_raw,
        status: g.status,
        duration_seconds: g.duration_seconds,
        created_at: g.created_at,
        audio_url,
      };
    }),
  );

  return jsonOk({ generations: items });
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
  if (ids.length === 0) return badRequest("Nenhum áudio selecionado");

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("generations")
    .select("id, audio_path, reference_audio_path")
    .eq("user_id", auth.user_id)
    .in("id", ids);
  if (error) return serverError("Failed to load generations");
  const found = (rows ?? []) as Array<{
    id: string;
    audio_path: string | null;
    reference_audio_path: string | null;
  }>;
  if (found.length === 0) return jsonOk({ deleted: 0 });

  try {
    const audioKeys = found.map((r) => r.audio_path).filter((k): k is string => !!k);
    const refKeys = found.map((r) => r.reference_audio_path).filter((k): k is string => !!k);
    if (audioKeys.length) await deleteKeys(R2_BUCKETS.generations, audioKeys);
    if (refKeys.length) await deleteKeys(R2_BUCKETS.voices, refKeys);
  } catch (e) {
    return serverError(e instanceof Error ? `R2: ${e.message}` : "R2 cleanup failed");
  }

  const foundIds = found.map((r) => r.id);
  const { error: dErr } = await admin
    .from("generations")
    .delete()
    .eq("user_id", auth.user_id)
    .in("id", foundIds);
  if (dErr) return serverError("Failed to delete generations");

  return jsonOk({ deleted: foundIds.length });
}
