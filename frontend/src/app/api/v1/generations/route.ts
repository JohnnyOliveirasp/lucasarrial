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

  // Admin (env ADMIN_EMAILS): pula filtro de user_id e ve TODAS as geracoes.
  // Usuario comum: filtro normal por user_id (vinha assim antes deste commit).
  let q = admin
    .from("generations")
    .select("id, user_id, voice_id, name, text_raw, status, audio_path, duration_seconds, created_at")
    .order("created_at", { ascending: false });
  if (!auth.is_admin) {
    q = q.eq("user_id", auth.user_id);
  }
  const { data: gens, error } = await q;

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

  // Admin view: mapeia user_id -> email pra mostrar quem fez cada geracao.
  // listUsers() pagina (max 1000 por pagina); pra MVP basta 1 pagina.
  const emailById = new Map<string, string>();
  if (auth.is_admin) {
    try {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of usersData?.users ?? []) {
        if (u.email) emailById.set(u.id, u.email);
      }
    } catch {
      // best-effort; sem email no card mas a lista nao quebra
    }
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
        name: g.name,
        text_raw: g.text_raw,
        status: g.status,
        duration_seconds: g.duration_seconds,
        created_at: g.created_at,
        audio_url,
        // Vem nulo pra usuario comum; vem o email do dono na view de admin.
        user_email: auth.is_admin ? emailById.get(g.user_id) ?? null : null,
      };
    }),
  );

  return jsonOk({ generations: items, is_admin: auth.is_admin });
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
    .select("id, audio_path")
    .eq("user_id", auth.user_id)
    .in("id", ids);
  if (error) return serverError("Failed to load generations");
  const found = (rows ?? []) as Array<{
    id: string;
    audio_path: string | null;
  }>;
  if (found.length === 0) return jsonOk({ deleted: 0 });

  try {
    // Apaga SÓ o áudio gerado. O reference_audio_path da geração é um snapshot
    // de voices.reference_audio_path (o ref/auto.wav PERSISTENTE da voz,
    // compartilhado por todas as gerações) — apagá-lo aqui quebrava a voz
    // inteira: toda geração futura falhava com "Failed to download .../ref/auto.wav".
    // A ref é limpa junto com a voz (delete da voz usa deleteByPrefix).
    const audioKeys = found.map((r) => r.audio_path).filter((k): k is string => !!k);
    if (audioKeys.length) await deleteKeys(R2_BUCKETS.generations, audioKeys);
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
