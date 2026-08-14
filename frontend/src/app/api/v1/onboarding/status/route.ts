/**
 * GET /api/v1/onboarding/status?email=... — consulta da PLANILHA (Apps Script,
 * varredura de 15min): a linha só vira "Realizado" quando TUDO ficou pronto
 * (avatares gerados + voz treinada) — regra Johnny 13/08.
 * Segurança: mesmo X-Onboarding-Secret do webhook de import.
 * Efeito colateral desejado: se está pronto e o e-mail "plataforma pronta"
 * ainda não saiu (webhook perdido), envia aqui — a varredura é a rede.
 */
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, notFound, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { statusOnboarding, verificarOnboardingPronto } from "@/lib/onboarding/pronto";

export const dynamic = "force-dynamic";

function validSecret(header: string | null): boolean {
  const expected = process.env.ONBOARDING_WEBHOOK_SECRET;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!validSecret(request.headers.get("x-onboarding-secret"))) return unauthorized();

  const email = (request.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("E-mail inválido");

  const admin = getAdmin();
  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!prof?.id) return notFound("Conta");

  const st = await statusOnboarding(admin, prof.id as string);
  if (st.pronto && !st.email_enviado) {
    await verificarOnboardingPronto(admin, prof.id as string);
    st.email_enviado = true;
  }
  return jsonOk(st);
}
