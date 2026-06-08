/**
 * Cancelamento de assinatura via API da Hotmart (OAuth client_credentials).
 * Usado SÓ no servidor.
 *
 * Precisa das credenciais que o produtor gera em Ferramentas → Credenciais:
 *   HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, HOTMART_BASIC (token Basic).
 * Sem elas, isConfigured() é false e o caller só registra o pedido.
 *
 * ⚠️ Os endpoints/paths são os públicos conhecidos e ficam sobrescrevíveis por
 * env — VALIDAR contra a doc oficial quando as credenciais existirem
 * (developers.hotmart.com é renderizado em JS e não foi possível extrair o
 * formato exato na implementação).
 */
const OAUTH_URL =
  process.env.HOTMART_OAUTH_URL ??
  "https://api-sec-vlc.hotmart.com/security/oauth/token";
const API_BASE =
  process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

export function isConfigured(): boolean {
  return Boolean(
    process.env.HOTMART_CLIENT_ID &&
      process.env.HOTMART_CLIENT_SECRET &&
      process.env.HOTMART_BASIC,
  );
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.HOTMART_CLIENT_ID!;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET!;
  const basic = process.env.HOTMART_BASIC!;

  const url = `${OAUTH_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(
    clientId,
  )}&client_secret=${encodeURIComponent(clientSecret)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) {
    throw new Error(`Hotmart OAuth falhou: ${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Hotmart OAuth sem access_token");
  return data.access_token;
}

/**
 * Cancela a assinatura pelo código do assinante (subscriber code).
 * Retorna true em sucesso. Lança se não configurado ou se a API recusar.
 */
export async function cancelSubscription(subscriberCode: string): Promise<boolean> {
  if (!isConfigured()) throw new Error("hotmart_not_configured");
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}/subscriptions/${subscriberCode}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ send_email: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hotmart cancel falhou: ${res.status} ${body.slice(0, 200)}`);
  }
  return true;
}
