/**
 * GET  /api/v1/admin/incidents → lista incidentes (sincroniza falhas antes).
 * POST /api/v1/admin/incidents → reporte MANUAL de erro (formulário da aba
 * Falhas): descrição + anexo opcional (print/áudio) sobe pro R2. O agente de
 * monitoramento trata incidentes 'reported' como prioridade na próxima rodada.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { syncIncidentsFromFailures } from "@/lib/incidents/ingest";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB (print ou áudio curto)

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  try {
    await syncIncidentsFromFailures();
    const { data } = await getAdmin()
      .from("incidents" as never)
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(200);
    return jsonOk({ incidents: data ?? [] });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load incidents");
  }
}

export async function POST(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const file = form.get("file");
    if (!title) return badRequest("Missing 'title'");

    let attachmentPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_ATTACHMENT_BYTES) return badRequest("Anexo acima de 8MB");
      const safe = (file.name || "anexo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      attachmentPath = `_incidents/${randomUUID()}_${safe}`;
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKETS.generations,
          Key: attachmentPath,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type || "application/octet-stream",
        }),
      );
    }

    const { data: insertedRaw, error } = await getAdmin()
      .from("incidents" as never)
      .insert({
        kind: "reported",
        cause: "reported",
        status: "open",
        signature: `reported:${randomUUID()}`,
        title: title.slice(0, 200),
        description: description.slice(0, 4000) || null,
        affected_emails: email ? [email] : [],
        attachment_path: attachmentPath,
        reported_by: g.auth.email,
      } as never)
      .select("id")
      .single();
    if (error) return serverError(error.message);

    logger.info("audit", "incidents.reported", {
      by: g.auth.email,
      incident: (insertedRaw as unknown as { id: string } | null)?.id,
      has_attachment: Boolean(attachmentPath),
    });
    return jsonOk({ incident: insertedRaw });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to report incident");
  }
}
