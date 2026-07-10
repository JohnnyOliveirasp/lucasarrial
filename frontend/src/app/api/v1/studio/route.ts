/**
 * /api/v1/studio — Vídeo Estúdio (F0: áudio impecável)
 *   GET  → lista os projetos do usuário (histórico)
 *   POST → cria projeto: { audio_key, name? } → gate de créditos → dispara
 *          job audio_edit no RunPod (worker de voz) → cobra STUDIO_CLEAN_COST.
 *          O worker remove tentativas repetidas + encolhe pausas e sobe o
 *          áudio limpo; o GET /studio/[id] (ou o webhook) finaliza.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { isAdmin } from "@/lib/admin/guard";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet, createPresignedPut } from "@/lib/r2/presigned";
import { runpodSubmitTrain, webhookUrlFor } from "@/lib/runpod/client";
import { handleTechFailure } from "@/lib/support/failure-alert";

const JOB_EXPIRES_SECONDS = 7200; // presigned válido por 2h (sobra pra fila)

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);

  const { data: rows, error } = await getAdmin()
    .from("studio_projects")
    .select(
      "id, name, status, duration_raw_seconds, duration_clean_seconds, removed_takes, error_message, created_at",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return serverError("Failed to list studio projects");
  return jsonOk({ projects: rows ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const admin = getAdmin();

  let body: { audio_key?: unknown; name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const audioKey = typeof body.audio_key === "string" ? body.audio_key.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!audioKey.startsWith(`${auth.user_id}/studio/uploads/`)) {
    return badRequest("Áudio inválido.");
  }

  // Gate: crédito é o ÚNICO gate (equipe/admin não paga).
  const billed = !bypassesBilling(auth.email);
  if (billed) {
    const bal = await getBalance(auth.user_id);
    if (bal.total < STUDIO_CLEAN_COST) {
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError(
        "insufficient_credits",
        `Créditos insuficientes: preparar o áudio custa ${STUDIO_CLEAN_COST} e você tem ${bal.total}.`,
        402,
        { subscribed, balance: bal.total, cost: STUDIO_CLEAN_COST },
      );
    }
  }

  // 1. Cria o projeto (status processing)
  const { data: created, error: insertErr } = await admin
    .from("studio_projects")
    .insert({
      user_id: auth.user_id,
      name: name || null,
      raw_audio_path: audioKey,
    } as never)
    .select("id")
    .single();
  if (insertErr || !created) return serverError("Failed to create studio project");
  const projectId = (created as { id: string }).id;

  // 2. Presigned GET (áudio bruto) + PUT (áudio limpo, saída determinística)
  const cleanKey = `${auth.user_id}/studio/${projectId}/clean.wav`;
  let audioUrl: string;
  let cleanUploadUrl: string;
  try {
    audioUrl = await createPresignedGet(R2_BUCKETS.generations, audioKey, JOB_EXPIRES_SECONDS);
    cleanUploadUrl = await createPresignedPut(
      R2_BUCKETS.generations,
      cleanKey,
      "audio/wav",
      JOB_EXPIRES_SECONDS,
    );
  } catch {
    await admin.from("studio_projects").delete().eq("id", projectId);
    return serverError("Não consegui ler o áudio enviado.");
  }

  // 3. Dispara no RunPod (endpoint de voz — é o que a CI mantém atualizado)
  let jobId: string;
  try {
    const job = await runpodSubmitTrain(
      {
        type: "audio_edit",
        audio_url: audioUrl,
        output_upload_url: cleanUploadUrl,
        language: "pt",
      },
      { webhook: webhookUrlFor("generation") },
    );
    jobId = job.id;
  } catch (e) {
    await admin
      .from("studio_projects")
      .update({ status: "failed", error_message: "Falha ao iniciar o processamento. Tente novamente." } as never)
      .eq("id", projectId);
    // Falha ANTES do débito (nada a estornar) — mas o suporte precisa saber.
    await handleTechFailure({
      feature: "Vídeo Estúdio (início do job)",
      userId: auth.user_id,
      refId: projectId,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Falha ao iniciar o processamento do áudio.");
  }

  await admin
    .from("studio_projects")
    .update({ runpod_job_id: jobId, clean_audio_path: cleanKey } as never)
    .eq("id", projectId);

  // 4. Debita depois do job disparado (padrão da casa; estorno automático em falha)
  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: STUDIO_CLEAN_COST,
      kind: "video",
      refType: "studio_audio",
      refId: projectId,
      note: "Vídeo Estúdio — preparação do áudio",
    });
  }

  return jsonOk(
    { project: { id: projectId, status: "processing", cost: billed ? STUDIO_CLEAN_COST : 0 } },
    201,
  );
}
