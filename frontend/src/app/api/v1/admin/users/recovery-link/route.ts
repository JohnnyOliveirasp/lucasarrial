/**
 * POST /api/v1/admin/users/recovery-link → gera link de recuperação de senha
 * pra equipe mandar por WhatsApp quando o e-mail do aluno não chega (caso
 * Clínica Elgra 21/07: webmail corporativo segurando o e-mail do Supabase).
 * Só admins (allowlist). O link vale ~1h (expiração do OTP de recovery).
 *
 * O `link` devolvido aqui é o formato `token_hash` (ver
 * `@/lib/auth/link-de-acesso`), NÃO o `action_link` do Supabase — este endpoint
 * devolvia o `action_link` até 18/09/2026 e por isso entregava link morto
 * (incidente #438).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import {
  DESTINO_DEFINIR_SENHA,
  VALIDADE_LINK_MINUTOS,
  montarLinkDeAcesso,
} from "@/lib/auth/link-de-acesso";
import { getAdmin } from "@/lib/db/admin";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const body = await request.json().catch(() => ({}));
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return badRequest("Missing 'email'");

  const site = (
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  ).replace(/\/+$/, "");

  try {
    const admin = getAdmin();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${site}/auth/callback?next=${encodeURIComponent(DESTINO_DEFINIR_SENHA)}`,
      },
    });
    if (error) return badRequest(error.message);

    // O link do aluno sai do `hashed_token`, não do `action_link`: só o ramo
    // `token_hash` do /auth/callback chama `verifyOtp` no servidor e grava o
    // cookie. Sem o hash não há link — melhor devolver erro pro admin do que
    // entregar um `link: null` que a tela mostra como falha genérica.
    const hashedToken = data.properties?.hashed_token ?? null;
    if (!hashedToken) {
      logger.warn("api", "admin.recovery_link.sem_hashed_token", {
        admin: g.auth.email,
        target: email,
      });
      return serverError("generateLink não devolveu hashed_token");
    }

    logger.info("audit", "admin.recovery_link.generated", {
      admin: g.auth.email,
      target: email,
    });
    return jsonOk({
      link: montarLinkDeAcesso({ site, hashedToken, type: "recovery" }),
      expires_in_minutes: VALIDADE_LINK_MINUTOS,
    });
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Failed to generate recovery link",
    );
  }
}
