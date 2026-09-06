/**
 * POST /api/v1/agent/orphan-invites — convite pra compra órfã (comprou,
 * nunca criou conta → e-mail ensinando a ativar; créditos já esperam).
 * Cron diário no Hetzner com x-agent-token, padrão dos outros sweeps.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { sweepOrphanPurchases } from "@/lib/payments/orphan-outreach";
import { sweepVinculosQuebrados } from "@/lib/payments/vinculo-quebrado-canal";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  let summary;
  try {
    summary = await sweepOrphanPurchases();
  } catch (e) {
    // A varredura agora ABORTA se uma consulta-guarda falhar (incidente
    // 72a4c9db): melhor rodada perdida que convite errado pra cliente ativo.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[orphan-invites] varredura abortada:", msg);
    return jsonError("sweep_failed", msg, 500);
  }
  if (summary.invited + summary.reminded + summary.errors > 0) {
    console.log("[orphan-invites]", JSON.stringify(summary));
  }

  // A OUTRA metade do mesmo problema (medida em 06/09): quem TEM conta e mesmo
  // assim continua órfão. A varredura de cima pula essa gente de propósito
  // ("claim do login resolve"), e é justamente ela que fica pagando sem receber
  // — 8 casos, o mais antigo com 24 dias de compra, nenhum visto por ninguém.
  // Roda DEPOIS e em try próprio: falhar aqui não pode derrubar o convite, que
  // já funciona.
  let vinculo = null;
  try {
    vinculo = await sweepVinculosQuebrados();
    if (vinculo.quebrados > 0) console.log("[vinculo-quebrado]", JSON.stringify(vinculo));
  } catch (e) {
    console.error("[vinculo-quebrado] varredura falhou:", e instanceof Error ? e.message : e);
  }

  return jsonOk({ sweep: summary, vinculo });
}
