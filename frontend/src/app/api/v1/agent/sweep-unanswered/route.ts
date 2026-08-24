/**
 * POST /api/v1/agent/sweep-unanswered — a Carol retoma mensagem que ficou sem
 * resposta (deploy/queda/erro no meio do processamento). Cron no Hetzner a
 * cada 5 min com x-agent-token, mesmo padrão do mail-sweep.
 * Ver lib/agent/retomar.ts (caso Pati, 24/08).
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { retomarSemResposta } from "@/lib/agent/retomar";

export const maxDuration = 300; // até 10 respostas humanizadas com LLM

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  const summary = await retomarSemResposta();
  if (summary.candidatas > 0) console.log("[agent/sweep-unanswered]", JSON.stringify(summary));
  return jsonOk({ sweep: summary });
}
