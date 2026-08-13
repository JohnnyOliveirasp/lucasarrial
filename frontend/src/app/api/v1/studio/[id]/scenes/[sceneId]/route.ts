/**
 * POST /api/v1/studio/[id]/scenes/[sceneId] — ações de UMA cena (C2, 13/08).
 *
 * Body (uma ação por chamada):
 *   { action: "improve" }                → LLM melhora o prompt (1 cr, só
 *                                          devolve o texto — nada é gerado).
 *   { action: "redo", prompt_en? }       → REGERA a cena com o prompt dado
 *                                          (ou o original). Cria cena NOVA
 *                                          (não muta cena compartilhada/banco)
 *                                          e troca o ponteiro no scene_plan
 *                                          DESTE projeto. Cobra 1 cena.
 *   { action: "photo", photo_key }       → substitui a cena por uma FOTO do
 *                                          usuário (upload-url) animada.
 *                                          Cobra 1 cena.
 *
 * redo/photo invalidam a montagem (montage_status volta a idle — o botão
 * Montar reaparece quando as cenas ficarem prontas).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { bypassesBilling } from "@/lib/credits/access";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";
import { IMPROVE_PROMPT_COST } from "@/lib/video/config";
import { improveScenePrompt } from "@/lib/video/improve-scene-prompt";
import { startSceneStill, startSceneAnimateFromImage } from "@/lib/studio/scenes";
import { objectExists } from "@/lib/r2/exists";
import { imagesBucket } from "@/lib/r2/client";
import type { StudioScenePlanItem, StudioSceneRow } from "@/lib/db/types";

type Ctx = { params: Promise<{ id: string; sceneId: string }> };

const MAX_PROMPT_CHARS = 1200;

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);
  const { id, sceneId } = await ctx.params;

  // keep_person (13/08): cena COM a pessoa pode regerar de 2 jeitos —
  // true (padrão) = mesmas fotos; false = vira b-roll SEM a pessoa (o prompt
  // é convertido pra versão sem rosto quando o usuário não editou o dele).
  let body: { action?: unknown; prompt_en?: unknown; photo_key?: unknown; keep_person?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const keepPerson = body.keep_person !== false;
  const action = body.action;
  if (action !== "improve" && action !== "redo" && action !== "photo") {
    return badRequest("Ação inválida");
  }

  const admin = getAdmin();
  const { data: project, error } = await admin
    .from("studio_projects")
    .select("id, scenes_status, scene_plan, montage_status")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (error) return serverError("Failed to load studio project");
  if (!project) return notFound("Studio project");

  const plan = (project.scene_plan ?? []) as StudioScenePlanItem[];
  const entries = plan.filter((p) => p.scene_id === sceneId);
  if (entries.length === 0) return notFound("Scene");

  const { data: orig } = await admin
    .from("studio_scenes")
    .select("id, concept, prompt_en, dialect, ref_image_paths")
    .eq("id", sceneId)
    .maybeSingle();
  if (!orig) return notFound("Scene");
  const origRow = orig as Pick<StudioSceneRow, "id" | "concept" | "prompt_en" | "dialect" | "ref_image_paths">;
  const origRefs = (origRow.ref_image_paths ?? []).filter(Boolean);

  // ── improve: LLM reescreve o prompt (1 cr, cobra só se der certo) ──
  if (action === "improve") {
    let improved: string;
    try {
      const contexto = entries.map((e) => e.text).join(" ").slice(0, 600);
      improved = await improveScenePrompt(origRow.prompt_en, contexto, "en");
    } catch (e) {
      return serverError(e instanceof Error ? e.message : "Falha ao melhorar o prompt");
    }
    if (!bypassesBilling(auth.email)) {
      const debit = await debitCredits({
        userId: auth.user_id,
        amount: IMPROVE_PROMPT_COST,
        kind: "video",
        refType: "studio_scene_improve",
        refId: sceneId,
        note: "Vídeo Estúdio — melhorar prompt de cena",
      });
      if (!debit.ok) {
        return jsonError("insufficient_credits", "Saldo insuficiente.", 402, {
          balance: debit.balance,
          cost: IMPROVE_PROMPT_COST,
        });
      }
    }
    return jsonOk({ prompt: improved });
  }

  // redo/photo mexem na geração — nunca no meio de uma geração em andamento.
  if (project.scenes_status === "generating") {
    return badRequest("As cenas ainda estão sendo geradas — espere terminar.");
  }

  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: STUDIO_SCENE_COST,
    action: action === "photo" ? "usar sua foto na cena" : "regerar a cena",
  });
  if (!gate.ok) return gate.deny;

  let photoKey: string | null = null;
  if (action === "photo") {
    photoKey = typeof body.photo_key === "string" ? body.photo_key.trim() : "";
    if (!photoKey.startsWith(`${auth.user_id}/`)) return badRequest("Foto inválida.");
    if (!(await objectExists(imagesBucket(), photoKey))) return notFound("Foto");
  }

  const promptDado =
    action === "redo" && typeof body.prompt_en === "string" && body.prompt_en.trim()
      ? body.prompt_en.trim().slice(0, MAX_PROMPT_CHARS)
      : null;

  // Regerar SEM a pessoa numa cena que tinha foto: o prompt original descreve
  // "the person from the reference photo" — sem conversão, o modelo inventaria
  // um rosto genérico. A LLM (variante EN, que já exige b-roll sem rostos)
  // reescreve pra mesma cena SEM a pessoa. Prompt editado pelo usuário vale
  // como está.
  const virandoBroll = action === "redo" && !keepPerson && origRefs.length > 0;
  let prompt = promptDado ?? origRow.prompt_en;
  if (virandoBroll && !promptDado) {
    try {
      const contexto = entries.map((e) => e.text).join(" ").slice(0, 600);
      prompt = await improveScenePrompt(origRow.prompt_en, contexto, "en");
    } catch {
      /* conversão falhou — segue com o prompt original (moderação/QA cobrem) */
    }
  }

  // Mantém as fotos quando é redo COM a pessoa (mesmas referências) ou photo.
  const manterRefs = action === "redo" && keepPerson && origRefs.length > 0;
  const conceptBase = origRow.concept.replace(/ \((com você|minha foto)\)$/, "");

  // Cena NOVA (a original pode ser do banco/compartilhada — não se muta).
  const { data: created, error: insErr } = await admin
    .from("studio_scenes")
    .insert({
      user_id: auth.user_id,
      concept:
        action === "photo"
          ? `${conceptBase} (minha foto)`
          : manterRefs
            ? `${conceptBase} (com você)`
            : conceptBase,
      prompt_en: prompt,
      dialect: origRow.dialect,
      // C3: cena com FOTO da pessoa NUNCA vai pro banco global; b-roll
      // regerado (sem rosto) entra automático como as demais.
      shared: action !== "photo" && !manterRefs,
      ref_image_paths: manterRefs ? origRefs : null,
    } as never)
    .select("id, prompt_en, dialect, ref_image_paths")
    .single();
  if (insErr || !created) return serverError("Falha ao criar a cena.");
  const row = created as Pick<StudioSceneRow, "id" | "prompt_en" | "dialect" | "ref_image_paths">;

  const taskId =
    action === "photo"
      ? await startSceneAnimateFromImage(row.id, photoKey as string)
      : await startSceneStill(row);
  if (taskId) {
    await admin.from("studio_scenes").update({ debit_ref: taskId } as never).eq("id", row.id);
    if (gate.billed) {
      await debitCredits({
        userId: auth.user_id,
        amount: STUDIO_SCENE_COST,
        kind: "video",
        refType: "studio_scene",
        refId: taskId,
        note: `Vídeo Estúdio — ${action === "photo" ? "cena com foto própria" : "regerar cena"} (projeto ${id})`,
      });
    }
  }

  // Troca o ponteiro só NESTE projeto + reabre geração e montagem.
  const newPlan = plan.map((p) =>
    p.scene_id === sceneId ? { ...p, scene_id: row.id, reused: false } : p,
  );
  await admin
    .from("studio_projects")
    .update({
      scene_plan: newPlan,
      scenes_status: "generating",
      ...(project.montage_status === "ready" ? { montage_status: "idle" } : {}),
    } as never)
    .eq("id", id);

  return jsonOk({ scene_id: row.id, status: "generating" }, 201);
}
