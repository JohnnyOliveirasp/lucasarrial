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
 * (scripts/86_incidents_resolved_guard.sql — NÃO aplicado, aval do Johnny).
 */

/** Status que significam "incidente fechado" (terminais). */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set(["fixed", "ignored"]);

/**
 * Campos de fechamento que acompanham TODA troca de status:
 *
 *   · fixed/ignored → `{ resolved_by, resolved_at }` preenchidos;
 *   · qualquer outro (open/investigating/fixing) → `{ resolved_by: null,
 *     resolved_at: null }` — REABRIR LIMPA os campos (card 261b295b: um
 *     resolved_at velho numa linha reaberta mente pra próxima medição do
 *     detector de zumbi).
 *
 * Espalhe no update/insert:
 *
 *   .update({ status, ...closureFields(status, g.auth.email) })
 *
 * ATENÇÃO: por limpar em status não-fechado, só espalhe quando a escrita É uma
 * troca de status deliberada. Bump de ocorrência que mantém o status de um
 * incidente fechado NÃO deve passar por aqui (re-carimbaria a data histórica).
 *
 * `at` opcional pra quando o momento do fechamento é o da ocorrência
 * (incidente que já nasce fechado, regra 17/08).
 */
export function closureFields(
  status: string,
  resolvedBy: string,
  at?: string,
): { resolved_by: string | null; resolved_at: string | null } {
  if (!CLOSED_STATUSES.has(status)) return { resolved_by: null, resolved_at: null };
  return {
    resolved_by: resolvedBy,
    resolved_at: at ?? new Date().toISOString(),
  };
}
