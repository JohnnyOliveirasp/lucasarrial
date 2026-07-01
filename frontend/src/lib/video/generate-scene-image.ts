/**
 * Dispara a geração da imagem de UMA cena (image-to-image via Kie), reusando o
 * motor do gerador convencional: traduz o prompt pt→en preservando a identidade
 * da referência, modera o conteúdo e cria a task no Kie. Atualiza a row da cena
 * pra `pending` com o taskId. NÃO cobra crédito — quem chama decide o débito.
 *
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { kieCreateImageTask } from "@/lib/kie/client";
import { generateImagePrompt } from "@/lib/llm/generate-image-prompt";
import { moderateImagePrompt } from "@/lib/llm/moderate-image-prompt";
import { VIDEO_ASPECT_RATIO } from "@/lib/video/config";
import { failSceneImage } from "@/lib/video/image-sync";

export type StartSceneResult = "started" | "blocked" | "error";

/**
 * Traduz+modera+cria a task da imagem da cena. Marca a cena `pending` (started),
 * `failed` (blocked/error). `creditsCost` é só gravado na row (o débito é do chamador).
 */
export async function startSceneImage(args: {
  sceneId: string;
  promptPt: string;
  referenceUrls: string[];
  resolution: string;
  creditsCost: number;
  callbackUrl?: string;
}): Promise<StartSceneResult> {
  const { sceneId, promptPt, referenceUrls, resolution, creditsCost, callbackUrl } = args;

  // pt → en preservando a identidade da referência (mesmo motor do gerador).
  const en = await generateImagePrompt(promptPt);
  if (en === "__BLOCKED__") {
    await failSceneImage(sceneId, "Conteúdo bloqueado pela moderação.");
    return "blocked";
  }

  const mod = await moderateImagePrompt(en);
  if (!mod.allowed) {
    await failSceneImage(sceneId, "Conteúdo bloqueado pela moderação.");
    return "blocked";
  }

  try {
    const { taskId } = await kieCreateImageTask(
      {
        prompt: en,
        input_urls: referenceUrls,
        aspect_ratio: VIDEO_ASPECT_RATIO,
        resolution,
      },
      { callBackUrl: callbackUrl },
    );

    await getAdmin()
      .from("video_scenes")
      .update({
        image_status: "pending",
        image_kie_task_id: taskId,
        prompt_en: en,
        resolution,
        image_credits_cost: creditsCost,
        image_error: null,
      })
      .eq("id", sceneId);

    return "started";
  } catch (e) {
    await failSceneImage(sceneId, e instanceof Error ? e.message : "Falha ao criar a imagem");
    return "error";
  }
}
