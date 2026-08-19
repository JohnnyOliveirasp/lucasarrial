/**
 * POST /api/v1/videos/[id]/analyze — Vídeo Vendas TikTok
 * IA (Sonnet visão) analisa as fotos do PRODUTO + a foto da PESSOA e grava
 * `product_analysis` (base do roteiro). Custa 15cr — cobra SÓ no sucesso.
 * Rodar de novo = nova análise = cobra de novo.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { analyzeProductAndPerson } from "@/lib/llm/sales-copy";
import { loadSalesProject, gateSalesAI, chargeSalesAI } from "@/lib/video/sales";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const project = await loadSalesProject(id, auth.user_id);
  if (!project) return notFound("Video project");

  const productKeys = project.product_image_paths ?? [];
  if (productKeys.length === 0) {
    return badRequest("Envie as fotos do produto antes da análise.");
  }
  // 18/08: "quem apresenta" virou OPCIONAL (ordem do Johnny — o único passo
  // obrigatório é o produto). Sem foto de pessoa a análise olha só o produto:
  // `analyzeProductAndPerson` já aceita `personUrl` nulo, e as cenas mais à
  // frente saem sem pessoa. A trava antiga barrava vídeo de produto puro.

  const { billed, deny } = await gateSalesAI(auth);
  if (deny) return deny;

  try {
    const bucket = imagesBucket();
    const productUrls = await Promise.all(
      productKeys.slice(0, 4).map((k) => createPresignedGet(bucket, k, 600)),
    );
    const personKey = (project.reference_image_paths ?? [])[0] ?? null;
    const personUrl = personKey ? await createPresignedGet(bucket, personKey, 600) : null;

    const analysis = await analyzeProductAndPerson(productUrls, personUrl, {
      price: project.product_price,
      link: project.product_link,
      description: project.product_description,
    });

    const { error } = await getAdmin()
      .from("video_projects")
      .update({ product_analysis: analysis })
      .eq("id", id)
      .eq("user_id", auth.user_id);
    if (error) return serverError("Falha ao salvar a análise");

    if (billed) await chargeSalesAI(auth.user_id, id, "análise produto+pessoa (vendas)");

    return jsonOk({ analysis });
  } catch {
    return serverError("A análise falhou. Nada foi cobrado — tente novamente.");
  }
}
