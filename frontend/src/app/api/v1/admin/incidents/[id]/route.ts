/**
 * PATCH /api/v1/admin/incidents/[id] → muda status/nota de um incidente
 * (marcar corrigido, ignorar, reabrir) a partir da aba Falhas.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["open", "investigating", "fixing", "fixed", "ignored"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body?.status ?? "");
  if (!VALID_STATUS.has(status)) return badRequest("Invalid 'status'");

  const update: Record<string, unknown> = { status };
  if (typeof body.resolution_note === "string") {
    update.resolution_note = body.resolution_note.slice(0, 1000);
  }
  if (typeof body.resolved_commit === "string") {
    update.resolved_commit = body.resolved_commit.slice(0, 64);
  }
  if (status === "fixed") {
    update.resolved_by = g.auth.email;
    update.resolved_at = new Date().toISOString();
  }

  try {
    const { error } = await getAdmin()
      .from("incidents" as never)
      .update(update as never)
      .eq("id", id);
    if (error) return serverError(error.message);
    logger.info("audit", "incidents.status_changed", {
      by: g.auth.email, incident: id, status,
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to update incident");
  }
}
