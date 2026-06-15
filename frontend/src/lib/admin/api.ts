/**
 * Gate de admin pras rotas /api/v1/admin/*. Server-only.
 * Retorna o auth do admin OU uma Response de erro pronta (discriminated union).
 */
import type { NextRequest } from "next/server";
import { authenticate, type AuthResult } from "@/lib/api/auth";
import { isAdmin } from "@/lib/admin/guard";
import { forbidden, unauthorized } from "@/lib/api/responses";

export type AdminGate = { auth: NonNullable<AuthResult> } | { res: Response };

export async function gateAdmin(request: NextRequest): Promise<AdminGate> {
  const auth = await authenticate(request);
  if (!auth) return { res: unauthorized() };
  if (!(await isAdmin(auth.email))) {
    return { res: forbidden("Acesso restrito a administradores") };
  }
  return { auth };
}
