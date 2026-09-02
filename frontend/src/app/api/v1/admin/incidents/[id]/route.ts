/**
 * PATCH /api/v1/admin/incidents/[id] → muda status/nota de um incidente
 * (marcar corrigido, ignorar, reabrir) a partir da aba Falhas.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { closureFields } from "@/lib/incidents/closure";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["open", "investigating", "fixing", "aguardando_aluno", "fixed", "ignored"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await gateAdmin(request, SUPORTE_OK);
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
  // ⚠️ "ignored" TAMBEM e fechamento (20/08, incidente do detector de zumbi).
  // So o "fixed" gravava a data, entao todo incidente fechado como ignored
  // ficava sem resolved_at e sumia de qualquer consulta que filtra por data
  // de fechamento. Quem fecha nao pode precisar LEMBRAR de gravar o campo -
  // no dia 20/08 quem sabia do incidente esqueceu assim mesmo.
  //
  // A regra dos 3 campos mora em @/lib/incidents/closure. Estava escrita
  // INLINE aqui e copiada na rota do agente; a cópia em entregar.ts saiu com
  // 2 dos 3 campos e foi assim que nasceram os órfãos de resolved_commit.
  //
  // `email` é `string | null` no AuthResult. Cai pro `user_id` (sempre
  // presente) em vez de gravar null: um fechamento sem dono identificável foi
  // exatamente o buraco do conserto (2). Não inventa nome — o user_id é
  // rastreável.
  Object.assign(update, closureFields(status, g.auth.email ?? g.auth.user_id));

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
