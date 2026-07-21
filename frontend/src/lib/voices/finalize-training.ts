/**
 * Finaliza um treino de voz (chamado pelo webhook do RunPod E pelo polling —
 * quem chegar primeiro ganha). Concentra: transição idempotente do
 * training_job (gate anti-duplicidade), atualização da voz, telemetria
 * (useful_seconds/steps), ESTORNO quando o áudio útil foi insuficiente e a
 * AMOSTRA automática (linha em generations pro usuário ouvir a voz na hora).
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { buildAutoReferenceKey } from "@/lib/r2/presigned";
import { addExtraCredits } from "@/lib/credits/service";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { bypassesBilling } from "@/lib/credits/access";
import type { VoiceStatus, VoiceUpdate } from "@/lib/db/types";

const SUPPORT_EMAIL = "suporte@fastcloner.com";

export type TrainOutput = {
  voice_id?: string;
  lora_uploaded?: boolean;
  reference_uploaded?: boolean;
  reference_transcript?: string | null;
  lora_alpha?: number;
  elapsed_seconds?: number;
  steps?: number;
  trainer_returncode?: number;
  dataset_chunks?: number;
  useful_seconds?: number;
  min_required_seconds?: number;
  sample_uploaded?: boolean;
  sample_seconds?: number | null;
  sample_error?: string | null;
  /** QA anti-eco da amostra (worker): passed | retried_passed | failed. */
  sample_qa?: string | null;
  sample_qa_similarity?: number | null;
  /** Texto realmente falado na amostra (idioma da voz) — worker e3ea664+. */
  sample_text?: string | null;
  /** Idioma detectado no áudio de treino (ISO: pt/es/en...) — worker e3ea664+. */
  language?: string | null;
  error?: string;
  stdout_tail?: string;
  stderr_tail?: string;
};

/** Texto fixo da amostra — TEM que bater com DEFAULT_SAMPLE_TEXT do worker. */
const SAMPLE_TEXT =
  "Oi! Esta é a minha voz clonada. Se você está me ouvindo com clareza, o treinamento funcionou muito bem.";

/** Erros de dataset inútil → o usuário não recebeu nada; devolvemos os créditos.
 * Checa também o erro CRU: quando o worker devolve {"error": ...}, o RunPod
 * marca o job FAILED e o texto chega via runpodError (out.error vazio) — sem
 * isso o usuário via "problema técnico, tente de novo" e re-tentava o MESMO
 * arquivo ruim em loop (visto 3× em prod 21/07). */
function isDatasetError(error: string | null | undefined): boolean {
  if (!error) return false;
  return (
    error.includes("insufficient_audio") ||
    error.includes("no usable speech segments")
  );
}

function friendlyTrainError(out: TrainOutput, rawError: string): string {
  if (isDatasetError(out.error) || isDatasetError(rawError)) {
    const useful = Math.round((out.useful_seconds ?? 0) / 60);
    const min = Math.round((out.min_required_seconds ?? 600) / 60);
    const numbers =
      typeof out.useful_seconds === "number"
        ? `apenas ~${useful}min serviram para o treino (mínimo: ${min}min de fala limpa)`
        : `não sobrou fala limpa suficiente para o treino`;
    return (
      `Do áudio enviado, ${numbers}. ` +
      `Seus créditos foram devolvidos. Grave num ambiente silencioso, falando continuamente ` +
      `e próximo ao microfone, e tente de novo com essa gravação nova.`
    );
  }
  // Falha técnica: culpa NOSSA, não do usuário — o estorno é automático.
  return (
    "Tivemos um problema técnico durante o treinamento — não foi culpa sua. " +
    "Seus créditos foram devolvidos automaticamente e nossa equipe já foi notificada. " +
    "Por favor, tente treinar novamente."
  );
}

/** Alerta interno: falha TÉCNICA de treino vai pro suporte na hora. Best-effort. */
async function alertSupportTrainFailure(args: {
  userId: string;
  userEmail: string | null;
  voiceId: string;
  runpodJobId: string;
  runpodStatus: string;
  rawError: string;
  refunded: boolean;
}): Promise<void> {
  const userEmail = args.userEmail ?? "(sem e-mail)";
  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `⚠️ Falha técnica no treino de voz — ${userEmail}`,
    html:
      `<p>Um treino de voz falhou por erro <strong>técnico</strong> (não é erro de dataset do usuário).</p>` +
      `<ul>` +
      `<li><strong>Usuário:</strong> ${escapeHtml(userEmail)} (${args.userId})</li>` +
      `<li><strong>Voz:</strong> ${args.voiceId}</li>` +
      `<li><strong>Job RunPod:</strong> ${args.runpodJobId} (${escapeHtml(args.runpodStatus)})</li>` +
      `<li><strong>Erro:</strong> <code>${escapeHtml(args.rawError.slice(0, 500))}</code></li>` +
      `<li><strong>Estorno de ${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos:</strong> ${args.refunded ? "aplicado automaticamente" : "FALHOU — aplicar manualmente!"}</li>` +
      `</ul>` +
      `<p>O usuário viu uma mensagem amigável avisando do estorno. Detalhes completos no /admin.</p>`,
  });
}

export async function finalizeTraining(args: {
  voiceId: string;
  userId: string;
  runpodJobId: string;
  runpodStatus: string; // COMPLETED | FAILED | CANCELLED | TIMED_OUT
  output: TrainOutput;
  runpodError?: string | null;
}): Promise<{ applied: boolean; status: VoiceStatus }> {
  const { voiceId, userId, runpodJobId, runpodStatus, output: out } = args;
  const admin = getAdmin();

  const success = runpodStatus === "COMPLETED" && !out.error && out.trainer_returncode === 0;
  const nextStatus: VoiceStatus = success ? "ready" : "failed";
  const rawError = out.error || args.runpodError || `RunPod ${runpodStatus}`;
  // Admin vê o erro CRU (diagnóstico); o usuário vê a versão amigável.
  const adminError = success ? null : rawError.slice(0, 500);
  const errorMessage = success ? null : friendlyTrainError(out, rawError);

  // ── Gate idempotente: só UM caminho (webhook OU poll) finaliza ──────────
  const { data: claimed } = await admin
    .from("training_jobs")
    .update({
      status: success ? "completed" : "failed",
      elapsed_seconds: Math.round(out.elapsed_seconds ?? 0),
      steps: out.steps ?? null,
      useful_seconds: out.useful_seconds ?? null,
      error_message: adminError,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("runpod_job_id", runpodJobId)
    .in("status", ["queued", "running"])
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { applied: false, status: nextStatus };
  }

  // ── Voz ─────────────────────────────────────────────────────────────────
  const update: VoiceUpdate = {
    status: nextStatus,
    error_message: errorMessage,
    trained_at: success ? new Date().toISOString() : null,
  };
  if (success && out.reference_uploaded) {
    update.reference_audio_path = buildAutoReferenceKey(userId, voiceId);
    update.reference_transcript = out.reference_transcript ?? null;
  }
  if (success && typeof out.lora_alpha === "number") {
    update.lora_alpha = out.lora_alpha;
  }
  if (success && typeof out.language === "string" && out.language) {
    // Idioma detectado no treino — a geração/QA passam a rodar no idioma certo.
    (update as Record<string, unknown>).language = out.language;
  }
  await admin.from("voices").update(update).eq("id", voiceId);

  // ── Estorno em QUALQUER falha (dataset OU técnica): usuário não recebeu ──
  // nada, não paga nada. Só quem foi COBRADO (equipe/admin não paga o treino).
  // Idempotente via gate acima (só um caminho chega aqui por job).
  if (!success) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const userEmail = (profile as { email?: string } | null)?.email ?? null;
    const billed = !bypassesBilling(userEmail);

    let refunded = !billed; // não cobrado = nada a devolver
    if (billed) {
      const r = await addExtraCredits({
        userId,
        amount: TRAINING_CREDIT_COST,
        refType: "voice_train_refund",
        refId: voiceId,
      });
      refunded = r.ok;
    }

    // Falha técnica → alerta imediato pro suporte (best-effort).
    if (!isDatasetError(out.error) && !isDatasetError(rawError)) {
      await alertSupportTrainFailure({
        userId,
        userEmail,
        voiceId,
        runpodJobId,
        runpodStatus,
        rawError,
        refunded,
      });
    }
  }

  // ── QA da amostra reprovou mesmo após retries → alerta o suporte ────────
  // A voz continua ready (o aluno pode usar), mas alguém deve OUVIR a amostra
  // e, se preciso, trocar a referência (caso "me levantar" 2026-07-16).
  if (success && out.sample_qa === "failed") {
    try {
      const { data: profile } = await admin
        .from("profiles").select("email").eq("id", userId).maybeSingle();
      const email = (profile as { email?: string } | null)?.email ?? "(sem e-mail)";
      await sendEmail({
        to: SUPPORT_EMAIL,
        subject: `⚠️ QA da amostra reprovou — voz ${voiceId} — ${email}`,
        html:
          `<p>O treino terminou OK, mas a amostra automática saiu DIFERENTE do texto esperado ` +
          `mesmo após trocar a referência (similaridade: ${out.sample_qa_similarity ?? "?"}). ` +
          `Provável eco da referência na geração.</p>` +
          `<ul><li><strong>Usuário:</strong> ${escapeHtml(email)}</li>` +
          `<li><strong>Voz:</strong> ${voiceId}</li></ul>` +
          `<p>Ação: ouvir a amostra no /admin e, se confirmar eco, trocar a referência da voz.</p>`,
      });
    } catch {
      /* alerta é best-effort */
    }
  }

  // ── Amostra automática → linha ready em generations (player do histórico) ─
  if (success && out.sample_uploaded) {
    const sampleKey = `${userId}/${voiceId}/sample.wav`;
    // Re-treino sobrescreve o wav no R2; remove a linha antiga pra não duplicar.
    await admin
      .from("generations")
      .delete()
      .eq("voice_id", voiceId)
      .eq("name", "Amostra automática");
    await admin.from("generations").insert({
      user_id: userId,
      voice_id: voiceId,
      name: "Amostra automática",
      text_raw: out.sample_text || SAMPLE_TEXT,
      audio_path: sampleKey,
      duration_seconds: out.sample_seconds ?? null,
      status: "ready",
    } as never);
  }

  return { applied: true, status: nextStatus };
}
