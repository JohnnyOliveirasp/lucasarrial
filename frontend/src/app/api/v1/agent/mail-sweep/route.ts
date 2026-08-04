/**
 * POST /api/v1/agent/mail-sweep — Fast responde os e-mails do suporte@.
 * Cron no Hetzner chama a cada 5min com x-agent-token (AGENT_MONITOR_TOKEN),
 * mesmo padrão do sweep-clones. Cada resposta sai pelo SMTP do suporte@ com
 * cópia oculta pros admins; casos de dinheiro só acolhem e escalam.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { sweepSupportMail } from "@/lib/agent/mail-respond";

export const maxDuration = 300; // lote de 8 e-mails com LLM leva minutos

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  const summary = await sweepSupportMail();
  if (summary.scanned > 0) console.log("[agent/mail-sweep]", JSON.stringify(summary));
  return jsonOk({ sweep: summary });
}
