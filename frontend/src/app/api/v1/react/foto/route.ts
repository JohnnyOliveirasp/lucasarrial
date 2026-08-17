/**
 * POST /api/v1/react/foto — prepara a foto do avatar pro React.
 *
 * Reenquadra pra meio corpo pra cima e troca o fundo por verde, que é o que
 * permite recortar a pessoa por cima do viral. O aluno não precisa saber
 * disso: ele escolhe a foto dele e a plataforma cuida do resto (decisão do
 * Johnny 14/08 — "no final nós vamos fazer tudo automático").
 *
 * COBRADO (correção Johnny 17/08): mesmo preço de gerar uma imagem na
 * resolução usada (2K = 960 cr). Débito no POST após o Kie aceitar a task;
 * se o GET vir a task falhar, estorna 1x (idempotente por contagem, via
 * handleTechFailure — sem e-mail: falha de foto não é pager).
 *
 * GET ?task= devolve o andamento (o Kie é assíncrono).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { kieGetTask } from "@/lib/kie/client";
import { imageCreditCost } from "@/lib/kie/config";
import { prepararFotoVerde, FOTO_REACT_RESOLUTION } from "@/lib/react/foto";
import { bypassesBilling } from "@/lib/credits/access";
import { debitCredits, getBalance } from "@/lib/credits/service";
import { handleTechFailure } from "@/lib/support/failure-alert";

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
    const { taskId } = await prepararFotoVerde(imageUrl);
    // Debita depois do Kie aceitar a task (mesma ordem das outras cobranças).
    if (billed) {
      await debitCredits({
        userId: gate.auth.user_id,
        amount: custo,
        kind: "image",
        refType: "react_foto",
        refId: taskId,
        note: `foto pronta pro React (${FOTO_REACT_RESOLUTION})`,
      });
    }
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
    // Task falhou → estorna o débito do POST. Idempotente por contagem
    // (poll repetido não devolve 2x); sem e-mail — falha de foto não é pager.
    if (info.state === "fail") {
      await handleTechFailure({
        feature: "Foto do React",
        userId: gate.auth.user_id,
        refId: task,
        rawError: info.failMsg ?? "Kie fail",
        debitRefType: "react_foto",
        refundRefType: "react_foto_refund",
        alertSupport: false,
      });
    }
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
