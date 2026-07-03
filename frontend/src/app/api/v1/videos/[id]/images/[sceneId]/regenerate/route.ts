/**
 * POST /api/v1/videos/[id]/images/[sceneId]/regenerate
 *   Regera a imagem de UMA cena. Opcional: novo `prompt_pt` e/ou `resolution`
 *   (1K/2K/4K). Cobra o custo da resolução escolhida (só se disparar).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { imageCreditCost, resolveResolutionForAspect, RESOLUTION_VALUES } from "@/lib/kie/config";
import { VIDEO_ASPECT_RATIO } from "@/lib/video/config";
import { kieCallbackUrl } from "@/lib/kie/client";
import { startSceneImage } from "@/lib/video/generate-scene-image";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id, sceneId } = await ctx.params;

  let body: { resolution?: unknown; prompt_pt?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("reference_image_paths, image_consent_at")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");
  const refs = (project.reference_image_paths ?? []) as string[];
  if (refs.length === 0 || !project.image_consent_at) {
    return badRequest("Envie a foto de referência e confirme a ciência antes de gerar.");
  }

  const { data: scene } = await admin
    .from("video_scenes")
    .select("id, prompt_pt")
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!scene) return notFound("Scene");

  // Edição opcional do prompt antes de regerar.
  let promptPt = scene.prompt_pt;
  if (typeof body.prompt_pt === "string" && body.prompt_pt.trim()) {
    promptPt = body.prompt_pt.trim().slice(0, 2000);
    await admin.from("video_scenes").update({ prompt_pt: promptPt }).eq("id", sceneId);
  }

  const reqRes = typeof body.resolution === "string" ? body.resolution : "1K";
  const resolution = resolveResolutionForAspect(
    VIDEO_ASPECT_RATIO,
    RESOLUTION_VALUES.includes(reqRes) ? reqRes : "1K",
  );
  const cost = imageCreditCost(resolution);
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
      return jsonError("insufficient_credits", `Gerar em ${resolution} custa ${cost} créditos.`, 402, {
        subscribed,
        balance: total,
        cost,
      });
    }
  }

  const referenceUrls = (
    await Promise.all(refs.map((k) => createPresignedGet(imagesBucket(), k, 60 * 60).catch(() => null)))
  ).filter((u): u is string => !!u);
  if (referenceUrls.length === 0) return serverError("Não consegui ler as fotos de referência.");

  const result = await startSceneImage({
    sceneId,
    promptPt,
    referenceUrls,
    resolution,
    creditsCost: billed ? cost : 0,
    callbackUrl: kieCallbackUrl(),
  });

  if (result === "blocked") {
    return jsonError("content_blocked", "Conteúdo bloqueado pela moderação.", 400);
  }
  if (result === "error") {
    return serverError("Falha ao iniciar a geração da imagem.");
  }

  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: cost,
      kind: "video",
      refType: "video_image_regen",
      refId: sceneId,
      note: `Regerar imagem da cena (${resolution})`,
    });
  }

  return jsonOk({ scene: { id: sceneId, image_status: "pending", resolution } });
}
