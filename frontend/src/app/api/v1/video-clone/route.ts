/**
 * /api/v1/video-clone
 *   GET    → lista os Vídeo Clones do usuário (histórico, com URLs presignadas)
 *   POST   → cria um job: { image_key, audio_key, tier } → valida duração REAL
 *            (Whisper), cobra créditos por segundo (gate 402) e dispara o
 *            endpoint InfiniteTalk no RunPod (workflow preenchido por job)
 *   DELETE → apaga em lote { ids: string[] } (R2 + banco)
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { R2_BUCKETS, imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { deleteKeys } from "@/lib/r2/delete";
import { transcribeUploadedAudio } from "@/lib/video/transcribe";
import {
  CLONE_MAX_AUDIO_SECONDS,
  cloneCreditsCost,
  cloneExecutionTimeoutMs,
  getCloneTier,
} from "@/lib/video-clone/config";
import { buildInfiniteTalkWorkflow } from "@/lib/video-clone/workflow";
import { runInfiniteTalk } from "@/lib/video-clone/runpod";
import { webhookUrlFor } from "@/lib/runpod/client";
import { handleTechFailure } from "@/lib/support/failure-alert";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("video_clones")
    .select(
      "id, name, duration_seconds, tier, credits_cost, status, error_message, video_path, image_path, created_at",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });
  if (error) return serverError("Failed to list video clones");

  const items = await Promise.all(
    (rows ?? []).map(async (r) => {
      const [video_url, image_url] = await Promise.all([
        // MP4 final mora no bucket PERMANENTE (mesmo dos vídeos do wizard);
        // entradas ficam no generations (TTL 30d).
        r.status === "ready" && r.video_path
          ? createPresignedGet(imagesBucket(), r.video_path, 60 * 60).catch(() => null)
          : Promise.resolve(null),
        // Foto enviada mora no generations; foto do histórico mora no bucket de imagens.
        r.image_path
          ? createPresignedGet(
              r.image_path.includes("/video-clone/uploads/") ? R2_BUCKETS.generations : imagesBucket(),
              r.image_path,
              60 * 60,
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      return {
        id: r.id,
        name: r.name,
        duration_seconds: r.duration_seconds,
        tier: r.tier,
        credits_cost: r.credits_cost,
        status: r.status,
        error_message: r.error_message,
        created_at: r.created_at,
        video_url,
        image_url,
      };
    }),
  );

  return jsonOk({ clones: items });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: {
    image_key?: unknown;
    image_generation_id?: unknown;
    audio_key?: unknown;
    generation_id?: unknown;
    tier?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }

  const imageKey = typeof body.image_key === "string" ? body.image_key.trim() : "";
  const imageGenId = typeof body.image_generation_id === "string" ? body.image_generation_id.trim() : "";
  const audioKey = typeof body.audio_key === "string" ? body.audio_key.trim() : "";
  const generationId = typeof body.generation_id === "string" ? body.generation_id.trim() : "";
  const tier = getCloneTier(typeof body.tier === "string" ? body.tier : null);
  if (!tier) return badRequest("Escolha a qualidade (Padrão 2.0 ou Turbo).");
  // Tier de pré-produção: some da UI pra não-admin; aqui é a trava de verdade.
  if (tier.adminOnly && !(await isAdmin(auth.email))) {
    return badRequest("Escolha a qualidade (Padrão 2.0 ou Turbo).");
  }

  const admin0 = getAdmin();
  const prefix = `${auth.user_id}/video-clone/uploads/`;

  // Trava anti clique-repetido (mesmo padrão do guard de treino 4848826):
  // 1 clone em andamento por vez. Sem isso, fila lenta + botão apertado de
  // novo = vários jobs caros duplicados (caso samuel 23/07: 4 em 4h).
  const { count: inFlight } = await admin0
    .from("video_clones")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user_id)
    .in("status", ["pending", "generating"]);
  if ((inFlight ?? 0) > 0) {
    return jsonError(
      "clone_in_progress",
      "Você já tem um vídeo sendo gerado. Aguarde ele terminar antes de iniciar outro — se falhar, os créditos voltam automaticamente.",
      409,
    );
  }

  // ── Foto: do histórico do Gerador de Imagem OU upload próprio ──
  let imagePath = "";
  let imageBucket = R2_BUCKETS.generations;
  if (imageGenId) {
    const { data: img } = await admin0
      .from("image_generations")
      .select("id, status, image_path")
      .eq("id", imageGenId)
      .eq("user_id", auth.user_id)
      .maybeSingle();
    if (!img || img.status !== "ready" || !img.image_path) {
      return badRequest("Essa imagem do histórico não está pronta.");
    }
    imagePath = img.image_path;
    imageBucket = imagesBucket();
  } else if (imageKey.startsWith(prefix)) {
    imagePath = imageKey;
  } else {
    return badRequest("Selecione uma foto do histórico ou envie uma nova.");
  }

  // ── Áudio: gerado (TTS, duração já persistida) OU upload (Whisper mede) ──
  let audioPath = "";
  let duration = 0;
  if (generationId) {
    const { data: gen } = await admin0
      .from("generations")
      .select("id, status, audio_path, duration_seconds")
      .eq("id", generationId)
      .eq("user_id", auth.user_id)
      .maybeSingle();
    if (!gen || gen.status !== "ready" || !gen.audio_path) {
      return badRequest("Esse áudio não está pronto.");
    }
    // Amostra automática do treino: serve pra OUVIR a voz, não pra vídeo
    // (frase fixa "Oi! Esta é a minha voz clonada..."). O seletor já não a
    // oferece mais; esta trava pega aba antiga / chamada direta na API.
    // 85 clones de 65 alunos saíram "ruins" por isso antes do filtro.
    if (gen.audio_path.endsWith("/sample.wav")) {
      return badRequest(
        "Esse áudio é a amostra automática do treino da voz — ele serve só pra você ouvir como a voz ficou. " +
          "Pro Vídeo Clone, gere um áudio com o SEU texto em Gerar Voz e selecione ele aqui.",
      );
    }
    audioPath = gen.audio_path;
    duration = gen.duration_seconds ?? 0;
  } else if (audioKey.startsWith(prefix)) {
    audioPath = audioKey;
    // Duração REAL (Whisper) — à prova de burla do browser.
    try {
      const t = await transcribeUploadedAudio(audioKey);
      duration = t.durationSeconds;
      // ÁUDIO MUDO NÃO VAI PRA GPU (caso Fernanda, 18/08). Um mp3 de 44s com
      // volume -91 dB (silêncio digital) foi cobrado e enviado TRÊS vezes; o
      // WanVideoSampler divide por energia zero e estoura
      // "Array must not contain infs or NaNs". Ninguém percebia porque a
      // cobrança e o estorno se anulavam e só ficava o erro genérico na tela.
      // O Whisper já roda aqui pra medir a duração e devolve o texto de graça:
      // sem fala transcrita, não há o que sincronizar com o rosto.
      if (!t.text) {
        return badRequest(
          "Esse áudio está sem som — não conseguimos ouvir nenhuma fala nele. " +
            "Confira o arquivo (dê play antes de enviar) e tente de novo. Você não foi cobrada.",
        );
      }
    } catch {
      return serverError("Não conseguimos processar esse áudio. Tente novamente.");
    }
  } else {
    return badRequest("Selecione um áudio gerado ou envie um novo.");
  }
  if (duration <= 0) return badRequest("Não conseguimos ler a duração desse áudio.");
  if (duration > CLONE_MAX_AUDIO_SECONDS + 0.5) {
    return badRequest(
      `O áudio tem ${Math.round(duration)}s — o máximo é ${CLONE_MAX_AUDIO_SECONDS}s (1min30s).`,
    );
  }

  const cost = cloneCreditsCost(tier, duration);
  const billed = !bypassesBilling(auth.email);
  if (billed) {
    const { total } = await getBalance(auth.user_id);
    if (total < cost) {
      const admin = getAdmin();
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError(
        "insufficient_credits",
        `Gerar este Vídeo Clone (${tier.label}, ${Math.ceil(duration)}s) custa ${cost} créditos.`,
        402,
        { subscribed, balance: total, cost },
      );
    }
  }

  const admin = getAdmin();
  const { data: created, error: insErr } = await admin
    .from("video_clones")
    .insert({
      user_id: auth.user_id,
      image_path: imagePath,
      audio_path: audioPath,
      duration_seconds: Math.round(duration * 100) / 100,
      num_frames: 0, // preenchido abaixo (workflow calcula)
      tier: tier.id,
      credits_cost: billed ? cost : 0,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !created) return serverError("Failed to create video clone");

  // Insumos via URL presignada (2h — sobra pro job na fila) + saída determinística.
  const [imageUrl, audioUrl] = await Promise.all([
    createPresignedGet(imageBucket, imagePath, 7200).catch(() => null),
    createPresignedGet(R2_BUCKETS.generations, audioPath, 7200).catch(() => null),
  ]);
  if (!imageUrl || !audioUrl) {
    await admin.from("video_clones").delete().eq("id", created.id);
    return serverError("Não consegui ler os arquivos enviados.");
  }

  const s3Key = `${auth.user_id}/video-clone/${created.id}/result.mp4`;
  const { workflow, numFrames } = buildInfiniteTalkWorkflow({
    imageUrl,
    audioUrl,
    s3Key,
    tier,
    durationSeconds: duration,
  });

  try {
    // Timeout dimensionado por tier+duração (o default do endpoint, 15min,
    // matava V1 >20s) + webhook: falha/sucesso finaliza e estorna mesmo com
    // a página fechada.
    const { jobId } = await runInfiniteTalk(workflow, {
      executionTimeoutMs: cloneExecutionTimeoutMs(tier, duration),
      webhook: webhookUrlFor("generation"),
    });
    await admin
      .from("video_clones")
      .update({ runpod_job_id: jobId, num_frames: numFrames, video_path: s3Key })
      .eq("id", created.id);
  } catch (e) {
    console.error("[video-clone] RunPod run falhou:", e instanceof Error ? e.message : e);
    await admin
      .from("video_clones")
      .update({ status: "failed", error_message: "Falha ao iniciar a geração. Tente novamente." })
      .eq("id", created.id);
    // Falha ANTES do débito (nada a estornar) — mas o suporte precisa saber.
    await handleTechFailure({
      feature: "Vídeo Clone (início do job)",
      userId: auth.user_id,
      refId: created.id,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Falha ao iniciar a geração do vídeo.");
  }

  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: cost,
      kind: "video",
      refType: "video_clone",
      refId: created.id,
      note: `Vídeo Clone ${tier.label} — ${Math.ceil(duration)}s`,
    });
  }

  return jsonOk({ clone: { id: created.id, status: "pending", credits_cost: billed ? cost : 0 } }, 201);
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { ids?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return badRequest("Nenhum vídeo selecionado");

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("video_clones")
    .select("id, status, image_path, audio_path, video_path")
    .eq("user_id", auth.user_id)
    .in("id", ids);
  if (error) return serverError("Failed to load video clones");
  // Clone em andamento NÃO pode ser excluído: o estorno automático de falha
  // roda no poll/webhook em cima desta linha — apagar a linha perdia os
  // créditos pra sempre (caso samuel 23/07: 3 clones apagados na espera,
  // 100k cr sem estorno). Exclui só os finalizados; os demais ficam.
  const all = rows ?? [];
  const inFlight = all.filter((r) => r.status === "pending" || r.status === "generating");
  const found = all.filter((r) => r.status !== "pending" && r.status !== "generating");
  if (found.length === 0 && inFlight.length > 0) {
    return badRequest(
      "Esse vídeo ainda está sendo gerado — aguarde terminar. Se falhar, os créditos voltam automaticamente.",
    );
  }
  if (found.length === 0) return jsonOk({ deleted: 0 });

  try {
    // Só apaga o que é DESTE fluxo (uploads + resultado). Fotos do Gerador de
    // Imagem e áudios TTS são compartilhados com outras telas — ficam intactos.
    const inputKeys = found
      .flatMap((r) => [r.image_path, r.audio_path])
      .filter((k): k is string => !!k && k.includes("/video-clone/uploads/"));
    const videoKeys = found.map((r) => r.video_path).filter((k): k is string => !!k);
    if (inputKeys.length) await deleteKeys(R2_BUCKETS.generations, [...new Set(inputKeys)]);
    if (videoKeys.length) await deleteKeys(imagesBucket(), [...new Set(videoKeys)]);
  } catch (e) {
    return serverError(e instanceof Error ? `R2: ${e.message}` : "R2 cleanup failed");
  }

  const foundIds = found.map((r) => r.id);
  const { error: dErr } = await admin
    .from("video_clones")
    .delete()
    .eq("user_id", auth.user_id)
    .in("id", foundIds);
  if (dErr) return serverError("Failed to delete video clones");

  return jsonOk({ deleted: foundIds.length, skipped_in_progress: inFlight.length });
}
