/**
 * /api/v1/videos/audios
 *   GET → lista os áudios gerados ELEGÍVEIS pro wizard de vídeo:
 *         status=ready, duração <= 90s. Com nome da voz + presigned URL.
 *
 * Passo 1 do wizard ("escolher áudio"). A duração já vem persistida na coluna
 * generations.duration_seconds (preenchida pelo worker), então o filtro é SQL.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { MAX_AUDIO_SECONDS } from "@/lib/video/config";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data: gens, error } = await admin
    .from("generations")
    .select("id, voice_id, name, text_raw, duration_seconds, audio_path, created_at")
    .eq("user_id", auth.user_id)
    .eq("status", "ready")
    .not("duration_seconds", "is", null)
    .lte("duration_seconds", MAX_AUDIO_SECONDS)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list audios");
  const rows = gens ?? [];

  // Nomes das vozes (uma query, mapeada).
  const voiceIds = [...new Set(rows.map((g) => g.voice_id))];
  const nameById = new Map<string, string>();
  if (voiceIds.length) {
    const { data: voices } = await admin.from("voices").select("id, name").in("id", voiceIds);
    for (const v of voices ?? []) nameById.set(v.id, v.name);
  }

  const items = await Promise.all(
    rows.map(async (g) => {
      let audio_url: string | null = null;
      if (g.audio_path) {
        try {
          audio_url = await createPresignedGet(R2_BUCKETS.generations, g.audio_path, 60 * 60);
        } catch {
          audio_url = null;
        }
      }
      return {
        id: g.id,
        voice_name: nameById.get(g.voice_id) ?? "—",
        name: g.name,
        text_raw: g.text_raw,
        duration_seconds: g.duration_seconds,
        created_at: g.created_at,
        audio_url,
      };
    }),
  );

  return jsonOk({ audios: items });
}
