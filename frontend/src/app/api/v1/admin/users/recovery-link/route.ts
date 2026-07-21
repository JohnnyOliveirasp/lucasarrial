/**
 * POST /api/v1/admin/users/recovery-link → gera link de recuperação de senha
 * pra equipe mandar por WhatsApp quando o e-mail do aluno não chega (caso
 * Clínica Elgra 21/07: webmail corporativo segurando o e-mail do Supabase).
 * Só admins (allowlist). O link vale ~1h (expiração do OTP de recovery).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
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
        redirectTo: `${site}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      },
    });
    if (error) return badRequest(error.message);

    logger.info("audit", "admin.recovery_link.generated", {
      admin: g.auth.email,
      target: email,
    });
    return jsonOk({
      link: data.properties?.action_link ?? null,
      expires_in_minutes: 60,
    });
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Failed to generate recovery link",
    );
  }
}
