/**
 * /api/v1/videos/[id]/images
 *   GET  → lista as cenas com o estado da imagem (+ presigned URL); sincroniza
 *          as que estão pending/generating com o Kie (poll).
 *   POST → gera em LOTE a imagem das cenas que ainda não têm (1K por padrão).
 *          Requer referência + ciência no projeto. Cobra 12 créditos por cena
 *          que efetivamente disparou (equipe/admin não é cobrada).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { failSceneImage } from "@/lib/video/image-sync";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { imageCreditCost, resolveResolutionForAspect } from "@/lib/kie/config";
import { VIDEO_ASPECT_RATIO } from "@/lib/video/config";
import { kieCallbackUrl } from "@/lib/kie/client";
import { startSceneImage } from "@/lib/video/generate-scene-image";
import { syncSceneImage } from "@/lib/video/image-sync";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

const SELECT =
  "id, idx, prompt_pt, image_status, image_path, resolution, image_error, image_started_at, created_at";
/** Teto de espera de UMA imagem. A Kie costuma levar 1-3 min; passou disso
 *  sem resposta, a cena vira falha pra pessoa poder refazer (18/08). */
const SCENE_IMAGE_TIMEOUT_MINUTES = 10;
const BATCH_RESOLUTION = "1K";

type SceneRow = {
  id: string;
  idx: number;
  prompt_pt: string;
  image_status: string | null;
  image_path: string | null;
  resolution: string;
  image_error: string | null;
  image_started_at: string | null;
  created_at: string | null;
};

async function listScenes(projectId: string) {
  const { data } = await getAdmin()
    .from("video_scenes")
    .select(SELECT + ", image_kie_task_id")
    .eq("video_project_id", projectId)
    .order("idx", { ascending: true });
  return (data ?? []) as unknown as (SceneRow & { image_kie_task_id: string | null })[];
}

async function withUrls(scenes: SceneRow[]) {
  return Promise.all(
    scenes.map(async (s) => {
      let image_url: string | null = null;
      if (s.image_status === "ready" && s.image_path) {
        try {
          image_url = await createPresignedGet(imagesBucket(), s.image_path, 60 * 60);
        } catch {
          image_url = null;
        }
      }
      return {
        id: s.id,
        idx: s.idx,
        prompt_pt: s.prompt_pt,
        image_status: s.image_status,
        resolution: s.resolution,
        image_error: s.image_error,
        image_url,
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
    .select("id, reference_image_paths, image_consent_at")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const scenes = await listScenes(id);
  // Poll das que estão em andamento.
  //
  // ⏱️ TETO DE ESPERA (18/08, caso Johnny — cena 5 girando há 20 min enquanto
  // as outras 11 ficaram prontas). O `catch` abaixo engole a falha do poll de
  // propósito (uma cena não pode derrubar as outras), só que sem um teto isso
  // vira espera infinita: se a Kie perde a task ou nunca muda de estado, a
  // cena fica "gerando" para sempre e a pessoa não tem o que fazer — não há
  // botão porque a UI só oferece refazer no estado de falha.
  //
  // Passado o teto, a cena vira `failed` com o motivo. Isso já faz o botão de
  // refazer aparecer sozinho (`regenerate` não exige estado nenhum) e, se
  // houve cobrança, o estorno segue o mesmo caminho de qualquer falha.
  await Promise.all(
    scenes
      .filter((s) => (s.image_status === "pending" || s.image_status === "generating") && s.image_kie_task_id)
      .map(async (s) => {
        try {
          await syncSceneImage(s.id, auth.user_id, id, s.image_kie_task_id as string);
        } catch {
          /* poll falhou nesta cena — as outras seguem; o teto abaixo resolve */
        }
        const desde = s.image_started_at ?? s.created_at;
        const minutos = desde ? (Date.now() - new Date(desde).getTime()) / 60000 : 0;
        if (minutos > SCENE_IMAGE_TIMEOUT_MINUTES) {
          await failSceneImage(
            s.id,
            `A geração passou de ${SCENE_IMAGE_TIMEOUT_MINUTES} minutos sem resposta e foi encerrada. Clique em refazer para tentar de novo.`,
          ).catch(() => {});
        }
      }),
  );
  const fresh = await listScenes(id);

  return jsonOk({
    scenes: await withUrls(fresh),
    has_reference: (project.reference_image_paths ?? []).length > 0,
    has_consent: !!project.image_consent_at,
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: project } = await admin
    .from("video_projects")
    .select("id, kind, reference_image_paths, product_image_paths, image_consent_at")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Video project");

  const personRefs = (project.reference_image_paths ?? []) as string[];
  if (personRefs.length === 0 || !project.image_consent_at) {
    return badRequest("Envie a foto de referência e confirme a ciência antes de gerar.");
  }
  // Vídeo Vendas: o PRODUTO entra junto como referência (pessoa primeiro —
  // identidade manda). Cap conservador de inputs pro Kie: 3 pessoa + 2 produto.
  const productRefs =
    project.kind === "sales" ? ((project.product_image_paths ?? []) as string[]) : [];
  const refs =
    productRefs.length > 0
      ? [...personRefs.slice(0, 3), ...productRefs.slice(0, 2)]
      : personRefs;

  const scenes = await listScenes(id);
  if (scenes.length === 0) return badRequest("Gere as cenas primeiro.");

  // Só gera pras cenas sem imagem (null) ou que falharam. Ready/pending ficam.
  const targets = scenes.filter((s) => s.image_status == null || s.image_status === "failed");
  if (targets.length === 0) {
    return jsonOk({ scenes: await withUrls(scenes), started: 0, blocked: 0 });
  }

  const resolution = resolveResolutionForAspect(VIDEO_ASPECT_RATIO, BATCH_RESOLUTION);
  const costPer = imageCreditCost(resolution);
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
      return jsonError("insufficient_credits", "Créditos insuficientes para gerar as imagens.", 402, {
        subscribed,
        balance: total,
        cost: need,
      });
    }
  }

  // Referências como URLs presigned (entram como input_urls no Kie).
  const referenceUrls = (
    await Promise.all(refs.map((k) => createPresignedGet(imagesBucket(), k, 60 * 60).catch(() => null)))
  ).filter((u): u is string => !!u);
  if (referenceUrls.length === 0) return serverError("Não consegui ler as fotos de referência.");

  const callbackUrl = kieCallbackUrl();
  const results = await Promise.all(
    targets.map((s) =>
      startSceneImage({
        sceneId: s.id,
        promptPt: s.prompt_pt,
        referenceUrls,
        resolution,
        creditsCost: billed ? costPer : 0,
        callbackUrl,
      }),
    ),
  );

  const started = results.filter((r) => r === "started").length;
  const blocked = results.filter((r) => r === "blocked").length;

  if (billed && started > 0) {
    await debitCredits({
      userId: auth.user_id,
      amount: started * costPer,
      kind: "video",
      refType: "video_images",
      refId: id,
      note: `Imagens de ${started} cena(s)`,
    });
  }

  await admin.from("video_projects").update({ status: "images" }).eq("id", id).eq("user_id", auth.user_id);

  const fresh = await listScenes(id);
  return jsonOk({ scenes: await withUrls(fresh), started, blocked });
}
