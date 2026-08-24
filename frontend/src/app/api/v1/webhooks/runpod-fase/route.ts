/**
 * POST /api/v1/webhooks/runpod-fase
 *
 * Heartbeat de FASE do worker de voz (incidente d3d8d1b2, chamado #15).
 * A cada ~30s de job a thread de heartbeat do worker POSTa:
 *   { generation_id, token, fase, running_s, job_type }
 * e a fase corrente é gravada em generations.qa.fase_corrente (jsonb que já
 * existe — sem migration). Num estouro de executionTimeout, a row da geração
 * passa a dizer QUAL fase pendurou (download da ref? whisper do QA?
 * model.load? chunk N?) — o log do worker e o status do job na RunPod expiram
 * antes de qualquer investigação chegar.
 *
 * Auth: token = HMAC-SHA256(FASE_TELEMETRIA_SECRET, generation_id), validado
 * timing-safe. Sem a env configurada, todo POST é rejeitado (e o worker nem
 * recebe as chaves pra postar — ver lib/generations/fase-telemetria.ts).
 *
 * Best-effort de ponta a ponta: só toca rows pending/generating (job vivo);
 * geração já finalizada não é reescrita por heartbeat atrasado.
 */
import type { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  faseTokenValido,
  qaComFase,
  type FaseCorrente,
} from "@/lib/generations/fase-telemetria";
import { logger } from "@/lib/logger/server";

type FasePayload = {
  generation_id?: unknown;
  token?: unknown;
  fase?: unknown;
  running_s?: unknown;
  job_type?: unknown;
};

export async function POST(request: NextRequest) {
  let payload: FasePayload;
  try {
    payload = await request.json();
  } catch {
    return jsonError("bad_request", "Invalid JSON", 400);
  }

  const generationId = payload.generation_id;
  if (typeof generationId !== "string" || !generationId) {
    return jsonError("bad_request", "Missing 'generation_id'", 400);
  }
  if (!faseTokenValido(generationId, payload.token)) {
    return jsonError("unauthorized", "Invalid token", 401);
  }
  if (typeof payload.fase !== "string" || !payload.fase) {
    return jsonError("bad_request", "Missing 'fase'", 400);
  }

  const fase: FaseCorrente = {
    fase: payload.fase.slice(0, 120),
    running_s: typeof payload.running_s === "number" ? payload.running_s : null,
    job_type: typeof payload.job_type === "string" ? payload.job_type.slice(0, 40) : null,
    visto_em: new Date().toISOString(),
  };

  try {
    const admin = getAdmin();
    const { data: row } = await admin
      .from("generations")
      .select("id, status, qa")
      .eq("id", generationId as never)
      .maybeSingle();

    if (!row) return jsonOk({ handled: "ignored", reason: "generation not found" });

    const status = (row as { status?: string }).status;
    if (status !== "pending" && status !== "generating") {
      // Job já finalizou (webhook/poll chegou primeiro) — heartbeat atrasado
      // não reescreve nada.
      return jsonOk({ handled: "stale", status });
    }

    const qaAtual = (row as { qa?: Record<string, unknown> | null }).qa ?? null;
    await admin
      .from("generations")
      .update({ qa: qaComFase(qaAtual, fase) } as never)
      .eq("id", generationId as never)
      .in("status", ["pending", "generating"] as never[]);

    return jsonOk({ handled: "fase" });
  } catch (e) {
    // Telemetria: falha aqui não pode virar 500 barulhento pro worker (que já
    // ignora qualquer resposta) — registra e segue.
    logger.warn("api", "runpod_fase.write_failed", {
      generationId,
      error: e instanceof Error ? e.message : String(e),
    });
    return jsonOk({ handled: "error_logged" });
  }
}
