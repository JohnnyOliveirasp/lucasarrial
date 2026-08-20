/**
 * Fechamento de incidente — ÚNICO lugar do app que decide quais campos
 * acompanham status "fixed"/"ignored".
 *
 * Contexto (card 20/08): incidentes fechados sem resolved_at ficam
 * permanentemente invisíveis pro detector de zumbi (`last_seen_at >
 * resolved_at` nunca é verdadeiro com resolved_at nulo) — foi assim que o
 * 8d370ef5 escondeu 14 ocorrências de bug nosso. TODO caminho de escrita que
 * fecha incidente passa por aqui; o backstop pra quem não passa (scripts
 * ad-hoc com service-role) é o trigger do banco
 * (scripts/85_incidents_resolved_guard.sql).
 */

/** Status que significam "incidente fechado". */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set(["fixed", "ignored"]);

/**
 * Campos obrigatórios de fechamento. Retorna {} pra status não-fechado, e
 * `{ resolved_by, resolved_at }` pra fixed/ignored — espalhe no update/insert:
 *
 *   .update({ status, ...closureFields(status, g.auth.email) })
 *
 * `at` opcional pra quando o momento do fechamento é o da ocorrência
 * (incidente que já nasce fechado, regra 17/08).
 */
export function closureFields(
  status: string,
  resolvedBy: string,
  at?: string,
): { resolved_by: string; resolved_at: string } | Record<string, never> {
  if (!CLOSED_STATUSES.has(status)) return {};
  return {
    resolved_by: resolvedBy,
    resolved_at: at ?? new Date().toISOString(),
  };
}
