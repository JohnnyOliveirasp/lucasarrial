/**
 * Roteiro do Vídeo Vendas TikTok.
 *   POST  → IA gera (ou REFAZ) o roteiro de venda a partir da análise. 15cr,
 *           cobra só no sucesso; refazer cobra de novo (decisão Johnny).
 *   PATCH → edição MANUAL do texto (grátis) — só em rascunho.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { generateSalesScript } from "@/lib/llm/sales-copy";
import { loadSalesProject, gateSalesAI, chargeSalesAI } from "@/lib/video/sales";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const project = await loadSalesProject(id, auth.user_id);
  if (!project) return notFound("Video project");
  if (!project.product_analysis) {
    return badRequest("Rode a análise do produto antes de gerar o roteiro.");
  }

  const { billed, deny } = await gateSalesAI(auth);
  if (deny) return deny;

  try {
    const script = await generateSalesScript(
      project.product_analysis,
      {
        price: project.product_price,
        link: project.product_link,
        description: project.product_description,
      },
      { previousScript: project.script_text },
    );

    const { error } = await getAdmin()
      .from("video_projects")
      .update({ script_text: script })
      .eq("id", id)
      .eq("user_id", auth.user_id);
    if (error) return serverError("Falha ao salvar o roteiro");

    if (billed) {
      await chargeSalesAI(
        auth.user_id,
        id,
        project.script_text ? "refazer roteiro (vendas)" : "gerar roteiro (vendas)",
      );
    }

    return jsonOk({ script });
  } catch {
    return serverError("A geração do roteiro falhou. Nada foi cobrado — tente novamente.");
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const project = await loadSalesProject(id, auth.user_id);
  if (!project) return notFound("Video project");
  // Depois que o áudio existe (cenas geradas do texto), editar o roteiro
  // dessincronizaria tudo — trava em rascunho.
  if (project.status !== "draft") {
    return badRequest("O roteiro só pode ser editado antes de gerar o áudio.");
  }

  let body: { script?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (!script) return badRequest("O roteiro não pode ficar vazio.");
  if (script.length > 2000) return badRequest("Roteiro longo demais (máx. 2000 caracteres).");

  const { error } = await getAdmin()
    .from("video_projects")
    .update({ script_text: script })
    .eq("id", id)
    .eq("user_id", auth.user_id);
  if (error) return serverError("Falha ao salvar o roteiro");

  return jsonOk({ ok: true });
}
