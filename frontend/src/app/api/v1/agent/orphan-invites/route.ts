/**
 * POST /api/v1/agent/orphan-invites — convite pra compra órfã (comprou,
 * nunca criou conta → e-mail ensinando a ativar; créditos já esperam).
 * Cron diário no Hetzner com x-agent-token, padrão dos outros sweeps.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { sweepOrphanPurchases } from "@/lib/payments/orphan-outreach";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  const summary = await sweepOrphanPurchases();
  if (summary.invited + summary.reminded + summary.errors > 0) {
    console.log("[orphan-invites]", JSON.stringify(summary));
  }
  return jsonOk({ sweep: summary });
}
