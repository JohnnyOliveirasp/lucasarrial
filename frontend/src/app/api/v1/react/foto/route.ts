/**
 * POST /api/v1/react/foto — prepara a foto do avatar pro React.
 *
 * Reenquadra pra meio corpo pra cima e troca o fundo por verde, que é o que
 * permite recortar a pessoa por cima do viral. O aluno não precisa saber
 * disso: ele escolhe a foto dele e a plataforma cuida do resto (decisão do
 * Johnny 14/08 — "no final nós vamos fazer tudo automático").
 *
 * COBRADO (correção Johnny 17/08): mesmo preço de gerar uma imagem na
 * resolução usada (2K = 960 cr). Débito no POST após o Kie aceitar a task,
 * no MESMO shape do /images/generate — a foto vira uma row de
 * image_generations (decisão Johnny 17/08: aparece no HISTÓRICO, fica no R2
 * e o estorno de falha sai do pipeline padrão do Kie).
 *
 * GET ?task= devolve o andamento (o Kie é assíncrono). Quando o pipeline já
 * salvou no R2, devolve a URL nossa (a do Kie expira).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { kieGetTask } from "@/lib/kie/client";
import { imageCreditCost } from "@/lib/kie/config";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { prepararFotoVerde, FOTO_REACT_RESOLUTION } from "@/lib/react/foto";
import { bypassesBilling } from "@/lib/credits/access";
import { debitCredits, getBalance } from "@/lib/credits/service";

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

  // Mesmo preço de gerar uma imagem nessa resolução (equipe/admin não paga).
  const custo = imageCreditCost(FOTO_REACT_RESOLUTION);
  const billed = !bypassesBilling(gate.auth.email);
  if (billed) {
    const bal = await getBalance(gate.auth.user_id);
    if (bal.total < custo) {
      return jsonError(
        "insufficient_credits",
        `Créditos insuficientes: preparar a foto custa ${custo} e você tem ${bal.total}.`,
        402,
        { balance: bal.total, cost: custo },
      );
    }
  }

  try {
    const { taskId, generationId } = await prepararFotoVerde(
      getAdmin(),
      gate.auth.user_id,
      imageUrl,
      billed ? custo : 0,
    );
    // Debita depois do Kie aceitar a task, no shape padrão de imagem — o
    // estorno automático do finalize casa com este débito pelo refId.
    if (billed) {
      await debitCredits({
        userId: gate.auth.user_id,
        amount: custo,
        kind: "image",
        refType: "image_generation",
        refId: generationId,
        note: `foto pronta pro React (${FOTO_REACT_RESOLUTION})`,
      });
    }
    return jsonOk({ task_id: taskId, generation_id: generationId });
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
    // O webhook do Kie finaliza a row sozinho (R2 + estorno em falha). Se já
    // finalizou, respondemos com a NOSSA cópia — a URL do Kie expira.
    const { data: row } = await getAdmin()
      .from("image_generations")
      .select("status, image_path, error_message")
      .eq("kie_task_id", task)
      .eq("user_id", gate.auth.user_id)
      .maybeSingle();
    if (row?.status === "ready" && row.image_path) {
      const url = await createPresignedGet(imagesBucket(), row.image_path as string, 24 * 3600);
      return jsonOk({ estado: "success", url, erro: null });
    }
    if (row?.status === "failed") {
      return jsonOk({ estado: "fail", url: null, erro: (row.error_message as string) ?? null });
    }

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
