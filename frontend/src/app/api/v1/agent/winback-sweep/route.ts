/**
 * POST /api/v1/agent/winback-sweep — Resgate da Fast (win-back).
 * Cron no Hetzner chama de minuto em minuto com x-agent-token
 * (AGENT_MONITOR_TOKEN), mesmo padrão do mail-sweep. Quase sempre a resposta é
 * "ainda não é hora": quem decide se fala com mais alguém é o disparador, que
 * respeita a escada de aquecimento, a janela comercial e o intervalo aleatório.
 *
 * ?sync=1 (ou body {sync:true}) sincroniza a fila com os cancelamentos novos
 * antes de rodar — barato, roda uma vez por hora pelo cron.
 * Nada sai enquanto winback_settings.enabled for false.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { runWinbackSweep } from "@/lib/winback/dispatch";
import { syncWinbackTargets } from "@/lib/winback/targets";

export const maxDuration = 120; // LLM + digitação humana levam alguns segundos

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);

  const sync = request.nextUrl.searchParams.get("sync") === "1";
  const fila = sync ? await syncWinbackTargets() : null;

  const resultado = await runWinbackSweep();
  // Só loga o que interessa (o "ainda não é hora" roda o dia inteiro).
  if (resultado.acao !== "aguardando_intervalo" && resultado.acao !== "desligado") {
    console.log("[winback]", JSON.stringify({ ...resultado, fila }));
  }
  return jsonOk({ winback: resultado, fila });
}
