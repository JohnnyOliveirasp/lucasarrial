/**
 * POST /api/v1/agent/night-watch — a espinha do vigia noturno.
 *
 * Cron do Hetzner chama às 04:00 BRT com x-agent-token (AGENT_MONITOR_TOKEN),
 * mesmo padrão do sweep-clones. A rodada itera os detectores registrados em
 * lib/night-watch/registry.ts, isola exceções, aplica teto por tabela e
 * devolve o relatório SEMPRE — mesmo com zero achado.
 *
 * ⚠️ DRY-RUN É O PADRÃO: sem parâmetro, a rodada não escreve nada (nem
 * histórico) e relata o que FARIA. Modo real só com ?live=1 explícito —
 * proteção deliberada até a espinha se provar correta em produção (a
 * calibração do cron muda pra ?live=1 quando aprovada).
 */
import type { NextRequest } from "next/server";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { runNightWatch } from "@/lib/night-watch/run";
import { deliverReport } from "@/lib/night-watch/report";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // varredura de madrugada pode passar dos 60s padrão

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return unauthorized();
  try {
    const live = request.nextUrl.searchParams.get("live") === "1";
    const result = await runNightWatch({ dryRun: !live });

    // E-mail é redundância best-effort (só live); o relatório sai na resposta
    // de qualquer jeito — rodada muda é o bug que estamos consertando.
    let reportEmailed = false;
    if (result.status === "done") reportEmailed = await deliverReport(result);

    console.log(
      "[night-watch]",
      JSON.stringify({
        status: result.status,
        dry_run: result.dryRun,
        detectors: result.detectors.length,
        found: result.findings.length,
        emailed: reportEmailed,
      }),
    );
    return jsonOk({ ...result, reportEmailed });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "night-watch failed");
  }
}
