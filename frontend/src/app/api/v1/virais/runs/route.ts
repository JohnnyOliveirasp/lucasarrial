/**
 * GET  /api/v1/virais/runs      — as buscas que o Johnny rodou no Apify.
 * POST /api/v1/virais/runs      — importa os vídeos de uma delas pro acervo.
 *
 * A plataforma NÃO dispara busca (decisão 14/08): quem roda é ele, no console
 * do Apify. Aqui só lemos o resultado.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { apifyToken, itensDoRun, listarRuns } from "@/lib/virais/apify";
import { importarVideos } from "@/lib/virais/acervo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function traduzir(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "sem_token") return "Falta a chave do Apify no servidor (API_Token).";
  if (m === "token_invalido") return "O Apify recusou a chave — confira o token.";
  if (m.startsWith("apify_http_")) return `O Apify respondeu ${m.replace("apify_http_", "")}.`;
  return "Não consegui falar com o Apify agora.";
}

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  if (!apifyToken()) {
    return jsonOk({ runs: [], aviso: "Falta a chave do Apify no servidor (API_Token)." });
  }
  try {
    return jsonOk({ runs: await listarRuns(10), aviso: null });
  } catch (e) {
    console.error("[virais/runs]", e instanceof Error ? e.message : e);
    return jsonOk({ runs: [], aviso: traduzir(e) });
  }
}

export async function POST(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { dataset_id?: unknown; run_id?: unknown; termo?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Corpo inválido");
  }
  const datasetId = typeof body.dataset_id === "string" ? body.dataset_id.trim() : "";
  if (!datasetId) return badRequest("Diga qual busca importar.");
  const runId = typeof body.run_id === "string" ? body.run_id.trim() : null;
  const termo = typeof body.termo === "string" ? body.termo.trim().slice(0, 80) || null : null;

  try {
    const videos = await itensDoRun(datasetId, 1000);
    if (videos.length === 0) {
      return jsonOk({ gravados: 0, encontrados: 0, aviso: "Essa busca não trouxe vídeo nenhum." });
    }
    const { gravados, erro } = await importarVideos(getAdmin(), videos, { termo, runId });
    if (erro) {
      console.error("[virais/importar]", erro);
      return serverError("Falha ao gravar os vídeos.");
    }
    return jsonOk({ gravados, encontrados: videos.length, aviso: null });
  } catch (e) {
    console.error("[virais/importar]", e instanceof Error ? e.message : e);
    return serverError(traduzir(e));
  }
}
