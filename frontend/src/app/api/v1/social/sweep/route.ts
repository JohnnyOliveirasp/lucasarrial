/**
 * POST /api/v1/social/sweep — varredura do publicador (cron do Hetzner,
 * mesmo padrão do mail-sweep: x-agent-token a cada 1-5min). Dispara os
 * agendados que chegaram na hora, avança containers em voo no Instagram
 * e renova tokens vencendo em <10 dias.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { sweepPublications } from "@/lib/social/publisher";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  const summary = await sweepPublications();
  if (summary.started + summary.advanced + summary.refreshed > 0) {
    console.log("[social/sweep]", JSON.stringify(summary));
  }
  return jsonOk({ sweep: summary });
}
