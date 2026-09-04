/**
 * Gate de admin pras rotas /api/v1/admin/*. Server-only.
 * Retorna o auth do admin OU uma Response de erro pronta (discriminated union).
 *
 * PAPÉIS (mig 95): o default é FECHADO — `gateAdmin(request)` só deixa passar
 * quem é `admin`. Rota que o SUPORTE também pode usar declara isso na mão:
 * `gateAdmin(request, { allow: ["admin", "suporte"] })`.
 * Foi feito assim de propósito: rota nova nasce sem acesso pro suporte, e
 * esquecer de configurar fecha demais em vez de vazar dinheiro.
 */
import type { NextRequest } from "next/server";
import { authenticate, type AuthResult } from "@/lib/api/auth";
import { adminRole, type AdminRole } from "@/lib/admin/guard";
import { forbidden, unauthorized } from "@/lib/api/responses";

/** Falhas, SGP e Agente sao o trabalho do suporte (mig 95) — os dois papeis entram. */
export const SUPORTE_OK = { allow: ["admin", "suporte"] } as const;

export type AdminGate =
  | { auth: NonNullable<AuthResult>; role: AdminRole }
  | { res: Response };

export async function gateAdmin(
  request: NextRequest,
  opts?: { allow?: readonly AdminRole[] },
): Promise<AdminGate> {
  const auth = await authenticate(request);
  if (!auth) return { res: unauthorized() };

  const role = await adminRole(auth.email);
  if (!role) return { res: forbidden("Acesso restrito a administradores") };

  const allow = opts?.allow ?? ["admin"];
  if (!allow.includes(role)) {
    return { res: forbidden("Seu acesso não inclui esta área") };
  }
  return { auth, role };
}
