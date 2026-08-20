/**
 * Regra PURA de qual entitlement concede acesso — extraída de
 * recomputeProfileAccess (entitlements.ts) pra ser testável com `node --test`
 * (mesmo padrão do hotmart-payload.ts: sem imports de Next/DB).
 *
 * Regra de negócio (regra 9 do _frank/01_REGRAS_DURAS.md):
 *  - 'active' não expirado concede acesso (access_until NULL = vitalício).
 *  - 'canceled' com access_until NO FUTURO também concede: cancelamento de
 *    assinatura mantém o acesso até o fim do período já pago (é o que o
 *    webhook grava em route.ts; antes o recompute jogava isso fora e a
 *    pessoa que pagou e cancelou perdia o acesso no mesmo dia).
 *    'canceled' com access_until NULL **não** concede — sem período conhecido
 *    não existe "fim do período pago" a honrar.
 *  - 'refunded', 'chargeback', 'expired', 'past_due' nunca concedem, mesmo
 *    com access_until no futuro (o dinheiro voltou ou nunca entrou).
 *
 * Quando a pessoa tem mais de um entitlement, 'active' tem prioridade sobre
 * 'canceled' (o cache do profile herda provider/access_until do escolhido).
 */

export type AccessEntitlement = {
  status: string;
  access_until: string | null; // ISO; NULL = vitalício (só vale pra 'active')
};

/**
 * Escolhe o entitlement que concede acesso agora, ou undefined se nenhum.
 * 'active' vence 'canceled'; empates dentro do mesmo status ficam na ordem
 * recebida (comportamento idêntico ao find original).
 */
export function pickAccessEntitlement<T extends AccessEntitlement>(
  ents: readonly T[],
  nowIso: string,
): T | undefined {
  const active = ents.find(
    (e) =>
      e.status === "active" &&
      (e.access_until === null || e.access_until > nowIso),
  );
  if (active) return active;

  // cancelou depois de pagar: o acesso vale até o fim do período já pago
  return ents.find(
    (e) =>
      e.status === "canceled" &&
      e.access_until !== null &&
      e.access_until > nowIso,
  );
}
