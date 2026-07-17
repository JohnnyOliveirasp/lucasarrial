/**
 * POST /api/v1/studio/machine — Máquina de Edição Automática (E5).
 * Entrada: { script, voice_id, name?, music_key? } → cria projeto em
 * piloto-automático e dispara a chamada ÚNICA de TTS. Daí em diante o
 * GET /studio/[id] (poll da página) avança sozinho até o vídeo pronto.
 * Cobra o preço da preparação de áudio na largada; cenas/montagem cobram
 * nos despachos (mesmos preços e estornos das fases manuais).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { startMachineTts, MACHINE_AUDIO_COST, type MachineProject } from "@/lib/studio/machine";
import { handleTechFailure } from "@/lib/support/failure-alert";

const SCRIPT_MAX = 2000; // mesmo teto do TTS (TEXT_MAX do generate)

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const admin = getAdmin();

  let body: { script?: unknown; voice_id?: unknown; name?: unknown; music_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const script = typeof body.script === "string" ? body.script.trim() : "";
  const voiceId = typeof body.voice_id === "string" ? body.voice_id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const musicKey =
    typeof body.music_key === "string" && body.music_key.startsWith("studio-music/")
      ? body.music_key
      : null;
  if (!script) return badRequest("'script' é obrigatório.");
  if (script.length > SCRIPT_MAX) return badRequest(`Roteiro máximo: ${SCRIPT_MAX} caracteres.`);
  if (!voiceId) return badRequest("'voice_id' é obrigatório.");

  // Voz: do próprio aluno OU do catálogo (is_stock) — mesma regra do Gerar Áudio.
  const { data: voice } = await admin
    .from("voices")
    .select("id, user_id, status, is_stock")
    .eq("id", voiceId)
    .or(`user_id.eq.${auth.user_id},is_stock.eq.true`)
    .maybeSingle();
  if (!voice || voice.status !== "ready") return badRequest("Voz inválida ou não está pronta.");

  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: MACHINE_AUDIO_COST,
    action: "gerar e preparar a narração",
  });
  if (!gate.ok) return gate.deny;

  const { data: created, error: insErr } = await admin
    .from("studio_projects")
    .insert({
      user_id: auth.user_id,
      name: name || "Máquina automática",
      raw_audio_path: "",
      auto_pilot: true,
      script_text: script,
      machine_voice_id: voiceId,
      machine_music_key: musicKey,
      machine_step: "tts",
    } as never)
    .select("id, user_id, auto_pilot, machine_step, machine_job_id, machine_voice_id, machine_music_key, script_text, status, scenes_status, montage_status, transcript_words, clean_audio_path")
    .single();
  if (insErr || !created) return serverError("Falha ao criar o projeto da máquina.");
  const project = created as unknown as MachineProject;

  try {
    await startMachineTts(project);
  } catch (e) {
    console.error("[machine] startMachineTts falhou:", e instanceof Error ? e.stack ?? e.message : e);
    await admin
      .from("studio_projects")
      .update({ status: "failed", machine_step: "failed", error_message: "Falha ao iniciar a narração." } as never)
      .eq("id", project.id);
    await handleTechFailure({
      feature: "Vídeo Estúdio (máquina — início do TTS)",
      userId: auth.user_id,
      refId: project.id,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Falha ao iniciar a narração da máquina.");
  }

  if (gate.billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: MACHINE_AUDIO_COST,
      kind: "video",
      refType: "studio_audio",
      refId: project.id,
      note: "Vídeo Estúdio — máquina automática (narração)",
    });
  }

  return jsonOk({ project: { id: project.id, machine_step: "tts", cost: gate.billed ? MACHINE_AUDIO_COST : 0 } }, 201);
}
