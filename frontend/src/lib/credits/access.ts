/**
 * Controle de acesso ao produto pago + bypass de cobrança.
 *
 * - bypassesBilling: equipe/admin não consome créditos nem precisa de assinatura
 *   (allowlist de cortesia). Decidido 2026-06-08: só Johnny, Lucas e Edu.
 * - hasActiveAccess: tem acesso quem está na allowlist OU tem assinatura ativa
 *   (profiles.access_until no futuro). É o gate de "precisa assinar pra entrar".
 */
import { isAdminEmail } from "@/lib/api/auth";

const ALLOWLIST = (
  process.env.COMP_ACCESS_EMAILS ??
  "johnny.oliveirasp@gmail.com,lucas.m.arrial@gmail.com,eduardo@lucasarrial.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** E-mail liberado por cortesia (equipe). */
export function isAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWLIST.includes(email.toLowerCase());
}

/** Não consome créditos e não precisa de assinatura (equipe + admins). */
export function bypassesBilling(email: string | null | undefined): boolean {
  return isAdminEmail(email) || isAllowlisted(email);
}

/**
 * Tem acesso ao app? Allowlist/admin sempre; senão precisa de assinatura ativa.
 * @param accessUntil profiles.access_until (ISO) — NULL/passado = sem acesso.
 */
export function hasActiveAccess(
  email: string | null | undefined,
  accessUntil: string | null | undefined,
): boolean {
  if (bypassesBilling(email)) return true;
  if (!accessUntil) return false;
  return new Date(accessUntil).getTime() > Date.now();
}
