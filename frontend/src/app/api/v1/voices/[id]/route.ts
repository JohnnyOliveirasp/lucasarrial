/**
 * /api/v1/voices/[id]
 *   GET    → detalhes da voz (com presigned download URLs onde aplicável)
 *   DELETE → remove voice (cascade)
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
import { deleteByPrefix, deleteKeys } from "@/lib/r2/delete";
import { syncTrainingJob } from "@/lib/runpod/sync";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data, error } = await admin
    .from("voices")
    .select(
      "id, name, status, duration_seconds, raw_audio_paths, lora_path, runpod_job_id, error_message, trained_at, created_at, updated_at",
    )
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (error) return serverError("Failed to load voice");
  if (!data) return notFound("Voice");

  // Slice 3 fallback: enquanto não tem webhook (Slice 4), polling-pull do RunPod.
  // Se status="training" e tem runpod_job_id, consulta RunPod e atualiza local.
  if (data.status === "training" && data.runpod_job_id) {
    try {
      const synced = await syncTrainingJob(data.id, data.runpod_job_id);
      if (synced.changed) {
        const { data: refreshed } = await admin
          .from("voices")
          .select(
            "id, name, status, duration_seconds, raw_audio_paths, lora_path, runpod_job_id, error_message, trained_at, created_at, updated_at",
          )
          .eq("id", id)
          .maybeSingle();
        if (refreshed) return jsonOk({ voice: refreshed });
      }
    } catch {
      // ignora — devolve o estado antigo
    }
  }

  return jsonOk({ voice: data });
}

/**
 * DELETE — remove a LoRA OU a voz inteira. AÇÃO IRREVERSÍVEL.
 *
 * Body: { mode: "lora" | "voice", confirm: string }
 *   - confirm DEVE ser igual ao nome da voz (trava de segurança, defesa em
 *     profundidade além do digite-o-nome no frontend).
 *   - mode "lora":  apaga só o lora.safetensors do R2 e volta a voz pra
 *                   "awaiting_training" (mantém os áudios → pode retreinar).
 *   - mode "voice": apaga TUDO — R2 (raw + lora + ref no bucket voices, áudios
 *                   gerados no bucket generations) + linha voices (FK cascade
 *                   apaga training_jobs e generations no banco).
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { mode?: string; confirm?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body → confirm vazio → rejeitado abaixo */
  }
  const mode = body.mode === "lora" ? "lora" : "voice";
  const confirm = (body.confirm ?? "").trim();

  const admin = getAdmin();
  const { data: voice, error: vErr } = await admin
    .from("voices")
    .select("id, name, status, lora_path")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (vErr) return serverError("Failed to load voice");
  if (!voice) return notFound("Voice");

  // Trava de segurança: precisa digitar o nome EXATO da voz.
  if (!confirm || confirm !== voice.name) {
    return badRequest("Confirmação inválida — digite o nome exato da voz");
  }

  // ── Apagar só a LoRA ──────────────────────────────────────────────
  if (mode === "lora") {
    if (!voice.lora_path) return badRequest("Esta voz não tem LoRA pra apagar");
    try {
      await deleteKeys(R2_BUCKETS.voices, [voice.lora_path]);
    } catch (e) {
      return serverError(e instanceof Error ? `R2: ${e.message}` : "R2 delete failed");
    }
    const { error: uErr } = await admin
      .from("voices")
      .update({
        status: "awaiting_training",
        lora_path: null,
        trained_at: null,
        runpod_job_id: null,
      } as never)
      .eq("id", id)
      .eq("user_id", auth.user_id);
    if (uErr) return serverError("Failed to reset voice");
    return jsonOk({ deleted: "lora", voice_id: id });
  }

  // ── Apagar a voz inteira ──────────────────────────────────────────
  try {
    // 1. Áudios gerados (bucket generations) — chaves específicas
    const { data: gens } = await admin
      .from("generations")
      .select("audio_path")
      .eq("voice_id", id)
      .eq("user_id", auth.user_id);
    const genKeys = (gens ?? [])
      .map((g) => (g as { audio_path: string | null }).audio_path)
      .filter((k): k is string => !!k);
    if (genKeys.length) await deleteKeys(R2_BUCKETS.generations, genKeys);

    // 2. Tudo da voz no bucket voices (raw + lora + ref) por prefixo
    await deleteByPrefix(R2_BUCKETS.voices, `${auth.user_id}/${id}/`);
  } catch (e) {
    return serverError(e instanceof Error ? `R2: ${e.message}` : "R2 cleanup failed");
  }

  // 3. Linha do banco (FK cascade apaga training_jobs + generations)
  const { error: dErr } = await admin
    .from("voices")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user_id);
  if (dErr) return serverError("Failed to delete voice");

  return jsonOk({ deleted: "voice", voice_id: id });
}
