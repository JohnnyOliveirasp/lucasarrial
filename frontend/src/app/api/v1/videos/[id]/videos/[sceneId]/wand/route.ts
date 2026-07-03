/**
 * POST /api/v1/videos/[id]/videos/[sceneId]/wand
 *   ✨ Varinha de vídeo: o Sonnet (COM VISÃO) olha a imagem da cena e re-escreve
 *   o prompt de movimento; em seguida gera o clipe com esse novo prompt.
 *   Cobra VIDEO_PROMPT_WAND_COST (Sonnet + imagem) + o preço do tier (o clipe).
 *   Cobra o Sonnet só se ele der certo; cobra o clipe só se disparar.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { kieCallbackUrl } from "@/lib/kie/client";
import { getTier, VideoTierId, VIDEO_PROMPT_WAND_COST } from "@/lib/video/tiers";
import { generateVideoPrompt } from "@/lib/llm/generate-video-prompt";
import { startSceneVideo } from "@/lib/video/generate-scene-video";
import { notifyKieOutOfCredits } from "@/lib/video/notify-provider";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id, sceneId } = await ctx.params;

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("video_tier")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const tier = getTier(project.video_tier);
  if (!tier) return badRequest("Escolha um modelo de vídeo antes de usar a varinha.");

  const { data: scene } = await admin
    .from("video_scenes")
    .select("id, image_status, image_path, prompt_pt, script_excerpt")
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!scene) return notFound("Scene");
  if (scene.image_status !== "ready" || !scene.image_path) {
    return badRequest("A imagem desta cena precisa estar pronta primeiro.");
  }

  const clipCost = tier.creditsPerClip;
  const totalCost = VIDEO_PROMPT_WAND_COST + clipCost;
  const billed = !bypassesBilling(auth.email);

  if (billed) {
    const { total } = await getBalance(auth.user_id);
    if (total < totalCost) {
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError(
        "insufficient_credits",
        `A varinha custa ${VIDEO_PROMPT_WAND_COST} + ${clipCost} (${tier.label}) = ${totalCost} créditos.`,
        402,
        { subscribed, balance: total, cost: totalCost },
      );
    }
  }

  const imageUrl = await createPresignedGet(imagesBucket(), scene.image_path, 60 * 60).catch(() => null);
  if (!imageUrl) return serverError("Não consegui ler a imagem da cena.");

  // 1) Novo prompt via Sonnet (visão). Só cobra se der certo.
  let pt: string;
  let en: string;
  try {
    const p = await generateVideoPrompt(imageUrl, { context: scene.script_excerpt || scene.prompt_pt });
    pt = p.pt;
    en = p.en;
  } catch {
    return serverError("A varinha (Sonnet com visão) não conseguiu gerar o prompt. Tente de novo.");
  }

  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: VIDEO_PROMPT_WAND_COST,
      kind: "video",
      refType: "video_prompt_wand",
      refId: sceneId,
      note: "Varinha de vídeo (Sonnet com visão)",
    });
  }

  // 2) Gera o clipe com o novo prompt. Cobra o preço do tier.
  const result = await startSceneVideo({
    sceneId,
    tier: tier.id as VideoTierId,
    imageUrl,
    promptPt: pt,
    promptEn: en,
    creditsCost: billed ? clipCost : 0,
    callbackUrl: kieCallbackUrl(),
  });
  if (result === "provider_out_of_credits") {
    await notifyKieOutOfCredits({ userEmail: auth.email, projectId: id, failedCount: 1 });
    // O novo prompt foi gerado e salvo (varinha cobrada); o clipe não iniciou e
    // NÃO é cobrado. Quando o provedor normalizar, "Regerar" reusa este prompt.
    return jsonError(
      "provider_unavailable",
      "Novo prompt criado, mas o serviço de vídeo está indisponível (limite do provedor). Já avisamos o suporte — clique em Regerar mais tarde (sem custo do prompt de novo).",
      503,
      { video_prompt_pt: pt },
    );
  }
  if (result === "error") return serverError("Prompt gerado, mas falhou ao iniciar o vídeo. Tente regerar.");

  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: clipCost,
      kind: "video",
      refType: "video_clip_regen",
      refId: sceneId,
      note: `Vídeo pós-varinha — ${tier.label}`,
    });
  }

  return jsonOk({ scene: { id: sceneId, video_status: "pending", video_prompt_pt: pt } });
}
