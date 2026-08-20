/**
 * Onboarding — dispara o TREINO da voz importada (correção Johnny 13/08:
 * "o sistema precisa mandar para treinamento a voz dele").
 *
 * Réplica do core do POST /api/v1/voices/[id]/start-training SEM HTTP.
 * COBRA o aluno (correção Johnny 17/08 — antes era por conta da casa e o
 * estorno de treino falho ainda devolvia 10k nunca cobrados): mesmo custo,
 * mesma checagem de saldo e mesmo shape de débito do start-training — assim
 * o estorno automático do finalize-training funciona igual. Sem saldo, o
 * treino NÃO dispara (crédito é o único gate); a voz fica awaiting_training
 * e o aluno treina pelo app quando tiver créditos. Qualquer mudança de
 * receita lá (max_steps, timeout, chaves) deve espelhar aqui — comentários
 * cruzados nos dois arquivos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  buildAutoReferenceKey,
  buildLoraKey,
  createPresignedGet,
  createPresignedPut,
} from "@/lib/r2/presigned";
import { R2_BUCKETS } from "@/lib/r2/client";
import { runpodSubmitTrain, webhookUrlFor } from "@/lib/runpod/client";
import { estimateSpeechSeconds } from "@/lib/audio/speech-estimate";
import { bypassesBilling } from "@/lib/credits/access";
import { debitCredits, getBalance } from "@/lib/credits/service";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";

type Admin = SupabaseClient<Database>;

const TRAIN_EXPIRES_SECONDS = 2 * 60 * 60;
const DEFAULT_MAX_STEPS = 500; // mesma receita do start-training (Aluno2 prova)
const MIN_USEFUL_SPEECH_SECONDS = 10 * 60;

function trainExecutionTimeoutMs(durationSeconds: number | null): number {
  const dur = Math.ceil(durationSeconds || 3600);
  return (30 * 60 + Math.ceil(dur * 0.3)) * 1000;
}

export type TreinoResult =
  | { ok: true; runpod_job_id: string }
  | { ok: false; reason: string };

export async function dispararTreinoOnboarding(
  admin: Admin,
  userId: string,
  voiceId: string,
): Promise<TreinoResult> {
  const { data: voice } = await admin
    .from("voices")
    .select("id, user_id, status, raw_audio_paths, duration_seconds")
    .eq("id", voiceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!voice) return { ok: false, reason: "voz não encontrada" };
  if (voice.status !== "awaiting_training") {
    return { ok: false, reason: `status '${voice.status}' != awaiting_training` };
  }
  const paths = Array.isArray(voice.raw_audio_paths) ? voice.raw_audio_paths : [];
  if (paths.length === 0) return { ok: false, reason: "sem áudios" };

  // Mesma cobrança do start-training (equipe/admin não paga). Saldo checado
  // ANTES do despacho; o débito em si acontece depois, como lá.
  const { data: prof } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const billed = !bypassesBilling((prof as { email?: string } | null)?.email ?? null);
  if (billed) {
    const bal = await getBalance(userId);
    if (bal.total < TRAINING_CREDIT_COST) {
      // ⚠️ Esta frase é um RETRATO do saldo de agora e ninguém a limpa quando
      // o crédito entra depois (bug bea487b7). As rotas GET de voices a OMITEM
      // quando o saldo ao vivo já cobre o treino, reconhecendo-a pelo prefixo
      // "Treinar a voz custa" — se mudar a redação aqui, espelhe o prefixo em
      // lib/voices/mensagem-saldo.ts.
      await admin
        .from("voices")
        .update({
          error_message:
            `Treinar a voz custa ${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos ` +
            `e você tem ${bal.total.toLocaleString("pt-BR")}. Assine ou recarregue e ` +
            `clique em Treinar.`,
        })
        .eq("id", voice.id);
      return {
        ok: false,
        reason: `sem créditos (treino custa ${TRAINING_CREDIT_COST}, saldo ${bal.total})`,
      };
    }
  }

  const loraKey = buildLoraKey(userId, voice.id);
  const referenceKey = buildAutoReferenceKey(userId, voice.id);
  const sampleKey = `${userId}/${voice.id}/sample.wav`;

  const audioUrls = await Promise.all(
    paths.map((key) => createPresignedGet(R2_BUCKETS.voices, key, TRAIN_EXPIRES_SECONDS)),
  );
  const loraUploadUrl = await createPresignedPut(
    R2_BUCKETS.voices, loraKey, "application/octet-stream", TRAIN_EXPIRES_SECONDS,
  );
  const referenceUploadUrl = await createPresignedPut(
    R2_BUCKETS.voices, referenceKey, "audio/wav", TRAIN_EXPIRES_SECONDS,
  );
  const sampleUploadUrl = await createPresignedPut(
    R2_BUCKETS.generations, sampleKey, "audio/wav", TRAIN_EXPIRES_SECONDS,
  );

  // Fala aproveitável ANTES de despachar (mesma régua do start-training).
  try {
    const est = await estimateSpeechSeconds(audioUrls);
    if (est.reliable && est.speechSeconds < MIN_USEFUL_SPEECH_SECONDS) {
      const haveMin = Math.max(1, Math.round(est.speechSeconds / 60));
      await admin
        .from("voices")
        .update({
          error_message:
            `Seu áudio tem cerca de ${haveMin} min de fala (o resto é pausa ou silêncio) ` +
            `e o treino precisa de pelo menos ${MIN_USEFUL_SPEECH_SECONDS / 60} min falando.`,
        })
        .eq("id", voice.id);
      return { ok: false, reason: `fala insuficiente (~${haveMin}min < 10min)` };
    }
  } catch (e) {
    console.error("[onboarding/treino] estimativa falhou:", e instanceof Error ? e.message : e);
  }

  const runpodJob = await runpodSubmitTrain(
    {
      type: "train",
      voice_id: voice.id,
      audio_urls: audioUrls,
      lora_upload_url: loraUploadUrl,
      reference_upload_url: referenceUploadUrl,
      sample_upload_url: sampleUploadUrl,
      max_steps: DEFAULT_MAX_STEPS,
      language: "pt",
    },
    {
      webhook: webhookUrlFor("training"),
      executionTimeoutMs: trainExecutionTimeoutMs(voice.duration_seconds as number | null),
    },
  );

  const { error: updateErr } = await admin
    .from("voices")
    .update({
      status: "training",
      runpod_job_id: runpodJob.id,
      lora_path: loraKey,
      error_message: null,
    })
    .eq("id", voice.id);
  if (updateErr) return { ok: false, reason: `update voice: ${updateErr.message}` };

  await admin.from("training_jobs").insert({
    voice_id: voice.id,
    user_id: userId,
    runpod_job_id: runpodJob.id,
    status: "queued",
  });

  // Debita após o treino ser disparado com sucesso (mesmo shape do
  // start-training — o estorno do finalize-training casa com este débito).
  if (billed) {
    await debitCredits({
      userId,
      amount: TRAINING_CREDIT_COST,
      kind: "training",
      refType: "voice",
      refId: voice.id,
      note: "clonagem/treino de voz (onboarding)",
    });
  }

  return { ok: true, runpod_job_id: runpodJob.id };
}
