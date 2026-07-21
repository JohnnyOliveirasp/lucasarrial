/**
 * Sync de falhas cruas (admin_failures) → incidentes agrupados. Idempotente:
 * cada falha (kind, ref_id) só conta uma vez (incident_occurrences é o gate).
 * Reincidência: falha nova com assinatura de incidente CORRIGIDO → reabre.
 * Server-only. Chamado lazy pelo GET de incidentes (admin) e pelo health-report
 * do agente — quem chegar primeiro sincroniza.
 *
 * Tabelas da mig 47 ainda não estão nos types gerados → casts `as never`
 * (mesmo padrão de help_messages/mig 42).
 */
import { getAdmin } from "@/lib/db/admin";
import { classifyCause, errorSignature, incidentTitle } from "./classify";
import { logger } from "@/lib/logger/server";

type RawFailure = {
  kind: string;
  id: string;
  at: string;
  error: string | null;
  email: string | null;
};

type AgentNote = { at: string; by: string; note: string };

type ExistingIncident = {
  id: string;
  status: string;
  occurrences: number | null;
  affected_emails: string[] | null;
  agent_notes: AgentNote[] | null;
};

export async function syncIncidentsFromFailures(limit = 200): Promise<number> {
  const admin = getAdmin();
  const { data } = await admin.rpc("admin_failures", { p_limit: limit });
  const failures = (data ?? []) as unknown as RawFailure[];
  if (!failures.length) return 0;

  // Falhas já contabilizadas (uma query só)
  const { data: seenRaw } = await admin
    .from("incident_occurrences" as never)
    .select("kind, ref_id")
    .in("ref_id", failures.map((f) => f.id));
  const seen = (seenRaw ?? []) as unknown as Array<{ kind: string; ref_id: string }>;
  const seenSet = new Set(seen.map((s) => `${s.kind}|${s.ref_id}`));

  let created = 0;
  // Ordem cronológica: first_seen/last_seen ficam corretos no replay
  const pending = failures
    .filter((f) => f.id && !seenSet.has(`${f.kind}|${f.id}`))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  for (const f of pending) {
    const error = f.error ?? "";
    const signature = errorSignature(f.kind, error);
    const { data: existingRaw } = await admin
      .from("incidents" as never)
      .select("id, status, occurrences, affected_emails, agent_notes")
      .eq("signature", signature)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existing = existingRaw as unknown as ExistingIncident | null;

    let incidentId: string;
    if (existing) {
      const reopened = existing.status === "fixed" || existing.status === "ignored";
      const emails = new Set<string>(existing.affected_emails ?? []);
      if (f.email) emails.add(f.email);
      const notes: AgentNote[] = Array.isArray(existing.agent_notes)
        ? existing.agent_notes
        : [];
      if (reopened) {
        notes.push({
          at: new Date().toISOString(),
          by: "system",
          note: `REINCIDÊNCIA: falha voltou após status "${existing.status}" — incidente reaberto.`,
        });
      }
      await admin
        .from("incidents" as never)
        .update({
          status: reopened ? "open" : existing.status,
          occurrences: (existing.occurrences ?? 1) + 1,
          affected_emails: [...emails],
          last_seen_at: f.at,
          sample_error: error.slice(0, 1000) || null,
          agent_notes: notes,
        } as never)
        .eq("id", existing.id);
      incidentId = existing.id;
    } else {
      const { data: insertedRaw, error: insErr } = await admin
        .from("incidents" as never)
        .insert({
          kind: f.kind === "voice" ? "training" : f.kind,
          cause: classifyCause(error),
          status: "open",
          signature,
          title: incidentTitle(f.kind, error),
          occurrences: 1,
          affected_emails: f.email ? [f.email] : [],
          sample_error: error.slice(0, 1000) || null,
          first_seen_at: f.at,
          last_seen_at: f.at,
        } as never)
        .select("id")
        .single();
      const inserted = insertedRaw as unknown as { id: string } | null;
      if (insErr || !inserted) {
        logger.error("api", "incidents.sync.insert_failed", { error: insErr?.message });
        continue;
      }
      incidentId = inserted.id;
      created++;
    }

    await admin.from("incident_occurrences" as never).insert({
      kind: f.kind,
      ref_id: f.id,
      incident_id: incidentId,
      at: f.at,
      email: f.email,
      error: error.slice(0, 500) || null,
    } as never);
  }

  if (pending.length) {
    logger.info("api", "incidents.sync", { processed: pending.length, created });
  }
  return pending.length;
}
