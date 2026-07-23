/**
 * POST /api/v1/studio/[id]/scenes — Vídeo Estúdio F3: planeja e dispara as
 * cenas de b-roll do roteiro FALADO (1 por frase), reusando o banco pessoal.
 * O GET /studio/[id] sincroniza cada cena (still → anima → R2) até 'ready'.
 * F5: cobra STUDIO_SCENE_COST por cena NOVA despachada (reuso do banco é
 * grátis); débito por cena (ref = taskId do Kie) com estorno automático em
 * falha (failScene). Retry re-cobra só as cenas re-despachadas.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";
import { planScenes, sentencesFromWords, type BankScene } from "@/lib/studio/scene-planner";
import { startSceneStill } from "@/lib/studio/scenes";
import { handleTechFailure } from "@/lib/support/failure-alert";
import type { StudioScenePlanItem, StudioSceneRow, StudioTranscriptWord } from "@/lib/db/types";

/** Despachou → grava a referência do débito e cobra (quem paga). */
async function chargeDispatchedScene(args: {
  userId: string;
  projectId: string;
  sceneId: string;
  taskId: string;
  billed: boolean;
}): Promise<void> {
  await getAdmin()
    .from("studio_scenes")
    .update({ debit_ref: args.taskId } as never)
    .eq("id", args.sceneId);
  if (!args.billed) return;
  await debitCredits({
    userId: args.userId,
    amount: STUDIO_SCENE_COST,
    kind: "video",
    refType: "studio_scene",
    refId: args.taskId,
    note: `Vídeo Estúdio — cena de b-roll (projeto ${args.projectId})`,
  });
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const { id } = await ctx.params;

  const admin = getAdmin();
  const { data: project, error } = await admin
    .from("studio_projects")
    .select("id, status, scenes_status, scene_plan, transcript_words")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (error) return serverError("Failed to load studio project");
  if (!project) return notFound("Studio project");
  if (project.status !== "audio_ready") return badRequest("O áudio ainda não está pronto.");
  if (project.scenes_status === "generating") return badRequest("As cenas já estão sendo geradas.");

  // Retry: plano já existe → só re-dispara as cenas que falharam (a tentativa
  // anterior foi estornada; a nova é cobrada de novo, cena a cena).
  if (project.scenes_status === "failed" && Array.isArray(project.scene_plan) && project.scene_plan.length > 0) {
    const ids = [...new Set((project.scene_plan as StudioScenePlanItem[]).map((p) => p.scene_id))];
    const { data: failed } = await admin
      .from("studio_scenes")
      .select("id, prompt_en, dialect")
      .in("id", ids)
      .eq("status", "failed");
    const failedRows = (failed ?? []) as Pick<StudioSceneRow, "id" | "prompt_en" | "dialect">[];
    const retryGate = await gateStudioCredits({
      userId: auth.user_id,
      email: auth.email,
      cost: failedRows.length * STUDIO_SCENE_COST,
      action: `refazer ${failedRows.length} cena(s)`,
    });
    if (!retryGate.ok) return retryGate.deny;
    for (const s of failedRows) {
      const taskId = await startSceneStill(s);
      if (taskId) {
        await chargeDispatchedScene({
          userId: auth.user_id, projectId: id, sceneId: s.id, taskId, billed: retryGate.billed,
        });
      }
    }
    await admin.from("studio_projects").update({ scenes_status: "generating" } as never).eq("id", id);
    return jsonOk({ scenes: { status: "generating", retried: failedRows.length } }, 201);
  }

  const words = (project.transcript_words ?? []) as StudioTranscriptWord[];
  const sentences = sentencesFromWords(words);
  if (sentences.length === 0) return badRequest("Este projeto não tem transcrição.");

  // Banco pro planejador reusar: cenas do PRÓPRIO aluno + acervo
  // COMPARTILHADO (F3, mig 49: b-roll curado pelo admin — custo zero).
  const { data: bankRows } = await admin
    .from("studio_scenes")
    .select("id, concept")
    .or(`user_id.eq.${auth.user_id},shared.eq.true`)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(80);
  const bank = (bankRows ?? []) as BankScene[];

  let plan;
  try {
    plan = await planScenes(sentences, bank);
  } catch (e) {
    await handleTechFailure({
      feature: "Vídeo Estúdio (planejador de cenas F3)",
      userId: auth.user_id,
      refId: id,
      rawError: e instanceof Error ? e.message : String(e),
    });
    return serverError("Não consegui planejar as cenas agora. Tente novamente.");
  }

  // Gate F5: cobra só as cenas NOVAS (reuso do banco pessoal é grátis).
  const plannedNew = plan.filter((p) => !p.reuse_id).length;
  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: plannedNew * STUDIO_SCENE_COST,
    action: `gerar ${plannedNew} cena(s) nova(s)`,
  });
  if (!gate.ok) return gate.deny;

  // Cria as cenas novas + monta o mapa frase→cena do projeto.
  const scenePlan: StudioScenePlanItem[] = [];
  let newScenes = 0;
  for (const p of plan) {
    if (p.reuse_id) {
      scenePlan.push({ sentence: p.sentence, text: sentences[p.sentence] ?? "", scene_id: p.reuse_id, reused: true });
      continue;
    }
    const { data: created, error: insErr } = await admin
      .from("studio_scenes")
      .insert({
        user_id: auth.user_id,
        concept: p.concept,
        prompt_en: p.prompt_en,
        dialect: p.dialect,
      } as never)
      .select("id, prompt_en, dialect")
      .single();
    if (insErr || !created) return serverError("Falha ao criar as cenas.");
    const row = created as Pick<StudioSceneRow, "id" | "prompt_en" | "dialect">;
    const taskId = await startSceneStill(row);
    if (taskId) {
      await chargeDispatchedScene({
        userId: auth.user_id, projectId: id, sceneId: row.id, taskId, billed: gate.billed,
      });
    }
    newScenes += 1;
    scenePlan.push({ sentence: p.sentence, text: sentences[p.sentence] ?? "", scene_id: row.id, reused: false });
  }

  await admin
    .from("studio_projects")
    .update({
      scenes_status: newScenes === 0 ? "ready" : "generating",
      scene_plan: scenePlan,
    } as never)
    .eq("id", id);

  return jsonOk(
    { scenes: { status: newScenes === 0 ? "ready" : "generating", total: scenePlan.length, new: newScenes, reused: scenePlan.length - newScenes } },
    201,
  );
}
