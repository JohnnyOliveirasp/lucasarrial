/**
 * POST /api/v1/voices/[id]/start-training
 *
 * Voice precisa estar em status="awaiting_training".
 * Backend:
 *   1. Gera presigned GET URLs (2h) pros raw_audio_paths
 *   2. Gera presigned PUT URL (2h) pro `<user>/<voice>/lora.safetensors`
 *   3. Chama RunPod /run com { type: "train", audio_urls, lora_upload_url }
 *   4. Salva runpod_job_id na voice, move status="training"
 *   5. Cria row em training_jobs
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";
import {
  buildAutoReferenceKey,
  buildLoraKey,
  createPresignedGet,
  createPresignedPut,
} from "@/lib/r2/presigned";
import { R2_BUCKETS } from "@/lib/r2/client";
import { runpodSubmitTrain, webhookUrlFor } from "@/lib/runpod/client";
import { estimateSpeechSeconds } from "@/lib/audio/speech-estimate";

type Ctx = { params: Promise<{ id: string }> };

const TRAIN_EXPIRES_SECONDS = 2 * 60 * 60; // 2h
// 500 = config que funciona com este dataset/codebase + alpha=16 (Aluno2 prova).
// 1000 (default do desktop VoiceLoraStudio/core.py:683) causou overfit no
// LoRA -> EsposaLucas saiu embolada com 26s de mumble no meio. Dataset/setup
// daqui responde melhor a 500 + alpha=16.
const DEFAULT_MAX_STEPS = 500;

/** Espelha TRAIN_MIN_USEFUL_SECONDS do runpod-worker/handler.py (10 min). */
const MIN_USEFUL_SPEECH_SECONDS = 10 * 60;

// Idiomas aceitos pro Whisper do treino (referência/amostra). Default pt —
// comportamento inalterado pro app; es/en usados pelas Vozes Prontas.
const TRAIN_LANGUAGES = new Set(["pt", "es", "en"]);

/**
 * Teto de execução do job (policy.executionTimeout), como nos clones
 * (video-clone/config.ts). Medido em prod 21-22/07: treino de dataset
 * 20-80min roda 6-8min em GPU rápida, mas worker frio + GPU lenta passou de
 * 10min (default antigo do endpoint → "executionTimeout exceeded"). Base
 * 20min pro cold start + 0,3s de GPU por segundo de áudio: 60min de áudio →
 * teto 38min. Rede de segurança, não meta.
 */
function trainExecutionTimeoutMs(durationSeconds: number | null): number {
  const dur = Math.ceil(durationSeconds || 3600); // sem duração conhecida = pior caso
  // Base 30min (07/08: 2 treinos morreram em workers FRIOS recém-criados no
  // rebalance da quota — a carga inicial do modelo come o teto antigo de 20).
  return (30 * 60 + Math.ceil(dur * 0.3)) * 1000;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let language = "pt";
  try {
    const body = (await request.json()) as { language?: unknown };
    if (typeof body?.language === "string" && TRAIN_LANGUAGES.has(body.language)) {
      language = body.language;
    }
  } catch {
    /* sem body → pt */
  }

  const admin = getAdmin();

  const { data: voice, error: loadErr } = await admin
    .from("voices")
    .select("id, user_id, status, raw_audio_paths, duration_seconds")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (loadErr) return serverError("Failed to load voice");
  if (!voice) return notFound("Voice");
  if (voice.status !== "awaiting_training") {
    return badRequest(`Voice status '${voice.status}' is not 'awaiting_training'`);
  }

  const paths = Array.isArray(voice.raw_audio_paths) ? voice.raw_audio_paths : [];
  if (paths.length === 0) return badRequest("Voice has no audio paths");

  // Clonar/treinar custa TRAINING_CREDIT_COST. Equipe/admin não é cobrada.
  const billed = !bypassesBilling(auth.email);
  if (billed) {
    const bal = await getBalance(auth.user_id);
    if (bal.total < TRAINING_CREDIT_COST) {
      // subscribed = assinatura ativa → CTA do popup "comprar avulso";
      // sem assinatura → "assinar" (o avulso exige assinatura ativa).
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError(
        "insufficient_credits",
        `Créditos insuficientes: treinar uma voz custa ${TRAINING_CREDIT_COST} e você tem ${bal.total}.`,
        402,
        { subscribed, balance: bal.total, cost: TRAINING_CREDIT_COST },
      );
    }
  }

  /**
   * 🐛 BUGFIX 2026-08-18 — A TRAVA DO "TREINAR".
   * Dois cliques viravam DOIS treinos da MESMA voz e DOIS débitos de 10.000
   * (caso rafaelleitemacedo: 21:35:14 e 21:35:23 — 9 segundos de diferença).
   * A checagem lá em cima só LIA o status: as duas requisições liam
   * "awaiting_training" e passavam juntas. A trava de verdade é esta —
   * quem consegue VIRAR o status é o único que segue (mesmo padrão dos gates
   * idempotentes do webhook/poll). O botão da tela também trava, mas UI
   * nenhuma protege contra clique duplo, reenvio de rede ou duas abas.
   * Fica ANTES da parte lenta (estimativa de fala leva até 90s — é dentro
   * dessa janela que o segundo clique entrava).
   */
  const { data: claimed } = await admin
    .from("voices")
    .update({ status: "training", error_message: null })
    .eq("id", voice.id)
    .eq("status", "awaiting_training")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return jsonError(
      "training_already_started",
      "O treino desta voz já começou. Aguarde ele terminar — você recebe a voz em alguns minutos.",
      409,
    );
  }
  /** Devolve a voz pra fila quando algo falha depois da reserva — senão ela
   *  fica presa em "training" pra sempre e o aluno não consegue tentar. */
  const desfazerReserva = async () => {
    await admin
      .from("voices")
      .update({ status: "awaiting_training" })
      .eq("id", voice.id)
      .eq("status", "training");
  };

  // 1. Presigned GETs pros áudios
  let audioUrls: string[];
  let loraUploadUrl: string;
  let referenceUploadUrl: string;
  let sampleUploadUrl: string;
  const loraKey = buildLoraKey(auth.user_id, voice.id);
  const referenceKey = buildAutoReferenceKey(auth.user_id, voice.id);
  // Amostra automática pós-treino (anti-churn): o worker gera ~10s com a voz
  // nova e sobe aqui; o webhook/sync vira uma linha em `generations` (ready).
  const sampleKey = `${auth.user_id}/${voice.id}/sample.wav`;

  try {
    audioUrls = await Promise.all(
      paths.map((key) =>
        createPresignedGet(R2_BUCKETS.voices, key, TRAIN_EXPIRES_SECONDS),
      ),
    );
    loraUploadUrl = await createPresignedPut(
      R2_BUCKETS.voices,
      loraKey,
      "application/octet-stream",
      TRAIN_EXPIRES_SECONDS,
    );
    // O worker corta 2 min de 1 áudio e sobe aqui como a referência da voz.
    referenceUploadUrl = await createPresignedPut(
      R2_BUCKETS.voices,
      referenceKey,
      "audio/wav",
      TRAIN_EXPIRES_SECONDS,
    );
    // Bucket de generations = onde o player do histórico sabe ler.
    sampleUploadUrl = await createPresignedPut(
      R2_BUCKETS.generations,
      sampleKey,
      "audio/wav",
      TRAIN_EXPIRES_SECONDS,
    );
  } catch (e) {
    await desfazerReserva();
    return serverError(
      e instanceof Error ? `R2 presigned: ${e.message}` : "R2 presigned failed",
    );
  }

  // 1b. Fala aproveitável ANTES de cobrar e despachar (bug 08/08: a pessoa
  // mandava 20min brutos cheios de pausa, o worker achava <10min de fala e
  // reprovava só depois da fila+GPU; 3 tentativas e desistência). A estimativa
  // é por energia = TETO do que o VAD vai achar, então só bloqueia quando a
  // reprovação é matemática. Medição falhou → segue o jogo (nunca travar).
  try {
    const est = await estimateSpeechSeconds(audioUrls);
    if (est.reliable && est.speechSeconds < MIN_USEFUL_SPEECH_SECONDS) {
      const haveMin = Math.max(1, Math.round(est.speechSeconds / 60));
      const missingMin = Math.max(
        1,
        Math.ceil((MIN_USEFUL_SPEECH_SECONDS - est.speechSeconds) / 60),
      );
      // Volta pra fila (o aluno vai adicionar áudio e tentar de novo) e
      // registra o motivo pra ele ver na tela.
      await admin
        .from("voices")
        .update({
          status: "awaiting_training",
          error_message:
            `Seu áudio tem cerca de ${haveMin} min de fala (o resto é pausa ou silêncio) ` +
            `e o treino precisa de pelo menos ${MIN_USEFUL_SPEECH_SECONDS / 60} min falando.`,
        })
        .eq("id", voice.id);
      return jsonError(
        "insufficient_speech",
        `Seu áudio tem cerca de ${haveMin} min de fala — o resto é pausa ou silêncio. ` +
          `Para clonar sua voz precisamos de pelo menos ${MIN_USEFUL_SPEECH_SECONDS / 60} min falando: ` +
          `grave mais ${missingMin} min (pode adicionar outro arquivo) e tente de novo. ` +
          `Nada foi cobrado.`,
        400,
        { speech_seconds: est.speechSeconds, min_required_seconds: MIN_USEFUL_SPEECH_SECONDS },
      );
    }
  } catch (e) {
    console.error("[start-training] estimativa de fala falhou:", e instanceof Error ? e.message : e);
  }

  // 2. Submete pra RunPod (com webhook se SITE_URL estiver definida)
  let runpodJob;
  try {
    runpodJob = await runpodSubmitTrain(
      {
        type: "train",
        voice_id: voice.id,
        audio_urls: audioUrls,
        lora_upload_url: loraUploadUrl,
        reference_upload_url: referenceUploadUrl,
        sample_upload_url: sampleUploadUrl,
        max_steps: DEFAULT_MAX_STEPS,
        language,
      },
      {
        webhook: webhookUrlFor("training"),
        executionTimeoutMs: trainExecutionTimeoutMs(voice.duration_seconds),
      },
    );
  } catch (e) {
    await desfazerReserva();
    return serverError(
      e instanceof Error ? `RunPod submit: ${e.message}` : "RunPod submit failed",
    );
  }

  // 3. Atualiza voice + cria training_job
  const { error: updateErr } = await admin
    .from("voices")
    .update({
      status: "training",
      runpod_job_id: runpodJob.id,
      lora_path: loraKey,
      error_message: null,
    })
    .eq("id", voice.id);

  if (updateErr) return serverError("Failed to update voice status");

  await admin.from("training_jobs").insert({
    voice_id: voice.id,
    user_id: auth.user_id,
    runpod_job_id: runpodJob.id,
    status: "queued",
  });

  // Debita após o treino ser disparado com sucesso (débito atômico no banco).
  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: TRAINING_CREDIT_COST,
      kind: "training",
      refType: "voice",
      refId: voice.id,
      note: "clonagem/treino de voz",
    });
  }

  return jsonOk({
    voice_id: voice.id,
    runpod_job_id: runpodJob.id,
    status: "training",
  });
}
