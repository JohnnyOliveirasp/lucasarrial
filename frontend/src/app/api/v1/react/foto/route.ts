/**
 * POST /api/v1/react/foto — prepara a foto do avatar pro React.
 *
 * Reenquadra pra meio corpo pra cima e troca o fundo por verde, que é o que
 * permite recortar a pessoa por cima do viral. O aluno não precisa saber
 * disso: ele escolhe a foto dele e a plataforma cuida do resto (decisão do
 * Johnny 14/08 — "no final nós vamos fazer tudo automático").
 *
 * GET ?task= devolve o andamento (o Kie é assíncrono).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { kieGetTask } from "@/lib/kie/client";
import { prepararFotoVerde } from "@/lib/react/foto";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { image_url?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Corpo inválido");
  }
  const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";
  if (!imageUrl.startsWith("http")) return badRequest("Faltou a foto.");

  try {
    const { taskId } = await prepararFotoVerde(imageUrl);
    return jsonOk({ task_id: taskId });
  } catch (e) {
    console.error("[react/foto]", e instanceof Error ? e.message : e);
    return serverError("Não consegui preparar a foto agora. Tente de novo.");
  }
}

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const task = (request.nextUrl.searchParams.get("task") ?? "").trim();
  if (!task) return badRequest("Faltou o id da tarefa.");

  try {
    const info = await kieGetTask(task);
    return jsonOk({
      estado: info.state,
      url: info.resultUrls?.[0] ?? null,
      erro: info.failMsg ?? null,
    });
  } catch (e) {
    console.error("[react/foto:get]", e instanceof Error ? e.message : e);
    return serverError("Não consegui checar a foto.");
  }
}
