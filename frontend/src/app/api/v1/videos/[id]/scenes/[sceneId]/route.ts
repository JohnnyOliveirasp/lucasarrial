/**
 * /api/v1/videos/[id]/scenes/[sceneId]
 *   PATCH  → edita o prompt da cena à mão { prompt_pt }. GRÁTIS.
 *   DELETE → apaga UMA cena (linha + imagem/clipe no R2). GRÁTIS, sem estorno.
 *
 * A lixeira por cena não existia até 27/08 (#158): a Fast disse a uma aluna
 * pra "apagar as cenas que não quer na lixeirinha" e garantiu que ela não
 * perderia nada — a única lixeira era a do PROJETO (videos/route.ts DELETE),
 * e ela apagou um projeto inteiro. Agora existe a lixeira que o bot inventou.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { deleteKeys } from "@/lib/r2/delete";

const PROMPT_MAX = 2000;

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id, sceneId } = await ctx.params;

  let body: { prompt_pt?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  if (typeof body.prompt_pt !== "string") return badRequest("Prompt inválido");
  const prompt = body.prompt_pt.trim().slice(0, PROMPT_MAX);
  if (!prompt) return badRequest("O prompt não pode ficar vazio");

  const admin = getAdmin();
  const { data: row, error } = await admin
    .from("video_scenes")
    .update({ prompt_pt: prompt })
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .select("id, idx, prompt_pt")
    .maybeSingle();

  if (error) return serverError("Falha ao salvar a cena");
  if (!row) return notFound("Scene");

  return jsonOk({ scene: row });
}

type SceneRow = {
  id: string;
  idx: number;
  image_path: string | null;
  video_path: string | null;
  image_status: string | null;
  video_status: string | null;
};

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id, sceneId } = await ctx.params;
  const admin = getAdmin();

  // Ownership pelo triplo .eq (o admin client ignora RLS) — padrão do PATCH.
  const { data: project } = await admin
    .from("video_projects")
    .select("id, status, scene_count")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!project) return notFound("Project");
  const proj = project as { status: string; scene_count: number | null };

  // Não apaga debaixo do render: o worker (render/worker.mjs) lê as cenas no
  // começo e concatena por idx — sumir uma no meio dá clipe fantasma no ffmpeg.
  if (proj.status === "rendering") {
    return jsonError("busy", "O vídeo está sendo montado. Espere terminar para apagar cenas.", 409);
  }

  const { data: sceneRaw } = await admin
    .from("video_scenes")
    .select("id, idx, image_path, video_path, image_status, video_status")
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!sceneRaw) return notFound("Scene");
  const scene = sceneRaw as SceneRow;

  // Cena com geração em voo: o job do Kie vai voltar e gravar numa linha que
  // não existe mais (e o crédito já foi debitado). Apaga depois que terminar.
  const emVoo = new Set(["pending", "generating"]);
  if (emVoo.has(scene.image_status ?? "") || emVoo.has(scene.video_status ?? "")) {
    return jsonError("busy", "Esta cena ainda está sendo gerada. Espere terminar para apagar.", 409);
  }

  // Última cena: apagar deixaria um projeto sem nada pra montar. Quem quer
  // isso apaga o projeto (lixeira do card), que é explícito sobre o que faz.
  const { count } = await admin
    .from("video_scenes")
    .select("id", { count: "exact", head: true })
    .eq("video_project_id", id);
  if ((count ?? 0) <= 1) {
    return jsonError("last_scene", "Esta é a única cena do projeto. Para remover tudo, apague o projeto.", 409);
  }

  // R2 primeiro (padrão de images/route.ts): se falhar, a linha fica e o
  // aluno tenta de novo — nunca linha apagada com arquivo órfão cobrando espaço.
  try {
    await deleteKeys(imagesBucket(), [scene.image_path, scene.video_path]);
  } catch (e) {
    console.error("[videos/scenes] R2 delete falhou:", e instanceof Error ? e.message : e);
    return serverError("Falha ao apagar os arquivos da cena");
  }

  const { data: deleted, error: delErr } = await admin
    .from("video_scenes")
    .delete()
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .select("id")
    .maybeSingle();
  if (delErr) return serverError("Falha ao apagar a cena");
  if (!deleted) return notFound("Scene");

  // scene_count é o gate dos estágios Imagens/Vídeos no wizard e a meta
  // "N cenas" do board — precisa acompanhar a tabela.
  const restantes = Math.max(0, (count ?? 1) - 1);
  await admin.from("video_projects").update({ scene_count: restantes }).eq("id", id);

  return jsonOk({ deleted: scene.id, idx: scene.idx, scene_count: restantes });
}
