/**
 * POST /api/v1/images/[id]/video
 *   Anima a imagem gerada (image-to-video via Kie). A pessoa escolhe o tier
 *   (bronze/prata/gold) e escreve o prompt de movimento em pt-BR — o Haiku
 *   traduz pra inglês antes de enviar ao modelo. Cobra o preço do tier (só se
 *   disparar). Regerar sobrescreve o vídeo anterior da imagem.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { kieCreateVideoTask, kieCallbackUrl, friendlyKieError } from "@/lib/kie/client";
import {
  getTier,
  FALLBACK_MOVEMENT_PROMPT_PT,
  FALLBACK_MOVEMENT_PROMPT_EN,
  VIDEO_DURATION_SECONDS,
  VIDEO_RESOLUTION,
} from "@/lib/video/tiers";
import { VIDEO_ASPECT_RATIO } from "@/lib/video/config";
import { translateMovementPromptToEn } from "@/lib/llm/generate-video-prompt";
import { failImageVideo } from "@/lib/images/video-sync";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

/** Ratios que os modelos de vídeo do Kie aceitam; fora disso cai no vertical. */
const VIDEO_RATIOS = new Set(["9:16", "16:9", "1:1", "4:3", "3:4"]);

function isProviderCreditError(raw: string): boolean {
  return /402|insufficient|credit|balance|quota/i.test(raw);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { tier?: unknown; prompt_pt?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }

  const tier = getTier(typeof body.tier === "string" ? body.tier : null);
  if (!tier) return badRequest("Escolha um modelo de vídeo (bronze, prata ou gold).");

  const admin = getAdmin();
  const { data: gen } = await admin
    .from("image_generations")
    .select("id, status, image_path, aspect_ratio, video_status")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!gen) return notFound("Image");
  if (gen.status !== "ready" || !gen.image_path) {
    return badRequest("A imagem precisa estar pronta antes de gerar o vídeo.");
  }
  if (gen.video_status === "pending" || gen.video_status === "generating") {
    return badRequest("Já existe um vídeo desta imagem em andamento. Aguarde terminar.");
  }

  const imageUrl = await createPresignedGet(imagesBucket(), gen.image_path, 60 * 60).catch(() => null);
  if (!imageUrl) return serverError("Não consegui ler a imagem.");

  // Prompt de movimento: pt-BR da pessoa → Haiku traduz. Vazio → fallback padrão.
  let promptPt = FALLBACK_MOVEMENT_PROMPT_PT;
  let promptEn = FALLBACK_MOVEMENT_PROMPT_EN;
  if (typeof body.prompt_pt === "string" && body.prompt_pt.trim()) {
    promptPt = body.prompt_pt.trim().slice(0, 2000);
    promptEn = await translateMovementPromptToEn(promptPt);
  }

  const cost = tier.creditsPerClip;
  const billed = !bypassesBilling(auth.email);
  if (billed) {
    const { total } = await getBalance(auth.user_id);
    if (total < cost) {
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError("insufficient_credits", `Animar a imagem (${tier.label}) custa ${cost} créditos.`, 402, {
        subscribed,
        balance: total,
        cost,
      });
    }
  }

  // Persiste prompt/tier ANTES do Kie: se o provedor falhar, a pessoa regenera.
  await admin
    .from("image_generations")
    .update({ video_prompt_pt: promptPt, video_prompt_en: promptEn, video_tier: tier.id })
    .eq("id", id);

  // O vídeo sai no ratio da imagem quando o modelo aceita; senão vertical padrão.
  const aspectRatio = VIDEO_RATIOS.has(gen.aspect_ratio) ? gen.aspect_ratio : VIDEO_ASPECT_RATIO;

  try {
    const { taskId } = await kieCreateVideoTask(
      {
        model: tier.kieModel,
        promptEn,
        imageUrl,
        aspectRatio,
        resolution: VIDEO_RESOLUTION,
        durationSeconds: VIDEO_DURATION_SECONDS,
      },
      { callBackUrl: kieCallbackUrl() },
    );

    await admin
      .from("image_generations")
      .update({
        video_status: "pending",
        video_kie_task_id: taskId,
        video_credits_cost: billed ? cost : 0,
        video_error: null,
        video_path: null,
      })
      .eq("id", id);
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Falha ao criar o vídeo";
    console.error("[images/video] Kie falhou:", raw);
    await failImageVideo(id, friendlyKieError(raw));
    if (isProviderCreditError(raw)) {
      return jsonError(
        "provider_unavailable",
        "O serviço de vídeo está indisponível no momento (limite do provedor). Tente novamente mais tarde.",
        503,
      );
    }
    return serverError("Falha ao iniciar a geração do vídeo.");
  }

  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: cost,
      kind: "video",
      refType: "image_video",
      refId: id,
      note: `Animar imagem — ${tier.label}`,
    });
  }

  return jsonOk({ image: { id, video_status: "pending", video_prompt_pt: promptPt, video_tier: tier.id } });
}
