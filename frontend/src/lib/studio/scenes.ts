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
import { getAdmin } from "@/lib/db/admin";
import { kieCreateVideoTask, kieGetTask, friendlyKieError } from "@/lib/kie/client";
import type { StudioSceneRow } from "@/lib/db/types";

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";
const STILL_MODEL = "gpt-image-2-text-to-image";
const VIDEO_MODEL = "grok-imagine-video-1-5-preview";
const MOTION_PROMPT =
  "subtle handheld camera movement, natural ambient motion, realistic, no faces";

/** Prompt-base do dialeto (03_DIALETOS_VISUAIS.md, literal). */
const DIALECT_SUFFIX: Record<"realista" | "craft", string> = {
  realista:
    "shot on iphone, handheld amateur footage, imperfect natural lighting, slightly grainy, " +
    "realistic documentary style, candid, not staged, no cinematic color grade, no professional " +
    "lighting setup, looks like a real person filmed this casually, vertical 9:16 portrait " +
    "composition, no faces, no text watermark",
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

/** Dispara o still de uma cena (planning|failed → generating_still). */
export async function startSceneStill(scene: Pick<StudioSceneRow, "id" | "prompt_en" | "dialect">): Promise<void> {
  const admin = getAdmin();
  try {
    const taskId = await kieCreateStill(`${scene.prompt_en}, ${DIALECT_SUFFIX[scene.dialect]}`);
    await admin
      .from("studio_scenes")
      .update({ status: "generating_still", kie_task_id: taskId, error_message: null } as never)
      .eq("id", scene.id);
  } catch (e) {
    await admin
      .from("studio_scenes")
      .update({
        status: "failed",
        error_message: friendlyKieError(e instanceof Error ? e.message : "erro"),
      } as never)
      .eq("id", scene.id);
  }
}

async function failScene(sceneId: string, raw: string): Promise<void> {
  await getAdmin()
    .from("studio_scenes")
    .update({ status: "failed", error_message: friendlyKieError(raw).slice(0, 300) } as never)
    .eq("id", sceneId);
}

/** Sincroniza UMA cena pendente com o Kie (chamado pelo poll do projeto). */
export async function syncStudioScene(scene: StudioSceneRow): Promise<void> {
  const admin = getAdmin();

  if (scene.status === "generating_still" && scene.kie_task_id) {
    const info = await kieGetTask(scene.kie_task_id);
    if (info.state === "fail") {
      await failScene(scene.id, info.failMsg || info.failCode || "still falhou");
      return;
    }
    if (info.state !== "success") return;
    const stillUrl = info.resultUrls[0];
    if (!stillUrl) {
      await failScene(scene.id, "still sem resultado");
      return;
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
        .update({ status: "animating", kie_task_id: taskId } as never)
        .eq("id", scene.id);
    } catch (e) {
      await failScene(scene.id, e instanceof Error ? e.message : "animação não iniciou");
    }
    return;
  }

  if (scene.status === "animating" && scene.kie_task_id) {
    const info = await kieGetTask(scene.kie_task_id);
    if (info.state === "fail") {
      await failScene(scene.id, info.failMsg || info.failCode || "animação falhou");
      return;
    }
    if (info.state !== "success") return;
    const videoUrl = info.resultUrls[0];
    if (!videoUrl) {
      await failScene(scene.id, "animação sem resultado");
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
      await failScene(scene.id, e instanceof Error ? `salvar cena: ${e.message}` : "salvar cena falhou");
    }
  }
}
