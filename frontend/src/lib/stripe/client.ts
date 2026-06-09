/**
 * Cliente Stripe via API REST (fetch) — sem SDK, no padrão do projeto
 * (igual RunPod/Anthropic). Usado SÓ no servidor.
 *
 * Stripe processa os CRÉDITOS AVULSOS (pagamento único). A assinatura
 * recorrente continua na Hotmart.
 *
 * Envs: STRIPE_SECRET_KEY (sk_...), STRIPE_WEBHOOK_SECRET (whsec_...).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

function secretKey(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY não configurada");
  return k;
}

export type CheckoutSession = { id: string; url: string };

/**
 * Cria uma Checkout Session (mode=payment) com preço dinâmico em BRL.
 * metadata trafega user_id + credits, lidos no webhook após o pagamento.
 */
export async function createCheckoutSession(params: {
  amountCents: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}): Promise<CheckoutSession> {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price_data][currency]", "brl");
  form.set("line_items[0][price_data][product_data][name]", params.productName);
  form.set("line_items[0][price_data][unit_amount]", String(params.amountCents));
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  // NÃO setamos payment_method_types: omitir faz o Stripe mostrar dinamicamente
  // os métodos ATIVADOS no dashboard (Settings → Payment methods). Hoje aparece
  // só cartão; quando o Pix for ativado na conta, aparece sozinho — sem mexer no
  // código. Hardcodar ["card","pix"] dá 400 se o Pix não estiver ativado, e
  // automatic_payment_methods NÃO existe em Checkout Sessions (só em PaymentIntents).
  if (params.customerEmail) form.set("customer_email", params.customerEmail);
  for (const [k, v] of Object.entries(params.metadata)) {
    form.set(`metadata[${k}]`, v);
  }

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe checkout falhou: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}

/**
 * Valida a assinatura do webhook Stripe (header Stripe-Signature: t=..,v1=..).
 * signed_payload = `${t}.${rawBody}`; HMAC-SHA256 com o webhook secret (hex);
 * compara com v1 em tempo constante + tolerância de 5 min no timestamp.
 */
export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  webhookSecret: string | undefined,
): boolean {
  if (!sigHeader || !webhookSecret) return false;

  let t: string | undefined;
  let v1: string | undefined;
  for (const part of sigHeader.split(",")) {
    const [k, val] = part.split("=");
    if (k === "t") t = val;
    if (k === "v1") v1 = val;
  }
  if (!t || !v1) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() / 1000 - ts) < 300; // tolerância 5 min
}
