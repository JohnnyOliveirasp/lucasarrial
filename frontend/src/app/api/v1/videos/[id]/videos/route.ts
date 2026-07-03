/**
 * /api/v1/videos/[id]/videos
 *   GET  → lista as cenas com o estado do CLIPE (+ presigned da imagem e do
 *          vídeo); sincroniza as que estão pending/generating com o Kie (poll).
 *   POST → gera em LOTE o clipe das cenas que ainda não têm, no tier escolhido
 *          (body { tier }). Requer que TODAS as cenas já tenham imagem pronta.
 *          O prompt de movimento sai do Sonnet (visão) — automático, sem custo
 *          extra. Cobra (preço do tier) por cena que efetivamente disparou.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
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
import { generateVideoPrompt } from "@/lib/llm/generate-video-prompt";
import { startSceneVideo } from "@/lib/video/generate-scene-video";
import { syncSceneVideo } from "@/lib/video/video-sync";
import { notifyKieOutOfCredits } from "@/lib/video/notify-provider";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

const SELECT =
  "id, idx, prompt_pt, script_excerpt, image_status, image_path, video_status, video_path, video_prompt_pt, video_tier, video_error, video_kie_task_id";

type SceneRow = {
  id: string;
  idx: number;
  prompt_pt: string;
  script_excerpt: string | null;
  image_status: string | null;
  image_path: string | null;
  video_status: string | null;
  video_path: string | null;
  video_prompt_pt: string | null;
  video_tier: string | null;
  video_error: string | null;
  video_kie_task_id: string | null;
};

async function listScenes(projectId: string): Promise<SceneRow[]> {
  const { data } = await getAdmin()
    .from("video_scenes")
    .select(SELECT)
    .eq("video_project_id", projectId)
    .order("idx", { ascending: true });
  return (data ?? []) as unknown as SceneRow[];
}

async function withUrls(scenes: SceneRow[]) {
  const bucket = imagesBucket();
  return Promise.all(
    scenes.map(async (s) => {
      let image_url: string | null = null;
      let video_url: string | null = null;
      if (s.image_status === "ready" && s.image_path) {
        image_url = await createPresignedGet(bucket, s.image_path, 60 * 60).catch(() => null);
      }
      if (s.video_status === "ready" && s.video_path) {
        video_url = await createPresignedGet(bucket, s.video_path, 60 * 60).catch(() => null);
      }
      return {
        id: s.id,
        idx: s.idx,
        prompt_pt: s.prompt_pt,
        image_status: s.image_status,
        video_status: s.video_status,
        video_prompt_pt: s.video_prompt_pt,
        video_tier: s.video_tier,
        video_error: s.video_error,
        image_url,
        video_url,
      };
    }),
  );
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("id, video_tier")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const scenes = await listScenes(id);
  await Promise.all(
    scenes
      .filter((s) => (s.video_status === "pending" || s.video_status === "generating") && s.video_kie_task_id)
      .map((s) => syncSceneVideo(s.id, auth.user_id, id, s.video_kie_task_id as string).catch(() => {})),
  );
  const fresh = await listScenes(id);

  const allImagesReady = fresh.length > 0 && fresh.every((s) => s.image_status === "ready");

  return jsonOk({
    scenes: await withUrls(fresh),
    tier: project.video_tier,
    all_images_ready: allImagesReady,
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { tier?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const tier = getTier(typeof body.tier === "string" ? body.tier : null);
  if (!tier) return badRequest("Escolha um modelo de vídeo (bronze, prata ou gold).");

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const scenes = await listScenes(id);
  if (scenes.length === 0) return badRequest("Gere as cenas primeiro.");
  if (!scenes.every((s) => s.image_status === "ready")) {
    return badRequest("Todas as cenas precisam ter imagem pronta antes de gerar os vídeos.");
  }

  // Só gera pras cenas sem clipe (null) ou que falharam. Ready/pending ficam.
  const targets = scenes.filter((s) => s.video_status == null || s.video_status === "failed");
  if (targets.length === 0) {
    return jsonOk({ scenes: await withUrls(scenes), started: 0 });
  }

  const costPer = tier.creditsPerClip;
  const billed = !bypassesBilling(auth.email);

  if (billed) {
    const { total } = await getBalance(auth.user_id);
    const need = targets.length * costPer;
    if (total < need) {
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError("insufficient_credits", "Créditos insuficientes para gerar os vídeos.", 402, {
        subscribed,
        balance: total,
        cost: need,
      });
    }
  }

  const bucket = imagesBucket();
  const callbackUrl = kieCallbackUrl();

  const results = await Promise.all(
    targets.map(async (s) => {
      const imageUrl = s.image_path
        ? await createPresignedGet(bucket, s.image_path, 60 * 60).catch(() => null)
        : null;
      if (!imageUrl) return "error" as const;

      // Prompt de movimento via Sonnet (visão). Fallback resiliente por cena.
      let pt = FALLBACK_MOVEMENT_PROMPT_PT;
      let en = FALLBACK_MOVEMENT_PROMPT_EN;
      try {
        const p = await generateVideoPrompt(imageUrl, { context: s.script_excerpt || s.prompt_pt });
        pt = p.pt;
        en = p.en;
      } catch {
        /* usa fallback */
      }

      return startSceneVideo({
        sceneId: s.id,
        tier: tier.id as VideoTierId,
        imageUrl,
        promptPt: pt,
        promptEn: en,
        creditsCost: billed ? costPer : 0,
        callbackUrl,
      });
    }),
  );

  const started = results.filter((r) => r === "started").length;
  const providerOut = results.filter((r) => r === "provider_out_of_credits").length;
  if (providerOut > 0) {
    await notifyKieOutOfCredits({ userEmail: auth.email, projectId: id, failedCount: providerOut });
  }

  if (billed && started > 0) {
    await debitCredits({
      userId: auth.user_id,
      amount: started * costPer,
      kind: "video",
      refType: "video_clips",
      refId: id,
      note: `Vídeos de ${started} cena(s) — ${tier.label}`,
    });
  }

  await admin
    .from("video_projects")
    .update({ status: "videos", video_tier: tier.id })
    .eq("id", id)
    .eq("user_id", auth.user_id);

  const fresh = await listScenes(id);
  return jsonOk({ scenes: await withUrls(fresh), started, tier: tier.id });
}
