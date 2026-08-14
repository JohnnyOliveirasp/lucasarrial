/**
 * POST /api/v1/virais/buscar — o botão "Buscar virais" da tela.
 *
 * Dispara a busca no Apify (actor apidojo/tiktok-scraper) com o nicho, o
 * período e o teto de vídeos, e devolve o id da execução. NÃO espera acabar:
 * uma busca de centenas de vídeos leva minutos. A tela pergunta o status em
 * GET /api/v1/virais/buscar?run=<id> e, quando termina, importa sozinha.
 *
 * Custo: US$0,30 por 1.000 vídeos — por isso o teto é escolhido na tela e
 * limitado aqui no servidor.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  dispararBusca,
  itensDoRun,
  PERIODOS,
  verRun,
  type Periodo,
} from "@/lib/virais/apify";
import { importarVideos } from "@/lib/virais/acervo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_ITENS = 500; // teto de segurança: ~US$0,15 por busca

function traduzir(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "sem_token") return "Falta a chave do Apify no servidor (API_Token).";
  if (m === "token_invalido") return "O Apify recusou a chave — confira o token.";
  if (m === "apify_sem_run" || m === "apify_run_sumiu")
    return "O Apify não devolveu a execução.";
  if (m.startsWith("apify_http_"))
    return `O Apify respondeu ${m.replace("apify_http_", "")}.`;
  return "Não consegui falar com o Apify agora.";
}

export async function POST(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Corpo inválido");
  }

  const nicho = typeof body.nicho === "string" ? body.nicho.trim().slice(0, 80) : "";
  if (!nicho) return badRequest("Diga o nicho que você quer buscar.");

  const periodoPedido = typeof body.periodo === "string" ? body.periodo : "";
  const periodo = (PERIODOS.some((p) => p.id === periodoPedido)
    ? periodoPedido
    : "LAST_THREE_MONTHS") as Periodo;

  const pedido = Number.parseInt(String(body.max_itens ?? ""), 10);
  const maxItems = Number.isFinite(pedido)
    ? Math.min(MAX_ITENS, Math.max(10, pedido))
    : 100;

  const pais = typeof body.pais === "string" ? body.pais.trim().toUpperCase().slice(0, 2) : "";

  try {
    const run = await dispararBusca({ nicho, periodo, maxItems, pais });
    return jsonOk({ run, nicho, custo_estimado_usd: +(maxItems * 0.0003).toFixed(2) });
  } catch (e) {
    console.error("[virais/buscar]", e instanceof Error ? e.message : e);
    return serverError(traduzir(e));
  }
}

/**
 * GET ?run=<id> — status da busca. Quando o Apify termina, já IMPORTA os
 * vídeos pro acervo e diz quantos entraram (a tela não precisa de 2 chamadas).
 */
export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  const runId = (request.nextUrl.searchParams.get("run") ?? "").trim();
  if (!runId) return badRequest("Faltou o id da busca.");
  const termo = (request.nextUrl.searchParams.get("termo") ?? "").trim().slice(0, 80) || null;

  try {
    const run = await verRun(runId);
    if (run.status !== "SUCCEEDED") {
      return jsonOk({ run, terminou: false, gravados: 0 });
    }
    if (!run.dataset_id) {
      return jsonOk({ run, terminou: true, gravados: 0, aviso: "A busca não gerou resultado." });
    }
    const videos = await itensDoRun(run.dataset_id, 1000);
    const { gravados, erro } = await importarVideos(getAdmin(), videos, {
      termo,
      runId: run.id,
    });
    if (erro) {
      console.error("[virais/buscar/importar]", erro);
      return serverError("Achei os vídeos mas falhei ao gravar.");
    }
    return jsonOk({ run, terminou: true, gravados, encontrados: videos.length });
  } catch (e) {
    console.error("[virais/buscar/status]", e instanceof Error ? e.message : e);
    return serverError(traduzir(e));
  }
}
