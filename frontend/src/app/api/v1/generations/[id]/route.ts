/**
 * GET /api/v1/generations/[id]
 *
 * Retorna a row de generation. Se status="pending"|"generating" e tem
 * runpod_job_id, sincroniza com RunPod (fallback até webhook chegar).
 * Quando status="ready", inclui `audio_url` (presigned GET).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { runpodGetStatus, inferenceEndpoint } from "@/lib/runpod/client";
import { finalizeGenerationSuccess } from "@/lib/generations/finalize";
import { errorMessageComFase } from "@/lib/generations/fase-telemetria";
import { recordRunpodTiming } from "@/lib/generations/runpod-timing";
import { handleTechFailure } from "@/lib/support/failure-alert";
import type { GenerationStatus } from "@/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

const POLLING_STATUSES: GenerationStatus[] = ["pending", "generating"];

/**
 * Marca a geração como failed com gate idempotente (corrida poll×webhook) e,
 * só pra quem venceu a transição, dispara a contingência: estorno automático
 * do débito + e-mail pro suporte.
 */
async function failGeneration(
  generationId: string,
  userId: string,
  jobId: string | null,
  rawError: string,
  executionTimeMs?: number,
  delayTimeMs?: number,
): Promise<void> {
  // Grava o tempo de execução do RunPod também no caminho do POLL (incidente
  // d3d8d1b2, 18/08): poll e webhook correm pelo mesmo gate idempotente, e quem
  // vencer a transição pra failed é quem grava o tempo. O log do worker expira
  // ~30min depois do job (investigação sempre batia em 404), então o
  // elapsed_seconds na falha é o que permite diferenciar HANG do worker (tempo
  // alto) de COLD START (tempo baixo) sem depender de log que expira. Nunca
  // concatenar isso no error_message: a assinatura do incidente vem do texto do
  // erro (src/lib/incidents/classify.ts) e já estilhaçou agregação no passado.
  // ÚNICA exceção sancionada: o sufixo "[fase: ...]" (errorMessageComFase), de
  // formato FIXO, removido pela assinatura (stripFaseSuffix) — num timeout, a
  // row nomeia a fase que o heartbeat gravou em qa.fase_corrente (d3d8d1b2).
  // Busca do qa é best-effort e SÓ no caminho de falha: se falhar, a geração
  // ainda é marcada failed com o texto de hoje — telemetria nunca trava estorno.
  let qaAtual: unknown = null;
  try {
    const { data: qaRow } = await getAdmin()
      .from("generations")
      .select("qa")
      .eq("id", generationId)
      .maybeSingle();
    qaAtual = (qaRow as { qa?: unknown } | null)?.qa ?? null;
  } catch {
    // segue sem fase
  }
  const failUpdate: {
    status: "failed";
    error_message: string;
    elapsed_seconds?: number;
  } = { status: "failed", error_message: errorMessageComFase(rawError, qaAtual) };
  if (typeof executionTimeMs === "number") {
    failUpdate.elapsed_seconds = executionTimeMs / 1000; // RunPod manda em ms
  }
  const { data: claimed } = await getAdmin()
    .from("generations")
    .update(failUpdate)
    .eq("id", generationId)
    .in("status", POLLING_STATUSES)
    .select("id");
  if (claimed && claimed.length > 0) {
    // Telemetria fila×execução (migration 82) em UPDATE separado: se a coluna
    // ainda não existir no banco, só a instrumentação falha — o estorno segue.
    await recordRunpodTiming(generationId, { delayTimeMs, executionTimeMs });
    await handleTechFailure({
      feature: "Geração de áudio (TTS)",
      userId,
      refId: generationId,
      jobId,
      rawError,
      debitRefType: "generation",
      refundRefType: "generation_refund",
    });
  }
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: gen, error } = await admin
    .from("generations")
    .select(
      "id, voice_id, text_raw, text_normalized, reference_audio_path, reference_transcript, audio_path, sample_rate, duration_seconds, elapsed_seconds, status, error_message, runpod_job_id, created_at",
    )
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (error) return serverError("Failed to load generation");
  if (!gen) return notFound("Generation");

  let current = gen;

  if (POLLING_STATUSES.includes(gen.status) && gen.runpod_job_id) {
    try {
      // Geração roda no endpoint de INFERÊNCIA (pode diferir do de treino).
      // Sem isso, o polling consultaria o endpoint errado e nunca acharia o job.
      const resp = await runpodGetStatus(gen.runpod_job_id, inferenceEndpoint());
      if (resp.status === "COMPLETED") {
        const out = (resp.output ?? {}) as { uploaded?: boolean; error?: string; sample_rate?: number; duration_s?: number; elapsed_s?: number };
        const ok = out.uploaded && !out.error;
        // `finalizeGenerationSuccess` devolve null quando o áudio saiu CURTO
        // DEMAIS pro texto (modelo parou cedo). O job "deu certo" pro RunPod,
        // mas não pra pessoa — cai no mesmo caminho de falha, que estorna.
        const truncado =
          ok && (await finalizeGenerationSuccess(id, gen.audio_path, out)) === null;
        if (ok && !truncado) {
          // marcado ready dentro do finalize (audio_path aponta pro .mp3)
        } else {
          await failGeneration(
            id,
            auth.user_id,
            gen.runpod_job_id,
            truncado
              ? "O áudio saiu incompleto (mais curto que o texto). Refaça — os créditos foram devolvidos."
              : out.error ?? "unknown",
            resp.executionTime,
            resp.delayTime,
          );
        }

        const { data: refreshed } = await admin
          .from("generations")
          .select(
            "id, voice_id, text_raw, text_normalized, reference_audio_path, reference_transcript, audio_path, sample_rate, duration_seconds, elapsed_seconds, status, error_message, runpod_job_id, created_at",
          )
          .eq("id", id)
          .maybeSingle();
        if (refreshed) current = refreshed;
      } else if (resp.status === "FAILED" || resp.status === "CANCELLED" || resp.status === "TIMED_OUT") {
        await failGeneration(id, auth.user_id, gen.runpod_job_id, `RunPod ${resp.status}: ${resp.error ?? ""}`, resp.executionTime, resp.delayTime);
      }
    } catch {
      // ignora — devolve estado atual
    }
  }

  // Anexa presigned GET URL do áudio quando disponível
  let audio_url: string | null = null;
  if (current.status === "ready" && current.audio_path) {
    try {
      audio_url = await createPresignedGet(
        R2_BUCKETS.generations,
        current.audio_path,
        60 * 60, // 1h
      );
    } catch {
      audio_url = null;
    }
  }

  return jsonOk({ generation: { ...current, audio_url } });
}

/**
 * PATCH /api/v1/generations/[id]
 *
 * Renomeia o áudio gerado. Body: { name: string }. String vazia → volta pro
 * fallback (name = null). Usuário comum só renomeia o próprio; admin
 * (ADMIN_EMAILS) renomeia qualquer um — espelha o bypass do GET do histórico.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (typeof body.name !== "string") return badRequest("Nome inválido");
  const trimmed = body.name.trim().slice(0, 120);

  const admin = getAdmin();
  let q = admin
    .from("generations")
    .update({ name: trimmed === "" ? null : trimmed })
    .eq("id", id);
  if (!auth.is_admin) {
    q = q.eq("user_id", auth.user_id);
  }
  const { data, error } = await q.select("id, name").maybeSingle();

  if (error) return serverError("Failed to rename generation");
  if (!data) return notFound("Generation");

  return jsonOk({ generation: data });
}
