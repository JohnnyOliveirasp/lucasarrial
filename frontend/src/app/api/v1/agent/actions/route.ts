/**
 * POST /api/v1/agent/actions — ações do agente de monitoramento (token
 * dedicado). Ações permitidas (escopo curto de propósito):
 *  - add_note    {incident_id, note}                  → anota diagnóstico no incidente
 *  - set_status  {incident_id, status, resolution_note?, resolved_commit?}
 *  - set_state   {key, value}                          → memória persistente do agente
 *  - notify      {subject, body}                       → e-mail pro admin (Johnny)
 * O agente NÃO tem ação de deploy nem escrita fora destas tabelas.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { sendEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

const ADMIN_NOTIFY_EMAIL = "johnny.oliveirasp@gmail.com";
const VALID_STATUS = new Set(["open", "investigating", "fixing", "fixed", "ignored"]);

type AgentNote = { at: string; by: string; note: string };

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") return badRequest("Missing 'action'");
  const admin = getAdmin();

  try {
    if (body.action === "add_note") {
      const { incident_id, note } = body;
      if (!incident_id || !note) return badRequest("add_note requires incident_id and note");
      const { data: incRaw } = await admin
        .from("incidents" as never)
        .select("agent_notes")
        .eq("id", incident_id)
        .maybeSingle();
      const inc = incRaw as unknown as { agent_notes: AgentNote[] | null } | null;
      if (!inc) return badRequest("incident not found");
      const notes = Array.isArray(inc.agent_notes) ? inc.agent_notes : [];
      notes.push({ at: new Date().toISOString(), by: "agent", note: String(note).slice(0, 2000) });
      await admin
        .from("incidents" as never)
        .update({ agent_notes: notes } as never)
        .eq("id", incident_id);
      logger.info("audit", "agent.add_note", { incident_id });
      return jsonOk({ ok: true });
    }

    if (body.action === "set_status") {
      const { incident_id, status, resolution_note, resolved_commit } = body;
      if (!incident_id || !VALID_STATUS.has(status)) {
        return badRequest("set_status requires incident_id and valid status");
      }
      const update: Record<string, unknown> = { status };
      if (typeof resolution_note === "string") update.resolution_note = resolution_note.slice(0, 1000);
      if (typeof resolved_commit === "string") update.resolved_commit = resolved_commit.slice(0, 64);
      if (status === "fixed") {
        update.resolved_by = "agent";
        update.resolved_at = new Date().toISOString();
      }
      await admin
        .from("incidents" as never)
        .update(update as never)
        .eq("id", incident_id);
      logger.info("audit", "agent.set_status", { incident_id, status });
      return jsonOk({ ok: true });
    }

    if (body.action === "set_state") {
      const { key, value } = body;
      if (!key || typeof key !== "string") return badRequest("set_state requires key");
      await admin
        .from("agent_state" as never)
        .upsert({ key: key.slice(0, 100), value: value ?? null, updated_at: new Date().toISOString() } as never);
      return jsonOk({ ok: true });
    }

    if (body.action === "notify") {
      const { subject, body: text } = body;
      if (!subject || !text) return badRequest("notify requires subject and body");
      await sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: `🤖 Vigia FastCloner: ${String(subject).slice(0, 120)}`,
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${String(text)
          .slice(0, 8000)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</pre>`,
      });
      logger.info("audit", "agent.notify", { subject: String(subject).slice(0, 120) });
      return jsonOk({ ok: true });
    }

    return badRequest(`unknown action '${body.action}'`);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "agent action failed");
  }
}
