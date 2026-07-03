/**
 * POST /api/v1/videos/[id]/videos/[sceneId]/regenerate
 *   Regera o CLIPE de UMA cena com o prompt atual (ou um novo `prompt_pt`
 *   editado à mão). Usa o tier já escolhido no projeto. Cobra o preço do tier
 *   (só se disparar). Edição manual do prompt é grátis (a cobrança é do vídeo).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { subscriptionGate } from "@/lib/credits/subscription-gate";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { kieCallbackUrl } from "@/lib/kie/client";
import {
  getTier,
  VideoTierId,
  FALLBACK_MOVEMENT_PROMPT_PT,
  FALLBACK_MOVEMENT_PROMPT_EN,
} from "@/lib/video/tiers";
import { translateMovementPromptToEn, generateVideoPrompt } from "@/lib/llm/generate-video-prompt";
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

  const gate = await subscriptionGate(auth);
  if (gate) return gate;

  let body: { prompt_pt?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("video_tier")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const tier = getTier(project.video_tier);
  if (!tier) return badRequest("Escolha um modelo de vídeo antes de regerar.");

  const { data: scene } = await admin
    .from("video_scenes")
    .select("id, image_status, image_path, prompt_pt, script_excerpt, video_prompt_pt, video_prompt_en")
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!scene) return notFound("Scene");
  if (scene.image_status !== "ready" || !scene.image_path) {
    return badRequest("A imagem desta cena precisa estar pronta antes de gerar o vídeo.");
  }

  const imageUrl = await createPresignedGet(imagesBucket(), scene.image_path, 60 * 60).catch(() => null);
  if (!imageUrl) return serverError("Não consegui ler a imagem da cena.");

  // Prompt: novo (editado à mão) → traduz; senão reusa o que já existe; se não
  // houver nenhum (ex.: clipe falhou antes de salvar), gera via Sonnet (grátis).
  let promptPt = scene.video_prompt_pt ?? "";
  let promptEn = scene.video_prompt_en ?? "";
  if (typeof body.prompt_pt === "string" && body.prompt_pt.trim()) {
    promptPt = body.prompt_pt.trim().slice(0, 2000);
    promptEn = await translateMovementPromptToEn(promptPt);
  } else if (!promptPt || !promptEn) {
    promptPt = FALLBACK_MOVEMENT_PROMPT_PT;
    promptEn = FALLBACK_MOVEMENT_PROMPT_EN;
    try {
      const p = await generateVideoPrompt(imageUrl, { context: scene.script_excerpt || scene.prompt_pt });
      promptPt = p.pt;
      promptEn = p.en;
    } catch {
      /* usa fallback */
    }
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
      return jsonError("insufficient_credits", `Gerar o vídeo (${tier.label}) custa ${cost} créditos.`, 402, {
        subscribed,
        balance: total,
        cost,
      });
    }
  }

  const result = await startSceneVideo({
    sceneId,
    tier: tier.id as VideoTierId,
    imageUrl,
    promptPt,
    promptEn,
    creditsCost: billed ? cost : 0,
    callbackUrl: kieCallbackUrl(),
  });
  if (result === "provider_out_of_credits") {
    await notifyKieOutOfCredits({ userEmail: auth.email, projectId: id, failedCount: 1 });
    return jsonError(
      "provider_unavailable",
      "O serviço de vídeo está indisponível no momento (limite do provedor). Já avisamos o suporte — tente novamente mais tarde.",
      503,
    );
  }
  if (result === "error") return serverError("Falha ao iniciar a geração do vídeo.");

  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: cost,
      kind: "video",
      refType: "video_clip_regen",
      refId: sceneId,
      note: `Regerar vídeo da cena — ${tier.label}`,
    });
  }

  return jsonOk({ scene: { id: sceneId, video_status: "pending", video_prompt_pt: promptPt } });
}
