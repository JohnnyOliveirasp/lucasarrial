/**
 * Dispara a geração do CLIPE de UMA cena (image-to-video via Kie) a partir da
 * imagem já gerada (first frame). Não modera (a imagem já passou pela moderação
 * na Fase 3; o prompt de movimento é benigno). NÃO cobra crédito — quem chama
 * decide o débito. Marca a cena `pending` com o taskId, prompts e tier.
 *
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { kieCreateVideoTask } from "@/lib/kie/client";
import { getTier, VideoTierId, VIDEO_DURATION_SECONDS, VIDEO_RESOLUTION } from "@/lib/video/tiers";
import { VIDEO_ASPECT_RATIO } from "@/lib/video/config";
import { failSceneVideo } from "@/lib/video/video-sync";
import type { ReservaLike } from "@/lib/video/regen-fallback";

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
  /**
   * CONTINGÊNCIA do Regerar (#485, perna (b)): quando o titular do tier JÁ
   * falhou nesta cena, quem chama passa o reserva do tier e o despacho vai
   * nele. Sem isto, o Regerar redespachava no mesmo motor que acabara de
   * falhar — no Bronze, um PREVIEW — e cobrava de novo (hercules.contador@
   * 22.440 cr, josimocerqueira@ 10.560 cr, nenhum dos dois recebeu vídeo).
   * Quem decide é `escolherModeloDoRegen`; aqui só se obedece.
   */
  reserva?: ReservaLike | null;
}): Promise<StartVideoResult> {
  const { sceneId, tier, imageUrl, promptPt, promptEn, creditsCost, callbackUrl, reserva } = args;
  const t = getTier(tier);
  if (!t) {
    await failSceneVideo(sceneId, "Tier de vídeo inválido");
    return "error";
  }

  // Titular por padrão; reserva só quando quem chama mandou. O tier gravado na
  // linha continua sendo o CONTRATADO (o aluno pagou Bronze e recebe Bronze) —
  // a troca de motor é contingência nossa, e a diferença de custo é nossa.
  const motor = reserva ?? {
    kieModel: t.kieModel,
    resolution: VIDEO_RESOLUTION,
    durationSeconds: VIDEO_DURATION_SECONDS,
  };

  // Persiste o prompt/tier ANTES de chamar o Kie: se o provedor falhar (ex.: sem
  // saldo), a cena mantém o prompt e o usuário consegue clicar em Regerar depois.
  await getAdmin()
    .from("video_scenes")
    .update({ video_prompt_pt: promptPt, video_prompt_en: promptEn, video_tier: tier })
    .eq("id", sceneId);

  try {
    const { taskId } = await kieCreateVideoTask(
      {
        model: motor.kieModel,
        promptEn,
        imageUrl,
        aspectRatio: VIDEO_ASPECT_RATIO,
        resolution: motor.resolution,
        durationSeconds: motor.durationSeconds,
      },
      { callBackUrl: callbackUrl },
    );
    if (reserva) {
      // `video_scenes` não tem coluna de modelo (só `video_tier`), então o
      // rastro de QUAL motor rodou fica no log — mesmo padrão do irmão
      // `lib/images/video-sync.ts`, que loga "[image-video] fallback ... assumiu".
      console.warn(`[scene-video] reserva ${motor.kieModel} assumiu a cena ${sceneId}`);
    }

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
    // CRU: quem traduz é o failSceneVideo, que também abre o chamado (#425/#484).
    await failSceneVideo(sceneId, raw);
    return isProviderCreditError(raw) ? "provider_out_of_credits" : "error";
  }
}
