/**
 * PATCH /api/v1/videos/[id]/product — Vídeo Vendas TikTok
 * Salva as fotos do PRODUTO (1-4, keys já no R2 via /api/v1/images/upload-url)
 * + campos opcionais (preço, link, descrição). Só em projetos kind='sales'.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

const MAX_PRODUCT_PHOTOS = 4;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: { keys?: unknown; price?: unknown; link?: unknown; description?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }

  const keys = Array.isArray(body.keys)
    ? [...new Set(body.keys.filter((k): k is string => typeof k === "string" && k.trim() !== ""))]
    : [];
  if (keys.length === 0) return badRequest("Envie ao menos 1 foto do produto.");
  if (keys.length > MAX_PRODUCT_PHOTOS) {
    return badRequest(`Máximo de ${MAX_PRODUCT_PHOTOS} fotos do produto.`);
  }
  if (!keys.every((k) => k.startsWith(`${auth.user_id}/`))) return badRequest("Foto inválida.");

  const price = typeof body.price === "string" ? body.price.trim().slice(0, 60) : "";
  const link = typeof body.link === "string" ? body.link.trim().slice(0, 300) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";
  if (link && !/^https?:\/\/\S+$/i.test(link)) {
    return badRequest("Link inválido — use uma URL completa (https://…).");
  }

  const admin = getAdmin();
  const { data: row, error } = await admin
    .from("video_projects")
    .update({
      product_image_paths: keys,
      product_price: price || null,
      product_link: link || null,
      product_description: description || null,
    })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .eq("kind", "sales")
    .select("id")
    .maybeSingle();

  if (error) return serverError("Falha ao salvar o produto");
  if (!row) return notFound("Video project");

  return jsonOk({ ok: true, count: keys.length });
}
