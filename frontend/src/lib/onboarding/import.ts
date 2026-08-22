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
 *   COBRADO do aluno) — esses SIM aparecem no histórico (são gerados).
 * - Áudios → voz "Minha Voz" e DISPARA O TREINO na hora (COBRADO do aluno,
 *   lib/onboarding/treino.ts) — o aluno já entra com a voz treinando.
 *   (Correção Johnny 17/08: antes era por conta da casa; sem saldo o item
 *   não roda e o motivo vai na nota da planilha.)
 *
 * Tudo idempotente por fileId do Drive: chave R2 determinística → reprocessar
 * a mesma linha da planilha não duplica nada.
 */
import { randomUUID } from "crypto";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, VoiceStatus } from "@/lib/db/types";
import { imagesBucket, r2, R2_BUCKETS } from "@/lib/r2/client";
import { buildRawAudioKey, createPresignedGet } from "@/lib/r2/presigned";
import { adotarReferencia } from "@/lib/images/refs";
import { estimateSpeechSeconds } from "@/lib/audio/speech-estimate";
import {
  MIN_TOTAL_SECONDS,
  RX_EXT_AUDIO_NUA,
  mensagemCurtoDemais,
} from "@/lib/voices/regua-audio";
import { rm } from "node:fs/promises";
import { dirTemporario } from "./tmp";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadDriveFile, downloadDriveFileToPath, pickExtension } from "./drive";
import { sniffImagem, heicParaJpegViaDrive, trocarExtensao } from "./imagem-tipo";
import { extrairFramesDeArquivo } from "./video-frames";
import { escolherReferenciaFrontal } from "./referencia";
import { dispararTreinoOnboarding } from "./treino";

type Admin = SupabaseClient<Database>;

const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB por foto
// Lote 1 (14/08): "fotos" do aluno = 1 VÍDEO dele (165-304MB). Baixamos o
// vídeo com teto próprio e extraímos 3 frames que viram as fotos.
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // streaming pra disco — tamanho quase não importa (A248: 878MB)
const MAX_AUDIO_BYTES = 400 * 1024 * 1024; // 400MB por take (1h WAV cabe)
const MAX_IMAGES = 20;
const MAX_AUDIOS = 20; // mesmo teto do MAX_FILES_PER_VOICE
/* A régua de 20min brutos vive em @/lib/voices/regua-audio (importada acima). */
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
 * Das chaves que o BANCO diz existir, quais estão MESMO no R2 (caso Ricardo
 * 17/08). Linha órfã é pior que linha ausente: ela some da reimportação e
 * ainda é oferecida ao Kie, que falha ao baixar.
 */
async function filtrarExistentesNoR2(chaves: string[]): Promise<string[]> {
  const vivas = await Promise.all(
    chaves.map(async (key) => {
      try {
        await r2.send(new HeadObjectCommand({ Bucket: imagesBucket(), Key: key }));
        return key;
      } catch {
        console.error(`[onboarding/import] foto fantasma (linha sem objeto no R2): ${key}`);
        return null;
      }
    }),
  );
  return vivas.filter((k): k is string => k !== null);
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
  // STREAMING pra disco (A248: 878MB — nada de Buffer gigante na RAM).
  // Sem filtro de content-type: o Drive serve .mp4/.mov como octet-stream;
  // o ffprobe decide — se não for vídeo, a extração lança e vira "ignorado".
  const dir = await dirTemporario("onbdl-");
  let frames: Buffer[];
  try {
    const src = join(dir, "video.bin");
    await downloadDriveFileToPath(fileId, src, MAX_VIDEO_BYTES);
    frames = await extrairFramesDeArquivo(src);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
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
      // ⚠️ CONFERE NO R2 (caso Ricardo 17/08): existia linha no banco cujo
      // objeto NÃO estava no R2; a foto fantasma era pulada aqui, virava a
      // referência do avatar e o Kie falhava com "Error while downloading" —
      // 3 avatares perdidos (cobrados e estornados). Linha sem arquivo não
      // conta como importada: reimporta.
      const probe = imageDestKey(userId, fileId, "");
      const { data: existingRows } = await admin
        .from("image_generations")
        .select("id, image_path")
        .eq("user_id", userId)
        .like("image_path", `${probe}%`)
        .limit(5);
      const existentesNoR2 = await filtrarExistentesNoR2(
        (existingRows ?? []).map((ex) => ex.image_path as string),
      );
      if (existentesNoR2.length > 0) {
        result.skipped++;
        allKeys.push(...existentesNoR2);
        continue;
      }

      const file = await downloadDriveFile(fileId, MAX_IMAGE_BYTES);
      // 22/08: quem decide é o CONTEÚDO, não o content-type. O Drive serve
      // .HEIC do iPhone como application/octet-stream, e confiar no rótulo
      // mandava 15 linhas da planilha pro caminho de vídeo (ffprobe: "moov
      // atom not found") com a pasta cheia de foto boa. Ver imagem-tipo.ts.
      const tipo = sniffImagem(file.bytes);
      if (!tipo) {
        throw new Error(`não é imagem (${file.contentType})`);
      }

      let bytes = file.bytes;
      let contentType = tipo.mime;
      let filename = file.filename;
      let ext = tipo.ext;
      if (tipo.heic) {
        // Nada no resto do sistema (R2, Kie, avatares) abre HEIC.
        bytes = await heicParaJpegViaDrive(fileId, MAX_IMAGE_BYTES);
        contentType = "image/jpeg";
        ext = "jpg";
        filename = trocarExtensao(filename, "jpg");
      }
      const destKey = imageDestKey(userId, fileId, ext);

      await r2.send(
        new PutObjectCommand({
          Bucket: imagesBucket(),
          Key: destKey,
          Body: bytes,
          ContentType: contentType,
        }),
      );

      // Mesmo shape do /api/v1/images/import (upload próprio no acervo).
      const { error: insertErr } = await admin.from("image_generations").insert({
        id: randomUUID(),
        user_id: userId,
        name: filename?.replace(/\.[a-zA-Z0-9]{1,5}$/, "") || "Foto enviada",
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
      // Adota já no nascimento (19/08): a chave crua aponta pra dentro de uma
      // geração — se o aluno apagar aquela linha do histórico, a referência
      // morre. Em refs/ ela sobrevive ao histórico inteiro.
      try {
        referenceKey = await adotarReferencia(userId, referenceKey);
      } catch { /* adoção falhou: fica a crua, o ref-default adota depois */ }
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

/** Tenta disparar o treino (cobrado do aluno); nunca derruba o import. */
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
  // `ignored` PRECISA nascer aqui: a linha que empurra não-áudio faz
  // `result.ignored!.push(...)`, e o `!` só engana o TypeScript — em runtime
  // dava "Cannot read properties of undefined (reading 'push')" e derrubava o
  // import inteiro. Justo no caso mais comum: o aluno joga foto e áudio na
  // MESMA pasta do Drive. Casos reais 22/08: linhas 327 e 328.
  const result: ImportResult = { imported: 0, skipped: 0, failed: [], ignored: [] };
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
      // Só ÁUDIO entra na lista do treino (incidente 910ea757, 20/08): a pasta
      // do Drive do aluno costuma misturar as FOTOS com os áudios, e todo
      // arquivo virava `raw_audio_paths`. No treino, o ffmpeg de conversão
      // topava um .jpg e devolvia "Output file #0 does not contain any
      // stream" — o job inteiro falhava e o aluno recebia "seu arquivo chegou
      // corrompido, envie de novo" (mensagem falsa: ele nunca enviou nada,
      // veio da planilha). Medido: 4 vozes travadas, uma delas com 9 de 9
      // arquivos sendo foto. Não-áudio agora é "ignorado", não derruba a voz.
      const ext = pickExtension(file.filename, file.contentType, "mp3");
      // A lista vem da régua (fonte única). Manter cópia aqui já custou caro:
      // este filtro aceitava `mov|mkv|wma|amr` e a régua não, então o arquivo
      // era gravado e depois descartado por ela — a casa perdia o áudio do
      // aluno e o recusava por "áudio insuficiente" (medido em 21/08).
      const ehAudio =
        (file.contentType || "").toLowerCase().startsWith("audio/") ||
        RX_EXT_AUDIO_NUA.test(ext);
      if (!ehAudio) {
        result.ignored!.push({
          id: fileId,
          reason: `não é áudio (${file.contentType || ext}) — provavelmente foto na pasta do Drive`,
        });
        continue;
      }
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
    errorMessage = mensagemCurtoDemais(totalSec);
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

  // Johnny 13/08: áudio importado → treino JÁ dispara (cobrado, 17/08).
  let training: string | null = null;
  let finalStatus: string = nextStatus;
  if (nextStatus === "awaiting_training") {
    const t = await tentarTreino(admin, userId, voiceId);
    training = t.nota;
    if (t.status) finalStatus = t.status;
  }

  return { ...result, voice_id: voiceId, voice_status: finalStatus, training };
}
