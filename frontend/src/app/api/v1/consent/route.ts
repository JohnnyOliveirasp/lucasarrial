/**
 * /api/v1/consent
 *   GET  → { accepted: boolean, version } — se o usuário já aceitou a versão atual
 *   POST → registra o aceite da versão atual (idempotente). Guarda IP + user-agent.
 *
 * Aceite único cobrindo Termos de Uso + Privacidade + Política de Uso.
 * Versionado por CONSENT_VERSION: subir a versão reapresenta o popup.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { CONSENT_VERSION } from "@/lib/legal";

const CONSENT_TYPE = "all";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data, error } = await admin
    .from("user_consents")
    .select("id")
    .eq("user_id", auth.user_id)
    .eq("consent_type", CONSENT_TYPE)
    .eq("consent_version", CONSENT_VERSION)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) return serverError("Failed to check consent");
  return jsonOk({ accepted: !!data, version: CONSENT_VERSION });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const ua = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const admin = getAdmin();
  const { error } = await admin.from("user_consents").upsert(
    {
      user_id: auth.user_id,
      consent_type: CONSENT_TYPE,
      consent_version: CONSENT_VERSION,
      ip_address: ip,
      user_agent: ua,
    },
    { onConflict: "user_id,consent_type,consent_version", ignoreDuplicates: true },
  );

  if (error) return serverError("Failed to record consent");
  return jsonOk({ accepted: true, version: CONSENT_VERSION });
}
