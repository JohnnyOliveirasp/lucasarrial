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
import { adminRoleDetalhado, type AdminRole } from "@/lib/admin/guard";
import { decidirGate } from "@/lib/admin/guard-pure";
import { forbidden, serviceUnavailable, unauthorized } from "@/lib/api/responses";

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

  const resultado = await adminRoleDetalhado(auth.email);
  const decisao = decidirGate(resultado, opts?.allow ?? ["admin"], {
    email: auth.email,
    rota: request.nextUrl?.pathname ?? "(rota desconhecida)",
  });

  if (decisao.tipo === "permitir") return { auth, role: decisao.role };

  // Toda recusa LOGA (medido 21/09: o Johnny levou 403 três vezes e o log de
  // produção tinha zero registros — a negativa era muda e ninguém fechou a
  // causa). Só e-mail, papel, fonte, rota e motivo — nunca token/cookie.
  if (decisao.tipo === "negar_503") {
    // Erro de CONSULTA não é "você não é admin": responde 503 pra pessoa
    // tentar de novo, e error-level porque é infra quebrada, não gente errada.
    console.error("[gate-admin] não consegui verificar o papel", JSON.stringify(decisao.log));
    return { res: serviceUnavailable("Não consegui confirmar seu acesso. Tente de novo.") };
  }

  console.warn("[gate-admin] acesso negado", JSON.stringify(decisao.log));
  return {
    res: forbidden(
      decisao.motivo === "sem_papel"
        ? "Acesso restrito a administradores"
        : "Seu acesso não inclui esta área",
    ),
  };
}
