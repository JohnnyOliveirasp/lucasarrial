/**
 * GET /api/v1/agent/health-report — visão de saúde da plataforma pro agente
 * de monitoramento (rotina agendada, modelo Fable). Token dedicado
 * (AGENT_MONITOR_TOKEN) no header x-agent-token — NÃO é sessão de usuário.
 * Sincroniza falhas→incidentes antes de responder (lazy).
 */
import type { NextRequest } from "next/server";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { syncIncidentsFromFailures } from "@/lib/incidents/ingest";
import { motivoFechamentoExibicao } from "@/lib/incidents/motivo-fechamento";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!agentTokenOk(request)) return unauthorized();
  try {
    await syncIncidentsFromFailures();
    const admin = getAdmin();
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

    const [openQ, fixedQ, stateQ, trainingQ, occ24Q] = await Promise.all([
      admin
        .from("incidents" as never)
        .select("*")
        .in("status", ["open", "investigating", "fixing"])
        .order("last_seen_at", { ascending: false })
        .limit(50),
      admin
        .from("incidents" as never)
        // agent_notes entra SÓ pra derivar o motivo de exibição (#560) — não
        // sai no payload (ver o map abaixo).
        .select("id, title, kind, cause, status, resolved_at, resolution_note, resolved_commit, agent_notes")
        .eq("status", "fixed")
        .gte("resolved_at", since7d)
        .order("resolved_at", { ascending: false })
        .limit(20),
      admin.from("agent_state" as never).select("key, value, updated_at"),
      admin
        .from("voices")
        .select("id, created_at")
        .eq("status", "training")
        .order("created_at", { ascending: true }),
      admin
        .from("incident_occurrences" as never)
        .select("incident_id", { count: "exact", head: true })
        .gte("at", since24h),
    ]);

    // #560: cartão fechado sem resolution_note não sai mais "em branco" pro
    // agente de monitoramento — `resolution_note_exibicao` traz o motivo real
    // quando existe, senão a última anotação ROTULADA ("Sem motivo registrado
    // no fechamento. Última anotação (...): ..."), senão null. O rótulo é
    // obrigatório: a última nota pode ser uma OBJEÇÃO ao fechamento, e sem
    // rótulo ela viraria "o motivo". `resolution_note` segue CRU (o que está
    // no banco); é conserto de exibição, zero escrita no banco.
    type LinhaFechada = {
      resolution_note?: string | null;
      agent_notes?: unknown;
      [k: string]: unknown;
    };
    const fixed7d = ((fixedQ.data ?? []) as LinhaFechada[]).map(({ agent_notes, ...resto }) => ({
      ...resto,
      resolution_note_exibicao: motivoFechamentoExibicao(resto.resolution_note, agent_notes),
    }));

    return jsonOk({
      now: new Date().toISOString(),
      incidents_open: openQ.data ?? [],
      incidents_fixed_7d: fixed7d,
      occurrences_24h: occ24Q.count ?? 0,
      trainings_in_progress: ((trainingQ.data ?? []) as Array<{ id: string; created_at: string }>).map(
        (v) => ({ voice_id: v.id, started_at: v.created_at }),
      ),
      agent_state: stateQ.data ?? [],
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "health-report failed");
  }
}
