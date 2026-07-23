/**
 * Máquina de Edição Automática — E5 (piloto automático do Vídeo Estúdio).
 *
 * Entrada = roteiro pronto + voz clonada. A máquina roda sozinha:
 *   tts (1 chamada TTS — regra 1 da MAQUINA_EDICAO_AUTOMATICA.md §2.2)
 *   → tts_prepare (encolher pausas + words + QA fidelidade ≥0.75, worker)
 *   → scenes (planejador + banco de b-roll, reuso grátis)
 *   → montage (Editor determinístico com as 8 regras de sync)
 *   → done
 *
 * O avanço acontece no POLL do GET /studio/[id] (mesmo padrão das fases F0-F5;
 * pré-produção: a página do admin fica aberta acompanhando). Os despachos de
 * cenas/montagem espelham deliberadamente as rotas F3/F1 — mesma cobrança,
 * mesmo estorno; a diferença é só QUEM aperta o botão (a máquina, não o aluno).
 */
import { getAdmin } from "@/lib/db/admin";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { STUDIO_SCENE_COST, STUDIO_MONTAGE_COST } from "@/lib/studio/pricing";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { planScenes, sentencesFromWords, type BankScene } from "@/lib/studio/scene-planner";
import { startSceneStill } from "@/lib/studio/scenes";
import { R2_BUCKETS, imagesBucket } from "@/lib/r2/client";
import { createPresignedGet, createPresignedPut } from "@/lib/r2/presigned";
import {
  runpodSubmitInference,
  runpodSubmitTrain,
  runpodGetStatus,
  inferenceEndpoint,
} from "@/lib/runpod/client";
import { handleTechFailure } from "@/lib/support/failure-alert";
import type { StudioScenePlanItem, StudioSceneRow, StudioTranscriptWord } from "@/lib/db/types";

const JOB_EXPIRES_SECONDS = 7200;

export type MachineProject = {
  id: string;
  user_id: string;
  auto_pilot: boolean;
  machine_step: string | null;
  machine_job_id: string | null;
  machine_voice_id: string | null;
  machine_music_key: string | null;
  script_text: string | null;
  status: string;
  scenes_status: string | null;
  montage_status: string | null;
  transcript_words: unknown;
  clean_audio_path: string | null;
};

const ttsKey = (p: MachineProject) => `${p.user_id}/studio/${p.id}/tts.wav`;
const cleanKey = (p: MachineProject) => `${p.user_id}/studio/${p.id}/clean.wav`;

async function machineFail(p: MachineProject, msg: string, raw?: string): Promise<void> {
  await getAdmin()
    .from("studio_projects")
    .update({ machine_step: "failed", status: "failed", error_message: msg } as never)
    .eq("id", p.id);
  await handleTechFailure({
    feature: "Vídeo Estúdio (máquina automática)",
    userId: p.user_id,
    refId: p.id,
    rawError: raw ?? msg,
  });
}

/** Passo 1: dispara a chamada ÚNICA de TTS do roteiro inteiro (voz do aluno). */
export async function startMachineTts(p: MachineProject): Promise<string> {
  const admin = getAdmin();
  const { data: voice } = await admin
    .from("voices")
    .select("id, status, lora_path, reference_audio_path, reference_transcript, lora_alpha, tts_silence_ms, tts_crossfade_ms, language")
    .eq("id", p.machine_voice_id ?? "")
    .maybeSingle();
  if (!voice || voice.status !== "ready" || !voice.lora_path) {
    throw new Error("Voz da máquina não está pronta.");
  }
  const [loraUrl, outPut] = await Promise.all([
    createPresignedGet(R2_BUCKETS.voices, voice.lora_path, JOB_EXPIRES_SECONDS),
    createPresignedPut(R2_BUCKETS.generations, ttsKey(p), "audio/wav", JOB_EXPIRES_SECONDS),
  ]);
  const input: Record<string, unknown> = {
    type: "inference",
    text: p.script_text,
    lora_url: loraUrl,
    output_upload_url: outPut,
    lora_alpha: typeof voice.lora_alpha === "number" ? voice.lora_alpha : 16,
    cfg_value: 1.6,
    inference_timesteps: 15,
    language: voice.language || "pt",
  };
  if (voice.reference_audio_path) {
    input.prompt_wav_url = await createPresignedGet(
      R2_BUCKETS.voices, voice.reference_audio_path, JOB_EXPIRES_SECONDS,
    );
    if (voice.reference_transcript) input.prompt_text = voice.reference_transcript;
  }
  if (typeof voice.tts_silence_ms === "number") input.chunk_silence_ms = voice.tts_silence_ms;
  if (typeof voice.tts_crossfade_ms === "number") input.chunk_crossfade_ms = voice.tts_crossfade_ms;
  const job = await runpodSubmitInference(input);
  await admin
    .from("studio_projects")
    .update({ machine_step: "tts", machine_job_id: job.id } as never)
    .eq("id", p.id);
  return job.id;
}

/** Passo 2: TTS pronto → lapida no worker (pausas + words + QA ≥0.75). */
async function submitTtsPrepare(p: MachineProject): Promise<void> {
  const [audioUrl, cleanPut] = await Promise.all([
    createPresignedGet(R2_BUCKETS.generations, ttsKey(p), JOB_EXPIRES_SECONDS),
    createPresignedPut(R2_BUCKETS.generations, cleanKey(p), "audio/wav", JOB_EXPIRES_SECONDS),
  ]);
  const job = await runpodSubmitTrain({
    type: "tts_prepare",
    audio_url: audioUrl,
    script: p.script_text,
    language: "pt",
    output_upload_url: cleanPut,
  });
  await getAdmin()
    .from("studio_projects")
    .update({ machine_step: "tts_prepare", machine_job_id: job.id } as never)
    .eq("id", p.id);
}

/** Passo 3: espelho do POST /studio/[id]/scenes (plano + banco + cobrança). */
async function dispatchScenes(p: MachineProject, email: string): Promise<void> {
  const admin = getAdmin();
  const words = (p.transcript_words ?? []) as StudioTranscriptWord[];
  const sentences = sentencesFromWords(words);
  if (sentences.length === 0) throw new Error("Máquina sem transcrição pra planejar cenas.");

  // Banco: só b-roll entra no reuso (cena de produto é específica — §2.7).
  // F3 (mig 49): inclui o acervo COMPARTILHADO curado — reuso a custo zero.
  const { data: bankRows } = await admin
    .from("studio_scenes")
    .select("id, concept")
    .or(`user_id.eq.${p.user_id},shared.eq.true`)
    .eq("status", "ready")
    .eq("kind", "broll")
    .order("created_at", { ascending: false })
    .limit(80);
  const bank = (bankRows ?? []) as BankScene[];
  const plan = await planScenes(sentences, bank);

  const plannedNew = plan.filter((x) => !x.reuse_id).length;
  const gate = await gateStudioCredits({
    userId: p.user_id,
    email,
    cost: plannedNew * STUDIO_SCENE_COST,
    action: `gerar ${plannedNew} cena(s) nova(s)`,
  });
  if (!gate.ok) throw new Error("Créditos insuficientes pras cenas da máquina.");

  const scenePlan: StudioScenePlanItem[] = [];
  let newScenes = 0;
  for (const item of plan) {
    if (item.reuse_id) {
      scenePlan.push({ sentence: item.sentence, text: sentences[item.sentence] ?? "", scene_id: item.reuse_id, reused: true });
      continue;
    }
    const { data: created } = await admin
      .from("studio_scenes")
      .insert({
        user_id: p.user_id,
        concept: item.concept,
        prompt_en: item.prompt_en,
        dialect: item.dialect,
        kind: "broll",
      } as never)
      .select("id, prompt_en, dialect")
      .single();
    if (!created) throw new Error("Falha ao criar cena da máquina.");
    const row = created as Pick<StudioSceneRow, "id" | "prompt_en" | "dialect">;
    const taskId = await startSceneStill(row);
    if (taskId) {
      await admin.from("studio_scenes").update({ debit_ref: taskId } as never).eq("id", row.id);
      if (gate.billed) {
        await debitCredits({
          userId: p.user_id, amount: STUDIO_SCENE_COST, kind: "video",
          refType: "studio_scene", refId: taskId,
          note: `Vídeo Estúdio — cena de b-roll (máquina, projeto ${p.id})`,
        });
      }
    }
    newScenes += 1;
    scenePlan.push({ sentence: item.sentence, text: sentences[item.sentence] ?? "", scene_id: row.id, reused: false });
  }
  await admin
    .from("studio_projects")
    .update({
      scenes_status: newScenes === 0 ? "ready" : "generating",
      scene_plan: scenePlan,
      machine_step: "scenes",
      machine_job_id: null,
    } as never)
    .eq("id", p.id);
}

/** Passo 4: espelho do POST /studio/[id]/montage (Editor determinístico). */
async function dispatchMontage(p: MachineProject, email: string): Promise<void> {
  const admin = getAdmin();
  const { data: project } = await admin
    .from("studio_projects")
    .select("clean_audio_path, transcript_words, scene_plan, machine_music_key")
    .eq("id", p.id)
    .maybeSingle();
  const words = (project?.transcript_words ?? []) as StudioTranscriptWord[];
  const scenePlan = (project?.scene_plan ?? []) as StudioScenePlanItem[];
  if (!project?.clean_audio_path || words.length === 0 || scenePlan.length === 0) {
    throw new Error("Máquina chegou na montagem sem áudio/plano.");
  }
  const gate = await gateStudioCredits({
    userId: p.user_id, email, cost: STUDIO_MONTAGE_COST, action: "montar o vídeo",
  });
  if (!gate.ok) throw new Error("Créditos insuficientes pra montagem da máquina.");

  const ids = [...new Set(scenePlan.map((x) => x.scene_id))];
  const { data: rows } = await admin
    .from("studio_scenes")
    .select("id, status, video_path")
    .in("id", ids);
  const byId = new Map(
    ((rows ?? []) as Pick<StudioSceneRow, "id" | "status" | "video_path">[])
      .filter((s) => s.status === "ready" && s.video_path)
      .map((s) => [s.id, s.video_path as string]),
  );
  if (!ids.every((sid) => byId.has(sid))) throw new Error("Cenas incompletas na montagem da máquina.");
  const ordered = ids.filter((sid) => byId.has(sid));
  const indexOf = new Map(ordered.map((sid, i) => [sid, i]));
  const sentenceScene = scenePlan
    .slice()
    .sort((a, b) => a.sentence - b.sentence)
    .map((x) => indexOf.get(x.scene_id) ?? 0);

  const videoKey = `${p.user_id}/studio/${p.id}/video.mp4`;
  const [audioUrl, videoPutUrl] = await Promise.all([
    createPresignedGet(R2_BUCKETS.generations, project.clean_audio_path, JOB_EXPIRES_SECONDS),
    createPresignedPut(imagesBucket(), videoKey, "video/mp4", JOB_EXPIRES_SECONDS),
  ]);
  const sceneUrls = await Promise.all(
    ordered.map((sid) => createPresignedGet(imagesBucket(), byId.get(sid)!, JOB_EXPIRES_SECONDS)),
  );
  const musicKey = project.machine_music_key;
  const musicUrl = musicKey
    ? await createPresignedGet(R2_BUCKETS.voices, musicKey, JOB_EXPIRES_SECONDS)
    : null;

  const job = await runpodSubmitTrain({
    type: "montage",
    audio_url: audioUrl,
    words,
    scene_urls: sceneUrls,
    sentence_scene: sentenceScene,
    face_sentences: null,
    output_upload_url: videoPutUrl,
    captions: true,
    music_url: musicUrl,
  });
  await admin
    .from("studio_projects")
    .update({
      montage_status: "processing",
      montage_job_id: job.id,
      video_path: videoKey,
      montage_error: null,
      machine_step: "montage",
    } as never)
    .eq("id", p.id);
  if (gate.billed) {
    await debitCredits({
      userId: p.user_id, amount: STUDIO_MONTAGE_COST, kind: "video",
      refType: "studio_montage", refId: job.id,
      note: "Vídeo Estúdio — montagem (máquina)",
    });
  }
}

/**
 * Avança a máquina 1 passo (chamado a cada poll do GET /studio/[id]).
 * Idempotente e best-effort: erro num poll = tenta no próximo.
 */
export async function advanceMachine(p: MachineProject, email: string): Promise<void> {
  if (!p.auto_pilot || !p.machine_step) return;
  const admin = getAdmin();
  try {
    if (p.machine_step === "tts" && p.machine_job_id) {
      const resp = await runpodGetStatus(p.machine_job_id, inferenceEndpoint());
      if (resp.status === "COMPLETED") {
        await submitTtsPrepare(p);
      } else if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(resp.status)) {
        await machineFail(p, "A geração da narração falhou.", JSON.stringify(resp.error ?? resp.output ?? {}).slice(0, 400));
      }
      return;
    }
    if (p.machine_step === "tts_prepare" && p.machine_job_id) {
      const resp = await runpodGetStatus(p.machine_job_id);
      if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(resp.status)) {
        await machineFail(p, "A preparação da narração falhou.", JSON.stringify(resp.error ?? {}).slice(0, 400));
        return;
      }
      if (resp.status !== "COMPLETED") return;
      const out = (resp.output ?? {}) as {
        tts_prepare?: boolean; words?: StudioTranscriptWord[]; error?: string;
        qa_failed?: boolean; similarity?: number; duration_raw?: number;
        duration_clean?: number; transcript?: string;
      };
      if (out.qa_failed) {
        // §3.3: fala gerada infiel ao roteiro → regenera o TTS UMA vez.
        const already = await admin
          .from("studio_projects").select("error_message").eq("id", p.id).maybeSingle();
        if ((already.data?.error_message ?? "").includes("tts_retry")) {
          await machineFail(p, `Narração reprovou na QA de fidelidade 2x (similaridade ${out.similarity ?? "?"}).`);
        } else {
          await admin.from("studio_projects")
            .update({ error_message: "tts_retry" } as never).eq("id", p.id);
          await startMachineTts(p);
        }
        return;
      }
      if (!out.tts_prepare || !Array.isArray(out.words) || out.words.length === 0) {
        await machineFail(p, "A preparação da narração voltou vazia.", JSON.stringify(out).slice(0, 400));
        return;
      }
      await admin
        .from("studio_projects")
        .update({
          status: "audio_ready",
          clean_audio_path: cleanKey(p),
          transcript_words: out.words,
          duration_raw_seconds: Math.round(out.duration_raw ?? 0),
          duration_clean_seconds: Math.round(out.duration_clean ?? 0),
          error_message: null,
          machine_job_id: null,
        } as never)
        .eq("id", p.id);
      await dispatchScenes(
        { ...p, transcript_words: out.words, status: "audio_ready" },
        email,
      );
      return;
    }
    if (p.machine_step === "scenes") {
      if (p.scenes_status === "ready") await dispatchMontage(p, email);
      else if (p.scenes_status === "failed") await machineFail(p, "Uma ou mais cenas falharam na geração.");
      return;
    }
    if (p.machine_step === "montage") {
      if (p.montage_status === "ready") {
        await admin.from("studio_projects")
          .update({ machine_step: "done" } as never).eq("id", p.id);
      } else if (p.montage_status === "failed") {
        await machineFail(p, "A montagem falhou (créditos da montagem já estornados).");
      }
      return;
    }
  } catch (e) {
    // best-effort: um poll com erro não derruba a máquina; o próximo re-tenta.
    console.error("[machine] advance error", p.id, e instanceof Error ? e.message : e);
  }
}

/** Cobrança de entrada da máquina (TTS + preparação = preço da limpeza F0). */
export const MACHINE_AUDIO_COST = STUDIO_CLEAN_COST;
