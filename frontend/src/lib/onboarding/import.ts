/**
 * Importadores do onboarding via planilha (Drive → R2 → banco). Server-only.
 *
 * CORREÇÃO JOHNNY 13/08 (caso Vinicius): as fotos do Drive NÃO são histórico
 * — são matéria-prima de REFERÊNCIA. Fluxo correto:
 * - Fotos → acervo de referência (`image_generations` kie_model="upload";
 *   o card de HISTÓRICO esconde uploads — histórico é só de GERADAS).
 *   A melhor foto (close de rosto FRONTAL, escolhida por visão/Haiku) vira a
 *   referência principal (profiles.image_ref_key); as demais ficam de extras.
 * - Com as fotos, o sistema GERA 2-3 avatares (lib/onboarding/avatares.ts,
 *   por conta da casa) — esses SIM aparecem no histórico (são gerados).
 * - Áudios → voz "Minha Voz" e DISPARA O TREINO na hora (por conta da casa,
 *   lib/onboarding/treino.ts) — o aluno já entra com a voz treinando.
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
import { escolherReferenciaFrontal } from "./referencia";
import { dispararTreinoOnboarding } from "./treino";

type Admin = SupabaseClient<Database>;

const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB por foto
// Lote 1 (14/08): "fotos" do aluno = 1 VÍDEO dele (165-304MB). Baixamos o
// vídeo com teto próprio e extraímos 3 frames que viram as fotos.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
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
  /** Lote 1 (13/08): aluno joga VÍDEO/arquivo gigante na pasta de fotos —
   *  não pode derrubar a linha. Não-imagem/acima do teto vira "ignorado". */
  ignored?: Array<{ id: string; reason: string }>;
};

/** Chave R2 determinística da foto importada (idempotência por fileId). */
function imageDestKey(userId: string, fileId: string, ext: string): string {
  const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${userId}/uploads/onboarding_${safe}.${ext}`;
}

/**
 * Aluno mandou VÍDEO no lugar de foto: baixa com teto maior, extrai 3 frames
 * (15/45/75% da duração) e sobe cada um como foto do acervo. Chaves com o
 * prefixo `onboarding_<fileId>.` — a mesma sonda de idempotência das fotos
 * normais encontra os frames num reprocesso. Devolve quantos frames entraram.
 */
async function importarFramesDoVideo(
  admin: Admin,
  userId: string,
  fileId: string,
  allKeys: string[],
): Promise<number> {
  const file = await downloadDriveFile(fileId, MAX_VIDEO_BYTES);
  // NÃO filtrar por content-type: o Drive serve .mp4/.mov como
  // application/octet-stream (lote 1 v4 — 4 linhas ignoradas por isso).
  // O ffprobe decide: se não for vídeo, a extração lança e vira "ignorado".
  const { extrairFramesDeVideo } = await import("./video-frames");
  const frames = await extrairFramesDeVideo(file.bytes);
  const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  let n = 0;
  for (let i = 0; i < frames.length; i++) {
    const destKey = `${userId}/uploads/onboarding_${safe}.frame${i}.jpg`;
    await r2.send(
      new PutObjectCommand({
        Bucket: imagesBucket(),
        Key: destKey,
        Body: frames[i],
        ContentType: "image/jpeg",
      }),
    );
    const { error: insertErr } = await admin.from("image_generations").insert({
      id: randomUUID(),
      user_id: userId,
      name: `Foto do vídeo (${i + 1})`,
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
    allKeys.push(destKey);
    n++;
  }
  return n;
}

/**
 * Importa as fotos do Drive pro acervo do aluno e define a referência do
 * clone se ainda não houver (profiles.image_ref_key).
 */
export async function importImages(
  admin: Admin,
  userId: string,
  fileIds: string[],
  opts: { forceReference?: boolean } = {},
): Promise<ImportResult & { reference_key: string | null; all_keys: string[] }> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: [], ignored: [] };
  const allKeys: string[] = [];

  for (const fileId of fileIds.slice(0, MAX_IMAGES)) {
    try {
      // Idempotência: o acervo já tem foto(s) com esse fileId? (um vídeo
      // vira até 3 frames, todos com o mesmo prefixo — pega todos.)
      const probe = imageDestKey(userId, fileId, "");
      const { data: existingRows } = await admin
        .from("image_generations")
        .select("id, image_path")
        .eq("user_id", userId)
        .like("image_path", `${probe}%`)
        .limit(5);
      if (existingRows && existingRows.length > 0) {
        result.skipped++;
        for (const ex of existingRows) allKeys.push(ex.image_path as string);
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
      const msg = e instanceof Error ? e.message : String(e);
      // Vídeo (ou arquivo grande) no lugar de foto: tenta extrair 3 frames
      // do vídeo — é o que o time fazia na mão (print do vídeo do aluno).
      if (/teto \d+MB|não é imagem/.test(msg)) {
        try {
          const n = await importarFramesDoVideo(admin, userId, fileId, allKeys);
          if (n > 0) {
            result.imported++;
            continue;
          }
          result.ignored!.push({ id: fileId, reason: msg });
        } catch (e2) {
          result.ignored!.push({
            id: fileId,
            reason: `${msg}; frames: ${e2 instanceof Error ? e2.message : String(e2)}`,
          });
        }
      } else {
        result.failed.push({ id: fileId, error: msg });
      }
    }
  }

  // Tinha arquivos mas nenhum aproveitável → isso SIM é erro da linha.
  if (fileIds.length > 0 && allKeys.length === 0 && result.failed.length === 0) {
    const motivos = result.ignored!.map((x) => x.reason).join("; ").slice(0, 180);
    result.failed.push({
      id: "fotos",
      error: `nenhuma foto aproveitável (${result.ignored!.length} ignorado(s): ${motivos || "?"})`,
    });
  }

  // Referência principal (Johnny 13/08): a foto de CLOSE DE ROSTO FRONTAL,
  // escolhida por visão (Haiku) — não mais aleatória. Só define se não
  // existe (não sobrescreve escolha do aluno), salvo forceReference (usado
  // na correção de contas importadas no modelo antigo).
  let referenceKey: string | null = null;
  if (allKeys.length > 0) {
    const { data: prof } = await admin
      .from("profiles")
      .select("image_ref_key")
      .eq("id", userId)
      .maybeSingle();
    if (prof && (!prof.image_ref_key || opts.forceReference)) {
      let idx = 0;
      try {
        const urls = await Promise.all(
          allKeys.map((k) => createPresignedGet(imagesBucket(), k, 3600)),
        );
        idx = await escolherReferenciaFrontal(urls);
      } catch {
        /* visão falhou → primeira foto */
      }
      referenceKey = allKeys[idx] ?? allKeys[0];
      await admin.from("profiles").update({ image_ref_key: referenceKey }).eq("id", userId);
    } else {
      referenceKey = (prof?.image_ref_key as string | null) ?? null;
    }
  }

  return { ...result, reference_key: referenceKey, all_keys: allKeys };
}

export type AudioImportResult = ImportResult & {
  voice_id: string | null;
  voice_status: string | null;
  training: string | null;
};

/** Tenta disparar o treino (casa paga); nunca derruba o import. */
async function tentarTreino(
  admin: Admin,
  userId: string,
  voiceId: string,
): Promise<{ status: string | null; nota: string }> {
  try {
    const r = await dispararTreinoOnboarding(admin, userId, voiceId);
    return r.ok
      ? { status: "training", nota: "treino disparado" }
      : { status: null, nota: `treino não disparado: ${r.reason}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[onboarding/import] treino:", msg);
    return { status: null, nota: `treino falhou: ${msg}` };
  }
}

/**
 * Importa os áudios do Drive e DISPARA O TREINO (correção Johnny 13/08 —
 * antes ficava parado em awaiting_training esperando o aluno pagar).
 */
export async function importTrainingAudios(
  admin: Admin,
  userId: string,
  fileIds: string[],
): Promise<AudioImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: [] };
  if (fileIds.length === 0) {
    return { ...result, voice_id: null, voice_status: null, training: null };
  }

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
    // Reprocesso de conta importada no modelo antigo: voz parada esperando
    // o aluno pagar → dispara o treino agora (idempotente: training/ready
    // não entram aqui).
    let training: string | null = null;
    if (existing.status === "awaiting_training") {
      const t = await tentarTreino(admin, userId, existing.id as string);
      training = t.nota;
      if (t.status) {
        return { ...result, voice_id: existing.id as string, voice_status: t.status, training };
      }
    }
    return {
      ...result,
      voice_id: existing.id as string,
      voice_status: existing.status as string,
      training,
    };
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
    return { ...result, voice_id: voiceId, voice_status: "uploading", training: null };
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

  // Johnny 13/08: áudio importado → treino JÁ dispara (casa paga).
  let training: string | null = null;
  let finalStatus: string = nextStatus;
  if (nextStatus === "awaiting_training") {
    const t = await tentarTreino(admin, userId, voiceId);
    training = t.nota;
    if (t.status) finalStatus = t.status;
  }

  return { ...result, voice_id: voiceId, voice_status: finalStatus, training };
}
