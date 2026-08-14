/**
 * POST /api/v1/virais/buscar — parte 1 do "Vídeos Virais": acha os virais de
 * um nicho no Instagram e no TikTok, filtrando por likes e recência.
 *
 * Pré-produção: admin-only, sem custo de crédito (só leitura de dados
 * públicos das redes). Quando graduar, trocar gateAdmin por um access.ts
 * como o do Gerador de Roteiros.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { buscarVirais, lerParams } from "@/lib/virais/buscar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Corpo inválido");
  }

  const { params, plataformas } = lerParams(body);
  if (!params.nicho) return badRequest("Diga o nicho que você quer buscar.");

  try {
    const { videos, porPlataforma } = await buscarVirais(params, plataformas);
    return jsonOk({
      nicho: params.nicho,
      min_likes: params.minLikes,
      dias: params.dias,
      total: videos.length,
      videos,
      plataformas: porPlataforma.map((r) => ({
        plataforma: r.plataforma,
        encontrados: r.videos.length,
        varridos: r.varridos,
        indisponivel: r.indisponivel ?? null,
      })),
    });
  } catch (e) {
    console.error("[virais/buscar]", e instanceof Error ? e.message : e);
    return serverError("Falha ao buscar os virais.");
  }
}
