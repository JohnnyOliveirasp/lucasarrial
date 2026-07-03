/**
 * Dispara a geração do CLIPE de UMA cena (image-to-video via Kie) a partir da
 * imagem já gerada (first frame). Não modera (a imagem já passou pela moderação
 * na Fase 3; o prompt de movimento é benigno). NÃO cobra crédito — quem chama
 * decide o débito. Marca a cena `pending` com o taskId, prompts e tier.
 *
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { kieCreateVideoTask, friendlyKieError } from "@/lib/kie/client";
import { getTier, VideoTierId, VIDEO_DURATION_SECONDS, VIDEO_RESOLUTION } from "@/lib/video/tiers";
import { VIDEO_ASPECT_RATIO } from "@/lib/video/config";
import { failSceneVideo } from "@/lib/video/video-sync";

export type StartVideoResult = "started" | "error" | "provider_out_of_credits";

/** Heurística: o erro cru do Kie é por falta de saldo/limite do provedor? */
function isProviderCreditError(raw: string): boolean {
  return /402|insufficient|credit|balance|quota/i.test(raw);
}

export async function startSceneVideo(args: {
  sceneId: string;
  tier: VideoTierId;
  imageUrl: string;
  promptPt: string;
  promptEn: string;
  creditsCost: number;
  callbackUrl?: string;
}): Promise<StartVideoResult> {
  const { sceneId, tier, imageUrl, promptPt, promptEn, creditsCost, callbackUrl } = args;
  const t = getTier(tier);
  if (!t) {
    await failSceneVideo(sceneId, "Tier de vídeo inválido");
    return "error";
  }

  // Persiste o prompt/tier ANTES de chamar o Kie: se o provedor falhar (ex.: sem
  // saldo), a cena mantém o prompt e o usuário consegue clicar em Regerar depois.
  await getAdmin()
    .from("video_scenes")
    .update({ video_prompt_pt: promptPt, video_prompt_en: promptEn, video_tier: tier })
    .eq("id", sceneId);

  try {
    const { taskId } = await kieCreateVideoTask(
      {
        model: t.kieModel,
        promptEn,
        imageUrl,
        aspectRatio: VIDEO_ASPECT_RATIO,
        resolution: VIDEO_RESOLUTION,
        durationSeconds: VIDEO_DURATION_SECONDS,
      },
      { callBackUrl: callbackUrl },
    );

    await getAdmin()
      .from("video_scenes")
      .update({
        video_status: "pending",
        video_kie_task_id: taskId,
        video_credits_cost: creditsCost,
        video_error: null,
      })
      .eq("id", sceneId);

    return "started";
  } catch (e) {
    // Loga o detalhe cru no servidor; guarda mensagem amigável pra UI.
    const raw = e instanceof Error ? e.message : "Falha ao criar o vídeo";
    console.error("[startSceneVideo] Kie falhou:", raw);
    await failSceneVideo(sceneId, friendlyKieError(raw));
    return isProviderCreditError(raw) ? "provider_out_of_credits" : "error";
  }
}
