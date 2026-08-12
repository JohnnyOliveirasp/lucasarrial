/**
 * Vídeo Estúdio F3 — geração e sincronização das cenas do banco pessoal.
 * Server-only.
 *
 * Ciclo de uma cena NOVA (studio_scenes.status):
 *   planning → generating_still (gpt-image-2 t2i, prompt + sufixo do dialeto)
 *            → animating (grok image-to-video 5s, mesma rota das cenas de teste)
 *            → ready (MP4 baixado pro R2 permanente {user}/studio-bank/{id}.mp4)
 *            → failed (erro amigável; retry re-dispara o still)
 *
 * Os sufixos de dialeto são LITERAIS do 03_DIALETOS_VISUAIS.md do Lucas.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { getAdmin } from "@/lib/db/admin";
import { kieCreateVideoTask, kieGetTask, friendlyKieError } from "@/lib/kie/client";
import { stillTextLooksBroken } from "@/lib/studio/scene-qa";
import { moderateImagePrompt } from "@/lib/llm/moderate-image-prompt";
import { getVideoFallback } from "@/lib/video/tiers";
import { handleTechFailure } from "@/lib/support/failure-alert";
import type { StudioSceneRow } from "@/lib/db/types";

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";
const STILL_MODEL = "gpt-image-2-text-to-image";
const VIDEO_MODEL = "grok-imagine-video-1-5-preview";
// E3 (MAQUINA_EDICAO_AUTOMATICA.md §2.5): ritmo REAL — sem o pedido explícito
// o Grok entrega tudo em câmera lenta/flutuante (regra 4 validada em produção).
const MOTION_PROMPT =
  "subtle handheld camera movement, natural ambient motion, realistic, " +
  "real-time everyday pacing, brisk — NOT slow-motion, not dreamy or floaty, no faces";

/** Prompt-base do dialeto (03_DIALETOS_VISUAIS.md, literal). */
const DIALECT_SUFFIX: Record<"realista" | "craft", string> = {
  realista:
    "shot on iphone, handheld amateur footage, imperfect natural lighting, slightly grainy, " +
    "realistic documentary style, candid, not staged, no cinematic color grade, no professional " +
    "lighting setup, looks like a real person filmed this casually, vertical 9:16 portrait " +
    // E3 §2.5: câmera fixa/média distância + mãos vazias + textura real de pele
    // (anti-plastificação §2.4) — regras validadas em produção no estúdio.
    "composition, fixed camera framing, medium distance — never a close-up, hands empty unless " +
    "holding the featured object, real skin texture, no retouching, no beauty filter, " +
    "no faces, no text watermark",
  craft:
    "top-down macro shot of handcrafted paper and wood objects arranged on a wooden desk, " +
    "warm natural window light, tactile textures, visible hand shadows, DIY/tabletop aesthetic, " +
    "no cinematic color grade, vertical 9:16 composition, no faces, no text watermark",
};

export function sceneBankKey(userId: string, sceneId: string): string {
  return `${userId}/studio-bank/${sceneId}.mp4`;
}

async function kieCreateStill(prompt: string): Promise<string> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("Missing KIE_API_KEY");
  const res = await fetch(`${KIE_BASE}/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: STILL_MODEL,
      input: { prompt, aspect_ratio: "9:16", resolution: "1K" },
    }),
  });
  if (!res.ok) throw new Error(`Kie ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { data?: { taskId?: string } };
  if (!json.data?.taskId) throw new Error("Kie createTask (still) sem taskId");
  return json.data.taskId;
}

/**
 * Dispara o still de uma cena (planning|failed → generating_still).
 * Devolve o taskId do Kie quando despachou (é a referência do débito F5,
 * gravada em debit_ref pelo chamador que cobra) ou null se nem começou
 * (nada foi cobrado — a falha aqui não estorna).
 */
export async function startSceneStill(scene: Pick<StudioSceneRow, "id" | "prompt_en" | "dialect">): Promise<string | null> {
  const admin = getAdmin();
  // W4 (enxerto 1, do gerador antigo): o prompt_en é derivado da FALA do
  // usuário por LLM — modera ANTES do Kie (mesmo classificador do Gerador de
  // Imagem). Bloqueio aqui = nada foi cobrado ainda (débito só após taskId).
  const mod = await moderateImagePrompt(scene.prompt_en);
  if (!mod.allowed) {
    await admin
      .from("studio_scenes")
      .update({
        status: "failed",
        error_message: "Esta cena foi bloqueada pela moderação de conteúdo. Ajuste o trecho do roteiro e gere de novo.",
      } as never)
      .eq("id", scene.id);
    return null;
  }
  try {
    const taskId = await kieCreateStill(`${scene.prompt_en}, ${DIALECT_SUFFIX[scene.dialect]}`);
    await admin
      .from("studio_scenes")
      .update({ status: "generating_still", kie_task_id: taskId, qa_retried: false, error_message: null } as never)
      .eq("id", scene.id);
    return taskId;
  } catch (e) {
    await admin
      .from("studio_scenes")
      .update({
        status: "failed",
        error_message: friendlyKieError(e instanceof Error ? e.message : "erro"),
      } as never)
      .eq("id", scene.id);
    return null;
  }
}

/**
 * Marca a cena como failed + ESTORNA o débito dela (F5; debit_ref é a chave,
 * único por tentativa paga) + alerta o suporte quando é falha técnica.
 */
async function failScene(
  scene: Pick<StudioSceneRow, "id" | "user_id" | "debit_ref">,
  raw: string,
  alertSupport = true,
): Promise<void> {
  await getAdmin()
    .from("studio_scenes")
    .update({ status: "failed", error_message: friendlyKieError(raw).slice(0, 300) } as never)
    .eq("id", scene.id);
  await handleTechFailure({
    feature: "Vídeo Estúdio (cena de b-roll F3)",
    userId: scene.user_id,
    refId: scene.debit_ref ?? scene.id,
    rawError: raw,
    debitRefType: "studio_scene",
    refundRefType: "studio_scene_refund",
    alertSupport,
  });
}

/** Sincroniza UMA cena pendente com o Kie (chamado pelo poll do projeto). */
export async function syncStudioScene(scene: StudioSceneRow): Promise<void> {
  const admin = getAdmin();

  if (scene.status === "generating_still" && scene.kie_task_id) {
    const info = await kieGetTask(scene.kie_task_id);
    if (info.state === "fail") {
      await failScene(scene, info.failMsg || info.failCode || "still falhou");
      return;
    }
    if (info.state !== "success") return;
    const stillUrl = info.resultUrls[0];
    if (!stillUrl) {
      await failScene(scene, "still sem resultado");
      return;
    }

    // QA automático (F5): texto quebrado não sobe. Regera o still 1x
    // (a variação do modelo costuma resolver); persistindo, reprova a cena
    // com estorno — SEM e-mail pro suporte (não é falha de infra).
    const broken = await stillTextLooksBroken(stillUrl);
    if (broken && !scene.qa_retried) {
      try {
        const retryTask = await kieCreateStill(`${scene.prompt_en}, ${DIALECT_SUFFIX[scene.dialect]}`);
        await admin
          .from("studio_scenes")
          .update({ kie_task_id: retryTask, qa_retried: true } as never)
          .eq("id", scene.id);
      } catch (e) {
        await failScene(scene, e instanceof Error ? e.message : "regerar still falhou");
      }
      return;
    }
    if (broken) {
      await failScene(scene, "A cena saiu com texto ilegível (QA automático). Gere as cenas de novo.", false);
      return;
    }

    // W4 (enxerto 2, pré-requisito): persiste o still no R2 — a URL do Kie
    // expira, e o failover de animação precisa da imagem de entrada. Best-effort:
    // sem still salvo a cena segue normal, só perde o direito ao fallback.
    let stillKey: string | null = scene.image_path;
    if (!stillKey) {
      try {
        const resp = await fetch(stillUrl, { cache: "no-store" });
        if (resp.ok) {
          const bytes = Buffer.from(await resp.arrayBuffer());
          stillKey = `${scene.user_id}/studio-bank/${scene.id}-still.png`;
          await r2.send(
            new PutObjectCommand({
              Bucket: imagesBucket(),
              Key: stillKey,
              Body: bytes,
              ContentType: resp.headers.get("content-type") ?? "image/png",
            }),
          );
        }
      } catch {
        stillKey = null;
      }
    }

    try {
      const { taskId } = await kieCreateVideoTask({
        model: VIDEO_MODEL,
        promptEn: MOTION_PROMPT,
        imageUrl: stillUrl,
        aspectRatio: "9:16",
        resolution: "720p",
        durationSeconds: 5,
      });
      await admin
        .from("studio_scenes")
        .update({ status: "animating", kie_task_id: taskId, image_path: stillKey } as never)
        .eq("id", scene.id);
    } catch (e) {
      await failScene(scene, e instanceof Error ? e.message : "animação não iniciou");
    }
    return;
  }

  if (scene.status === "animating" && scene.kie_task_id) {
    const info = await kieGetTask(scene.kie_task_id);
    if (info.state === "fail") {
      // W4 (enxerto 2, do gerador antigo): 1 retry no modelo reserva antes de
      // reprovar — claim atômico (anim_retried false→true) garante que poll ×
      // webhook não redespachem em dobro; SEM cobrar de novo (mesmo debit_ref).
      const fb = getVideoFallback("bronze");
      if (fb && !scene.anim_retried && scene.image_path) {
        const { data: claimed } = await admin
          .from("studio_scenes")
          .update({ anim_retried: true } as never)
          .eq("id", scene.id)
          .eq("anim_retried", false)
          .select("id");
        if (!claimed || claimed.length === 0) return; // outro sync já assumiu
        try {
          const stillAgain = await createPresignedGet(imagesBucket(), scene.image_path, 3600);
          const { taskId } = await kieCreateVideoTask({
            model: fb.kieModel,
            promptEn: MOTION_PROMPT,
            imageUrl: stillAgain,
            aspectRatio: "9:16",
            resolution: fb.resolution,
            durationSeconds: fb.durationSeconds,
          });
          await admin
            .from("studio_scenes")
            .update({ kie_task_id: taskId } as never)
            .eq("id", scene.id);
          return;
        } catch {
          /* reserva também não subiu — cai na reprova com estorno abaixo */
        }
      }
      await failScene(scene, info.failMsg || info.failCode || "animação falhou");
      return;
    }
    if (info.state !== "success") return;
    const videoUrl = info.resultUrls[0];
    if (!videoUrl) {
      await failScene(scene, "animação sem resultado");
      return;
    }
    try {
      const res = await fetch(videoUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`download ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const key = sceneBankKey(scene.user_id, scene.id);
      await r2.send(
        new PutObjectCommand({
          Bucket: imagesBucket(),
          Key: key,
          Body: bytes,
          ContentType: "video/mp4",
        }),
      );
      await admin
        .from("studio_scenes")
        .update({ status: "ready", video_path: key, error_message: null } as never)
        .eq("id", scene.id);
    } catch (e) {
      await failScene(scene, e instanceof Error ? `salvar cena: ${e.message}` : "salvar cena falhou");
    }
  }
}
