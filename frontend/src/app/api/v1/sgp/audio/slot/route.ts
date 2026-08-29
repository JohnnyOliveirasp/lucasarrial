/**
 * POST /api/v1/sgp/audio/slot — presigned PUT pra UM arquivo de áudio da tela 3.
 * Garante a voz do onboarding do aluno (uma só, status `uploading`, o mesmo
 * nome que a planilha usava) e devolve a chave em `{user}/{voice}/raw/`.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { ONBOARDING_VOICE_NAME } from "@/lib/onboarding/import";
import { R2_BUCKETS } from "@/lib/r2/client";
import { buildRawAudioKey, createPresignedPut, isAllowedAudioMime } from "@/lib/r2/presigned";
import { atualizarPedido, lerPedido } from "@/lib/sgp/pedido";

const MAX_ARQUIVOS = 20;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  let body: { filename?: unknown; content_type?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  if (!filename || !contentType) return badRequest("Arquivo sem nome ou tipo");
  if (!isAllowedAudioMime(contentType)) return badRequest(`Formato de áudio não suportado: ${contentType}`);

  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    if ((pedido.audios ?? []).length >= MAX_ARQUIVOS) return badRequest(`Máximo de ${MAX_ARQUIVOS} arquivos.`);

    const admin = getAdmin();
    let voiceId = pedido.voice_id;
    if (voiceId) {
      const { data } = await admin.from("voices").select("id, status").eq("id", voiceId).eq("user_id", auth.user_id).maybeSingle();
      if (!data || (data as { status: string }).status !== "uploading") voiceId = null;
    }
    if (!voiceId) {
      const { data, error } = await admin
        .from("voices")
        .insert({ user_id: auth.user_id, name: ONBOARDING_VOICE_NAME, status: "uploading" })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "não criou a voz");
      voiceId = (data as { id: string }).id;
      await atualizarPedido(auth.user_id, { voice_id: voiceId });
    }

    const index = (pedido.audios ?? []).length + Math.floor(Math.random() * 900) + 100;
    const key = buildRawAudioKey(auth.user_id, voiceId, index, filename);
    const upload_url = await createPresignedPut(R2_BUCKETS.voices, key, contentType, 6 * 3600);
    return jsonOk({ voice_id: voiceId, key, upload_url });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao preparar o upload");
  }
}
