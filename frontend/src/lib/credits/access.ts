/**
 * Controle de acesso ao produto pago + bypass de cobrança.
 *
 * - bypassesBilling: equipe/admin não consome créditos nem precisa de assinatura
 *   (allowlist de cortesia). Decidido 2026-06-08: só Johnny, Lucas e Edu.
 * - hasActiveAccess: tem acesso quem está na allowlist OU tem assinatura ativa
 *   OU comprou avulso (acesso vitalício). É o gate de "precisa assinar pra entrar".
 *
 * A regra pura vive em `access-window.ts` (sem imports) pra poder ser testada —
 * este arquivo é só a composição com o bypass.
 */
import { isAdminEmail } from "@/lib/api/auth";
import { decidirAcesso, emailNaAllowlist } from "./access-window";

/** E-mail liberado por cortesia (equipe). */
export function isAllowlisted(email: string | null | undefined): boolean {
  return emailNaAllowlist(email);
}

/** Não consome créditos e não precisa de assinatura (equipe + admins). */
export function bypassesBilling(email: string | null | undefined): boolean {
  return isAdminEmail(email) || isAllowlisted(email);
}

/**
 * Tem acesso ao app? Allowlist/admin sempre; senão precisa de acesso pago.
 *
 * ⚠️ `accessUntil = NULL` NÃO significa "sem acesso" sozinho — é ambíguo, e a
 * desambiguação é o `accessSource` (contrato escrito em scripts/12_payments.sql
 * e no tipo em lib/db/types.ts:58). Compra AVULSA (pagamento único) gera
 * entitlement vitalício, que `recomputeProfileAccess` grava como
 * `access_source='hotmart'` + `access_until=NULL`. Sem o 3º argumento, esse
 * aluno — que pagou — é lido como "sem acesso" e fica trancado com o crédito
 * parado na mão.
 *
 * @param accessUntil  profiles.access_until (ISO). NULL = ver accessSource.
 * @param accessSource profiles.access_source. OPCIONAL: quem não passa mantém
 *   exatamente o comportamento antigo (NULL sem origem = sem acesso).
 */
export function hasActiveAccess(
  email: string | null | undefined,
  accessUntil: string | null | undefined,
  accessSource?: string | null,
): boolean {
  return decidirAcesso(bypassesBilling(email), accessUntil, accessSource);
}
