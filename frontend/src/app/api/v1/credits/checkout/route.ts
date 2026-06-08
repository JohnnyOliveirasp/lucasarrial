/**
 * POST /api/v1/credits/checkout
 *
 * Cria uma sessão de checkout do Stripe para comprar um PACOTE de créditos
 * avulso. Só assinante ativo (ou equipe) pode comprar — créditos avulsos são
 * complemento da assinatura, não porta de entrada.
 *
 * Body: { package_id: "p25" | "p60" | "p120" }
 * Retorna: { url } — redirecionar o browser pra essa URL do Stripe.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  forbidden,
  jsonOk,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { findCreditPackage } from "@/lib/credits/config";
import { hasActiveAccess } from "@/lib/credits/access";
import { createCheckoutSession } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { package_id?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const pkg = body.package_id ? findCreditPackage(body.package_id) : null;
  if (!pkg) return badRequest("package_id inválido");

  // Gate: só quem tem assinatura ativa (ou é equipe) compra créditos avulsos.
  const { data: profile } = await getAdmin()
    .from("profiles")
    .select("access_until")
    .eq("id", auth.user_id)
    .maybeSingle();
  if (!hasActiveAccess(auth.email, profile?.access_until ?? null)) {
    return forbidden("Assine o plano antes de comprar créditos avulsos.");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  try {
    const session = await createCheckoutSession({
      amountCents: pkg.priceCents,
      productName: `AICloneVerse — ${pkg.label}`,
      successUrl: `${origin}/app/dashboard?credits=success`,
      cancelUrl: `${origin}/app/dashboard?credits=cancelled`,
      customerEmail: auth.email ?? undefined,
      metadata: {
        user_id: auth.user_id,
        credits: String(pkg.credits),
        package: pkg.id,
      },
    });
    return jsonOk({ url: session.url });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Stripe checkout failed");
  }
}
