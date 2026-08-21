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
import { escalateStuckUser } from "@/lib/support/failure-alert";
import type { VoiceStatus, VoiceUpdate } from "@/lib/db/types";
import { mensagemFalaLimpaInsuficiente } from "@/lib/voices/regua-audio";

const SUPPORT_EMAIL = "suporte@fastcloner.com";

export type TrainOutput = {
  voice_id?: string;
  lora_uploaded?: boolean;
  reference_uploaded?: boolean;
  reference_transcript?: string | null;
  /**
   * Pausa natural medida no áudio de quem gravou (worker: voice_pipeline.pacing).
   * Vira o `tts_silence_ms` da voz. `null`/ausente = não deu pra medir com
   * confiança → não gravamos nada e a voz se comporta como antes.
   */
  reference_pause_ms?: number | null;
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

/** Arquivo enviado corrompido/incompleto (caso Carla 29/07: MP4 sem moov atom
 * = upload interrompido). Problema do ARQUIVO do usuário, não nosso: mensagem
 * acionável ("reenvie") em vez de "problema técnico" + sem pager pro suporte. */
function isCorruptFileError(error: string | null | undefined): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes("moov atom not found") ||
    e.includes("invalid data found when processing input") ||
    e.includes("could not find codec parameters") ||
    // Caso Erica 31/07 (inc. 57d360e4): arquivo SEM trilha de áudio nenhuma
    // (vídeo mudo ou upload quebrado) — ffmpeg não tem o que converter.
    e.includes("does not contain any stream")
  );
}

function friendlyTrainError(out: TrainOutput, rawError: string): string {
  if (isCorruptFileError(out.error) || isCorruptFileError(rawError)) {
    return (
      "Um dos arquivos enviados chegou corrompido ou incompleto — o envio pode ter sido " +
      "interrompido no meio. Seus créditos foram devolvidos. Envie o arquivo de novo " +
      "(ou grave novamente) e tente outra vez."
    );
  }
  if (isDatasetError(out.error) || isDatasetError(rawError)) {
    // ⚠️ 07745f61 + acf8acd6: esta mensagem citava SÓ o mínimo do TREINO (10min
    // de fala limpa) e mandava "tente de novo" — quem obedecia gravava 12–15min
    // e batia na PORTA do upload, que exige 20min BRUTOS. E arredondava com
    // `Math.round` nos dois lados, produzindo a frase impossível
    // "apenas ~10min serviram (mínimo: 10min)" pra quem parou a 1,5s do corte.
    // As duas regras (arredondar pra baixo, dizer o alvo da porta) moram na
    // régua, não aqui — era a duplicação que deixava os dois lados divergirem.
    return mensagemFalaLimpaInsuficiente(out.useful_seconds, out.min_required_seconds);
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
  // ── Ritmo: a voz nasce com a pausa de quem gravou ────────────────────────
  // O worker monta o áudio inserindo `tts_silence_ms` entre os pedaços; sem
  // valor ele cai no default 0 = nenhuma pausa, e a fala sai emendada. Era a
  // queixa "áudio muito corrido", e atingia 749 das 750 vozes prontas (todas
  // com o campo NULO). Gravar aqui faz a voz nova já sair no ritmo certo, em
  // vez de depender de alguém notar e ajustar na mão — como foi o caso Katia.
  // ⚠️ SÓ vozes novas, por decisão do dono (21/08): as antigas não são tocadas.
  if (success && typeof out.reference_pause_ms === "number" && out.reference_pause_ms > 0) {
    update.tts_silence_ms = out.reference_pause_ms;
    // O crossfade padrão do worker é 60ms e ele COME a pausa que acabamos de
    // inserir (funde o fim de um pedaço com o começo do outro). Zerar junto é
    // o que foi medido funcionando na Katia: 220/0, e depois 466/0.
    update.tts_crossfade_ms = 0;
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

    // Falha técnica → alerta imediato pro suporte (best-effort). Erro de
    // dataset/arquivo do usuário não é pager — o incidente da aba Falhas cobre.
    const userSideError =
      isDatasetError(out.error) ||
      isDatasetError(rawError) ||
      isCorruptFileError(out.error) ||
      isCorruptFileError(rawError);
    if (!userSideError) {
      await alertSupportTrainFailure({
        userId,
        userEmail,
        voiceId,
        runpodJobId,
        runpodStatus,
        rawError,
        refunded,
      });
    } else {
      // Erro "do usuário" NÃO é pager na 1ª vez — mas quem repete e continua
      // SEM VOZ está travado no funil, e aí vira problema nosso (foi o caso
      // do bug do chunking 08/08: 8 alunos, 20 tentativas, ninguém avisado).
      await escalateStuckUser({
        userId,
        userEmail,
        feature: "Treino de voz",
        refundRefType: "voice_train_refund",
        rawError: rawError || out.error || "erro de dataset",
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
