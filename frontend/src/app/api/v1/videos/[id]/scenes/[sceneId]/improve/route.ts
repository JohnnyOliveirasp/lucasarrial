/**
 * /api/v1/videos/[id]/scenes/[sceneId]/improve
 *   POST → a LLM reescreve/melhora o prompt da cena. CUSTA 1 crédito (só cobra
 *          se der certo). Equipe/admin não é cobrada.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonError, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { IMPROVE_PROMPT_COST } from "@/lib/video/config";
import { improveScenePrompt } from "@/lib/video/improve-scene-prompt";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id, sceneId } = await ctx.params;

  const admin = getAdmin();
  const { data: scene } = await admin
    .from("video_scenes")
    .select("id, prompt_pt, script_excerpt")
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!scene) return notFound("Scene");

  const billed = !bypassesBilling(auth.email);

  // Pre-check de saldo (igual ao gerador de imagem).
  if (billed) {
    const { total } = await getBalance(auth.user_id);
    if (total < IMPROVE_PROMPT_COST) {
      const { data: profile } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, profile?.access_until ?? null);
      return jsonError(
        "insufficient_credits",
        `Melhorar o prompt custa ${IMPROVE_PROMPT_COST} crédito.`,
        402,
        { subscribed, balance: total, cost: IMPROVE_PROMPT_COST },
      );
    }
  }

  let improved: string;
  try {
    improved = await improveScenePrompt(scene.prompt_pt, scene.script_excerpt ?? undefined);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao melhorar o prompt");
  }

  // Cobra só depois de a LLM ter dado certo.
  if (billed) {
    const debit = await debitCredits({
      userId: auth.user_id,
      amount: IMPROVE_PROMPT_COST,
      kind: "video",
      refType: "video_scene_improve",
      refId: scene.id,
      note: "Improve prompt de cena",
    });
    if (!debit.ok) {
      return jsonError("insufficient_credits", "Saldo insuficiente.", 402, {
        balance: debit.balance,
        cost: IMPROVE_PROMPT_COST,
      });
    }
  }

  const { data: row, error } = await admin
    .from("video_scenes")
    .update({ prompt_pt: improved })
    .eq("id", sceneId)
    .eq("video_project_id", id)
    .eq("user_id", auth.user_id)
    .select("id, idx, prompt_pt")
    .maybeSingle();
  if (error || !row) return serverError("Falha ao salvar o prompt");

  return jsonOk({ scene: row });
}
