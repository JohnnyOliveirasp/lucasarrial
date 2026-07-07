/**
 * POST /api/v1/videos/[id]/script-wand — Vídeo Vendas TikTok
 * Varinha ✨: a IA MELHORA o roteiro atual (pode ter sido editado na mão).
 * 15cr, cobra só no sucesso.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { improveSalesScript } from "@/lib/llm/sales-copy";
import { loadSalesProject, gateSalesAI, chargeSalesAI } from "@/lib/video/sales";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const project = await loadSalesProject(id, auth.user_id);
  if (!project) return notFound("Video project");
  if (!project.script_text?.trim()) {
    return badRequest("Gere o roteiro antes de usar a varinha.");
  }
  if (project.status !== "draft") {
    return badRequest("O roteiro só pode ser alterado antes de gerar o áudio.");
  }

  const { billed, deny } = await gateSalesAI(auth);
  if (deny) return deny;

  try {
    const script = await improveSalesScript(project.script_text, project.product_analysis);

    const { error } = await getAdmin()
      .from("video_projects")
      .update({ script_text: script })
      .eq("id", id)
      .eq("user_id", auth.user_id);
    if (error) return serverError("Falha ao salvar o roteiro");

    if (billed) await chargeSalesAI(auth.user_id, id, "varinha do roteiro (vendas)");

    return jsonOk({ script });
  } catch {
    return serverError("A varinha falhou. Nada foi cobrado — tente novamente.");
  }
}
