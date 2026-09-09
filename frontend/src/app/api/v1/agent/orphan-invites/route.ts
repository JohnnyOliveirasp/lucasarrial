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
  // `revalidados` entra na condição de propósito: a rodada que SÓ descartou
  // candidatos na releitura (a conta apareceu no meio da varredura) é
  // exatamente a que a gente quer ver no log — é o falso positivo que não
  // virou e-mail. Sem ele aqui, esse acerto sumiria em silêncio.
  //
  // `avisosNaFila` entra pelo mesmo motivo, na direção oposta: a rodada que só
  // deixou gente esperando (teto de rajada) é a que MAIS precisa aparecer, ou
  // "avisei 5" se lê como "só existem 5 casos".
  if (
    summary.invited + summary.reminded + summary.errors + summary.revalidados +
      summary.avisosEquipe + summary.avisosNaFila >
    0
  ) {
    console.log("[orphan-invites]", JSON.stringify(summary));
  }
  return jsonOk({ sweep: summary });
}
