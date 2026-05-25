/**
 * /api/v1/voices/[id]/reference
 *   PUT    → grava a referência (já subida via /reference/prepare) na voz.
 *            Se já havia uma, apaga o arquivo antigo do R2 (troca).
 *   DELETE → apaga a referência da voz (arquivo do R2 + zera a coluna).
 *
 * A referência é persistente por voz: o usuário sobe uma vez e ela é reusada
 * em toda geração até trocar/apagar aqui. A transcrição segue a cargo do worker
 * a cada geração (Caminho A).
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
import { R2_BUCKETS } from "@/lib/r2/client";
import { deleteKeys } from "@/lib/r2/delete";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id: voiceId } = await ctx.params;

  let body: { reference_audio_key?: string } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const key = (body.reference_audio_key ?? "").trim();
  if (!key) return badRequest("'reference_audio_key' required");

  // Trava: a chave precisa pertencer a esta voz/usuário (defesa em profundidade).
  const expectedPrefix = `${auth.user_id}/${voiceId}/ref/`;
  if (!key.startsWith(expectedPrefix)) {
    return badRequest("reference_audio_key fora do escopo desta voz");
  }

  const admin = getAdmin();
  const { data: voice } = await admin
    .from("voices")
    .select("id, reference_audio_path")
    .eq("id", voiceId)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (!voice) return notFound("Voice");

  const { error: uErr } = await admin
    .from("voices")
    .update({ reference_audio_path: key } as never)
    .eq("id", voiceId)
    .eq("user_id", auth.user_id);
  if (uErr) return serverError("Failed to save reference");

  // Troca: limpa o arquivo antigo do R2 (best-effort).
  const oldKey = (voice as { reference_audio_path: string | null }).reference_audio_path;
  if (oldKey && oldKey !== key) {
    await deleteKeys(R2_BUCKETS.voices, [oldKey]).catch(() => 0);
  }

  return jsonOk({ reference_audio_path: key });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id: voiceId } = await ctx.params;

  const admin = getAdmin();
  const { data: voice } = await admin
    .from("voices")
    .select("id, reference_audio_path")
    .eq("id", voiceId)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (!voice) return notFound("Voice");

  const key = (voice as { reference_audio_path: string | null }).reference_audio_path;
  if (!key) return jsonOk({ reference_audio_path: null }); // já não tem

  const { error: uErr } = await admin
    .from("voices")
    .update({ reference_audio_path: null } as never)
    .eq("id", voiceId)
    .eq("user_id", auth.user_id);
  if (uErr) return serverError("Failed to remove reference");

  await deleteKeys(R2_BUCKETS.voices, [key]).catch(() => 0);

  return jsonOk({ reference_audio_path: null });
}
