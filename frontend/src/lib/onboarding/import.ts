/**
 * Importadores do onboarding via planilha (Drive → R2 → banco). Server-only.
 *
 * - Imagens → acervo "Minhas fotos" (`image_generations`, igual ao
 *   /api/v1/images/import). 1 foto vira a IMAGEM DE REFERÊNCIA do clone
 *   (profiles.image_ref_key): se só tem 1, é ela; várias, 1 aleatória — as
 *   demais ficam no acervo (decisão Johnny 12/08).
 * - Áudios → voz nova em `awaiting_training` (área de treino), SEM disparar
 *   treino. Duração medida via ffmpeg (mesma régua do uploads-complete).
 *
 * Tudo idempotente por fileId do Drive: chave R2 determinística → reprocessar
 * a mesma linha da planilha não duplica nada.
 */
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, VoiceStatus } from "@/lib/db/types";
import { imagesBucket, r2, R2_BUCKETS } from "@/lib/r2/client";
import { buildRawAudioKey, createPresignedGet } from "@/lib/r2/presigned";
import { estimateSpeechSeconds } from "@/lib/audio/speech-estimate";
import { downloadDriveFile, pickExtension } from "./drive";

type Admin = SupabaseClient<Database>;

const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB por foto
const MAX_AUDIO_BYTES = 400 * 1024 * 1024; // 400MB por take (1h WAV cabe)
const MAX_IMAGES = 20;
const MAX_AUDIOS = 20; // mesmo teto do MAX_FILES_PER_VOICE
/** Mesma régua do uploads-complete (20min brutos). */
const MIN_TOTAL_SECONDS = 20 * 60;
/** Nome da voz criada pelo onboarding — âncora da idempotência. */
export const ONBOARDING_VOICE_NAME = "Minha Voz";

export type ImportResult = {
  imported: number;
  skipped: number;
  failed: Array<{ id: string; error: string }>;
};

/** Chave R2 determinística da foto importada (idempotência por fileId). */
function imageDestKey(userId: string, fileId: string, ext: string): string {
  const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${userId}/uploads/onboarding_${safe}.${ext}`;
}

/**
 * Importa as fotos do Drive pro acervo do aluno e define a referência do
 * clone se ainda não houver (profiles.image_ref_key).
 */
export async function importImages(
  admin: Admin,
  userId: string,
  fileIds: string[],
): Promise<ImportResult & { reference_key: string | null }> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: [] };
  const allKeys: string[] = [];

  for (const fileId of fileIds.slice(0, MAX_IMAGES)) {
    try {
      // Idempotência: o acervo já tem uma foto com esse fileId?
      const probe = imageDestKey(userId, fileId, "");
      const { data: existing } = await admin
        .from("image_generations")
        .select("id, image_path")
        .eq("user_id", userId)
        .like("image_path", `${probe}%`)
        .limit(1)
        .maybeSingle();
      if (existing) {
        result.skipped++;
        allKeys.push(existing.image_path as string);
        continue;
      }

      const file = await downloadDriveFile(fileId, MAX_IMAGE_BYTES);
      if (!file.contentType.startsWith("image/")) {
        throw new Error(`não é imagem (${file.contentType})`);
      }
      const ext = pickExtension(file.filename, file.contentType, "jpg");
      const destKey = imageDestKey(userId, fileId, ext);

      await r2.send(
        new PutObjectCommand({
          Bucket: imagesBucket(),
          Key: destKey,
          Body: file.bytes,
          ContentType: file.contentType,
        }),
      );

      // Mesmo shape do /api/v1/images/import (upload próprio no acervo).
      const { error: insertErr } = await admin.from("image_generations").insert({
        id: randomUUID(),
        user_id: userId,
        name: file.filename?.replace(/\.[a-zA-Z0-9]{1,5}$/, "") || "Foto enviada",
        prompt: "",
        input_image_path: "",
        aspect_ratio: "auto",
        resolution: "original",
        credits_cost: 0,
        image_path: destKey,
        status: "ready",
        kie_model: "upload",
      });
      if (insertErr) throw new Error(insertErr.message);

      result.imported++;
      allKeys.push(destKey);
    } catch (e) {
      result.failed.push({ id: fileId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Referência do clone: só define se ainda não existe (não sobrescreve
  // escolha do aluno). 1 foto = ela; várias = 1 aleatória.
  let referenceKey: string | null = null;
  if (allKeys.length > 0) {
    const { data: prof } = await admin
      .from("profiles")
      .select("image_ref_key")
      .eq("id", userId)
      .maybeSingle();
    if (prof && !prof.image_ref_key) {
      referenceKey = allKeys[Math.floor(Math.random() * allKeys.length)];
      await admin.from("profiles").update({ image_ref_key: referenceKey }).eq("id", userId);
    } else {
      referenceKey = (prof?.image_ref_key as string | null) ?? null;
    }
  }

  return { ...result, reference_key: referenceKey };
}

export type AudioImportResult = ImportResult & {
  voice_id: string | null;
  voice_status: string | null;
};

/**
 * Importa os áudios do Drive pra área de TREINO (voz em awaiting_training).
 * NÃO dispara treino — o aluno (com créditos) clica em Treinar depois.
 */
export async function importTrainingAudios(
  admin: Admin,
  userId: string,
  fileIds: string[],
): Promise<AudioImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: [] };
  if (fileIds.length === 0) return { ...result, voice_id: null, voice_status: null };

  // Idempotência: a voz do onboarding já existe e passou do upload → pronto.
  const { data: existing } = await admin
    .from("voices")
    .select("id, status")
    .eq("user_id", userId)
    .eq("name", ONBOARDING_VOICE_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status !== "uploading") {
    result.skipped = fileIds.length;
    return { ...result, voice_id: existing.id as string, voice_status: existing.status as string };
  }

  let voiceId = existing?.id as string | undefined;
  if (!voiceId) {
    const { data: voice, error } = await admin
      .from("voices")
      .insert({ user_id: userId, name: ONBOARDING_VOICE_NAME, status: "uploading" })
      .select("id")
      .single();
    if (error || !voice) throw new Error(`criar voice falhou: ${error?.message}`);
    voiceId = voice.id as string;
  }

  const uploadedKeys: string[] = [];
  for (let i = 0; i < Math.min(fileIds.length, MAX_AUDIOS); i++) {
    const fileId = fileIds[i];
    try {
      const file = await downloadDriveFile(fileId, MAX_AUDIO_BYTES);
      const ext = pickExtension(file.filename, file.contentType, "mp3");
      const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
      // Chave determinística por fileId — re-rodar sobrescreve o mesmo objeto.
      const key = buildRawAudioKey(userId, voiceId, i, `onboarding_${safeId}.${ext}`);
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKETS.voices,
          Key: key,
          Body: file.bytes,
          ContentType: file.contentType,
        }),
      );
      uploadedKeys.push(key);
      result.imported++;
    } catch (e) {
      result.failed.push({ id: fileId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (uploadedKeys.length === 0) {
    // Nada subiu — deixa a voz em "uploading" pra próxima tentativa retomar.
    return { ...result, voice_id: voiceId, voice_status: "uploading" };
  }

  // Duração via ffmpeg (mesma régua do uploads-complete: <20min brutos rejeita).
  const urls = await Promise.all(
    uploadedKeys.map((k) => createPresignedGet(R2_BUCKETS.voices, k, 3600)),
  );
  const estimate = await estimateSpeechSeconds(urls);
  const totalSec = estimate.reliable ? estimate.totalSeconds : 0;

  let nextStatus: VoiceStatus;
  let errorMessage: string | null = null;
  if (!estimate.reliable) {
    // Medição falhou — não bloqueia: o start-training re-mede antes de cobrar.
    nextStatus = "awaiting_training";
  } else if (totalSec < MIN_TOTAL_SECONDS) {
    nextStatus = "rejected_too_short";
    errorMessage = `Áudio total ${Math.round(totalSec / 60)}min < mínimo de ${MIN_TOTAL_SECONDS / 60}min`;
  } else {
    nextStatus = "awaiting_training";
  }

  const { error: updErr } = await admin
    .from("voices")
    .update({
      raw_audio_paths: uploadedKeys,
      duration_seconds: totalSec > 0 ? Math.round(totalSec) : null,
      status: nextStatus,
      error_message: errorMessage,
    })
    .eq("id", voiceId);
  if (updErr) throw new Error(`atualizar voice falhou: ${updErr.message}`);

  return { ...result, voice_id: voiceId, voice_status: nextStatus };
}
