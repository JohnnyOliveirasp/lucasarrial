/**
 * REDESPACHO de um treino que falhou por causa transitória NOSSA — a perna de
 * execução da retentativa automática (decisão: `retentativa-treino.ts`;
 * gatilho: `finalizeTraining`). Server-only.
 *
 * É o start-training SEM as partes que não fazem sentido na 2ª volta:
 *   · sem auth/HTTP — quem chama é o próprio backend, no fim do job falho;
 *   · sem cobrança — o débito da 1ª tentativa segue de pé (a retentativa não
 *     estornou), então cobrar de novo seria cobrar duas vezes o mesmo treino;
 *   · sem claim de `awaiting_training` — a voz está em `training` (a
 *     finalização da falha foi interceptada antes de marcá-la `failed`);
 *   · sem estimativa de fala — o dataset já passou nessa porta na 1ª vez, e
 *     falha de dataset nem chega aqui (`falhaEhNossa` barra antes).
 *
 * NUNCA lança: quem chama está no meio da finalização de um treino falho, e
 * exceção daqui deixaria a voz presa em `training` sem job vivo — pior que a
 * falha original. Devolve { ok:false, motivo } e o caller segue o caminho
 * normal de falha (estorno + chamado), que é o desfecho seguro.
 */
import { logger } from "@/lib/logger/server";
import { getAdmin } from "@/lib/db/admin";
import {
  buildAutoReferenceKey,
  buildLoraKey,
  createPresignedGet,
  createPresignedPut,
} from "@/lib/r2/presigned";
import { R2_BUCKETS } from "@/lib/r2/client";
import { runpodSubmitTrain, webhookUrlFor } from "@/lib/runpod/client";
import {
  buildSampleKey,
  DEFAULT_MAX_STEPS,
  TRAIN_EXPIRES_SECONDS,
  TRAIN_LANGUAGES,
  trainExecutionTimeoutMs,
} from "@/lib/voices/treino-config";

export type ResultadoDoRedespacho =
  | { ok: true; runpodJobId: string }
  | { ok: false; motivo: string };

export async function redespacharTreinoFalho(args: {
  voiceId: string;
  userId: string;
}): Promise<ResultadoDoRedespacho> {
  const { voiceId, userId } = args;
  try {
    const admin = getAdmin();

    const { data: voice, error: loadErr } = await admin
      .from("voices")
      .select("id, user_id, status, raw_audio_paths, duration_seconds, language")
      .eq("id", voiceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadErr) return { ok: false, motivo: `load voice: ${loadErr.message}` };
    if (!voice) return { ok: false, motivo: "voz não encontrada" };
    // A retentativa só existe DENTRO da finalização de um treino em curso.
    // Voz em outro status = outro fluxo já mexeu nela (resgate, delete) —
    // redespachar por cima seria disputar a voz com esse fluxo.
    if (voice.status !== "training") {
      return { ok: false, motivo: `voz em '${voice.status}', esperava 'training'` };
    }

    const paths = Array.isArray(voice.raw_audio_paths) ? voice.raw_audio_paths : [];
    if (paths.length === 0) return { ok: false, motivo: "voz sem raw_audio_paths" };

    // Idioma: o start-training recebe por body e NÃO persiste na voz (a coluna
    // `language` só é gravada no sucesso, pelo Whisper). Na retentativa o que
    // existe é a coluna; fora do conjunto aceito, cai no MESMO default do
    // despacho original (pt). Vozes do app são pt — es/en é Vozes Prontas.
    const language =
      typeof voice.language === "string" && TRAIN_LANGUAGES.has(voice.language)
        ? voice.language
        : "pt";

    const loraKey = buildLoraKey(userId, voiceId);
    const referenceKey = buildAutoReferenceKey(userId, voiceId);
    const sampleKey = buildSampleKey(userId, voiceId);

    const audioUrls = await Promise.all(
      paths.map((key) => createPresignedGet(R2_BUCKETS.voices, key, TRAIN_EXPIRES_SECONDS)),
    );
    const loraUploadUrl = await createPresignedPut(
      R2_BUCKETS.voices,
      loraKey,
      "application/octet-stream",
      TRAIN_EXPIRES_SECONDS,
    );
    const referenceUploadUrl = await createPresignedPut(
      R2_BUCKETS.voices,
      referenceKey,
      "audio/wav",
      TRAIN_EXPIRES_SECONDS,
    );
    const sampleUploadUrl = await createPresignedPut(
      R2_BUCKETS.generations,
      sampleKey,
      "audio/wav",
      TRAIN_EXPIRES_SECONDS,
    );

    const runpodJob = await runpodSubmitTrain(
      {
        type: "train",
        voice_id: voiceId,
        audio_urls: audioUrls,
        lora_upload_url: loraUploadUrl,
        reference_upload_url: referenceUploadUrl,
        sample_upload_url: sampleUploadUrl,
        max_steps: DEFAULT_MAX_STEPS,
        language,
      },
      {
        webhook: webhookUrlFor("training"),
        executionTimeoutMs: trainExecutionTimeoutMs(voice.duration_seconds ?? null),
      },
    );

    // A voz aponta pro job NOVO. Efeito colateral querido: webhook/poll do job
    // VELHO não casam mais com a voz (o webhook busca por runpod_job_id) — e o
    // gate idempotente do job velho já foi consumido de qualquer forma.
    const { error: updErr } = await admin
      .from("voices")
      .update({
        status: "training",
        runpod_job_id: runpodJob.id,
        lora_path: loraKey,
        error_message: null,
      })
      .eq("id", voiceId);
    if (updErr) {
      // Job já foi pro RunPod; sem o update a voz seguiria o job velho e o
      // resultado novo cairia no vazio. Reportar como falha faz o caller
      // seguir o caminho normal de falha — o job órfão termina e é descartado
      // pelo webhook ("job_id not found"), sem tocar a voz.
      return { ok: false, motivo: `update voice: ${updErr.message}` };
    }

    // A linha nova em training_jobs É o incremento do contador persistido da
    // retentativa (ver retentativa-treino.ts): falhar de novo marca ela
    // `failed` e a contagem chega ao teto.
    const { error: insErr } = await admin.from("training_jobs").insert({
      voice_id: voiceId,
      user_id: userId,
      runpod_job_id: runpodJob.id,
      status: "queued",
    });
    if (insErr) {
      // Sem a linha, a finalização do job novo não acha o que claimar e o
      // CONTADOR não incrementa — o teto viraria mentira. Melhor declarar a
      // retentativa falha agora (caller estorna e abre chamado) do que rodar
      // um treino fora da contabilidade.
      logger.warn("api", "voice.retrain.training_job_nao_inserido", {
        voiceId,
        runpodJobId: runpodJob.id,
        motivo: insErr.message,
      });
      return { ok: false, motivo: `insert training_job: ${insErr.message}` };
    }

    return { ok: true, runpodJobId: runpodJob.id };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
