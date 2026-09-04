/**
 * PATCH /api/v1/admin/incidents/[id] → muda status/nota de um incidente
 * (marcar corrigido, ignorar, reabrir, pedir suporte) a partir da aba Falhas.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { defeitoVivo, motivoDefeitoVivo, type IncidenteParaBaixa } from "@/lib/incidents/baixa";
import { CLOSED_STATUSES, closureFields } from "@/lib/incidents/closure";
import { isIncidentStatus } from "@/lib/incidents/status";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body?.status ?? "");
  if (!isIncidentStatus(status)) return badRequest("Invalid 'status'");

  const admin = getAdmin();

  /**
   * A TRAVA DO FECHAMENTO (pedido do Lucas, 04/09).
   *
   * Fechar um chamado cujo defeito ainda está acontecendo em escala apaga
   * dívida técnica que afeta centenas de alunos, e ninguém descobre depois.
   * As duas réguas e o porquê estão em @/lib/incidents/baixa.
   *
   * `ignored` entra junto de propósito: ele TAMBÉM é fechamento (é a lição
   * inteira do closure.ts) e some do quadro do mesmo jeito. Travar só o
   * "fixed" seria deixar a porta dos fundos aberta ao lado da porta trancada.
   *
   * A saída existe e é deliberada: `force: true`, e SÓ pro papel `admin`. Quem
   * consertou o defeito de verdade fecha pelo caminho técnico (o agente, em
   * /api/v1/agent/actions, ou as ferramentas de _frank/) — que continua livre,
   * porque lá o fechamento vem com commit e nota de correção.
   */
  if (CLOSED_STATUSES.has(status)) {
    const { data: atual } = await admin
      .from("incidents" as never)
      .select("occurrences, affected_emails")
      .eq("id", id)
      .maybeSingle();
    const inc = (atual ?? null) as IncidenteParaBaixa | null;
    if (inc && defeitoVivo(inc)) {
      const forcado = body?.force === true && g.role === "admin";
      if (!forcado) {
        logger.info("audit", "incidents.fechamento_barrado", {
          by: g.auth.email, incident: id, status, role: g.role,
        });
        return jsonError("defeito_ainda_vivo", motivoDefeitoVivo(inc) ?? "Defeito ainda ativo", 409);
      }
      logger.info("audit", "incidents.fechamento_forcado", {
        by: g.auth.email, incident: id, status,
      });
    }
  }

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
    const { error } = await admin
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
