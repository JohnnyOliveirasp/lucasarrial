/**
 * Agente de suporte — cliente da WAHA (engine whatsapp-web.js). Server-only.
 * Plano B adotado 2026-07-13: o Baileys/Evolution não estabelecia sessão de
 * criptografia com contatos @lid (envios presos em PENDING pra sempre) — a
 * WAHA roda um WhatsApp Web REAL (Chrome), o mesmo caminho que o Johnny
 * provou funcionar manualmente no web.whatsapp.com.
 *
 * Envs: WAHA_API_URL (http://127.0.0.1:3033 no servidor) · WAHA_API_KEY.
 * Sessão única "default" (WAHA core).
 */

const SESSION = "default";

function baseUrl(): string {
  const u = process.env.WAHA_API_URL;
  if (!u) throw new Error("Missing WAHA_API_URL");
  return u.replace(/\/$/, "");
}

function apiKey(): string {
  const k = process.env.WAHA_API_KEY;
  if (!k) throw new Error("Missing WAHA_API_KEY");
  return k;
}

async function waha(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": apiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  return res;
}

/** Estado normalizado: 'open' (conectado) | 'connecting' | 'close'. */
export async function wahaConnectionState(): Promise<string> {
  try {
    const res = await waha(`/api/sessions/${SESSION}`);
    if (!res.ok) return "not_found";
    const json = (await res.json()) as { status?: string };
    const s = json.status ?? "";
    if (s === "WORKING") return "open";
    if (s === "SCAN_QR_CODE" || s === "STARTING") return "connecting";
    return "close";
  } catch {
    return "not_found";
  }
}

/** QR (data URL base64) pra parear — mesmo formato que a UI já exibe. */
export async function wahaQrCode(): Promise<string | null> {
  try {
    const res = await waha(`/api/${SESSION}/auth/qr?format=image`, {
      headers: { Accept: "image/png" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Nosso banco usa jids no formato Baileys — converte pro formato webjs. */
export function toWahaChatId(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "@c.us");
}

/** Envia texto. Devolve o id da mensagem (dedupe do eco no webhook). */
export async function wahaSendText(jid: string, text: string): Promise<string | null> {
  const res = await waha(`/api/sendText`, {
    method: "POST",
    body: JSON.stringify({ session: SESSION, chatId: toWahaChatId(jid), text }),
  });
  if (!res.ok) throw new Error(`WAHA sendText ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { id?: { id?: string; _serialized?: string } };
  return json.id?.id ?? json.id?._serialized ?? null;
}

/**
 * Baixa a mídia de uma mensagem pela URL que a WAHA entrega no webhook.
 * A URL vem com o host interno do container (localhost:3000) — troca pela
 * nossa base (127.0.0.1:3033) antes de buscar.
 */
export async function wahaFetchMedia(url: string): Promise<Buffer | null> {
  try {
    const u = new URL(url);
    const res = await fetch(`${baseUrl()}${u.pathname}${u.search}`, {
      headers: { "X-Api-Key": apiKey() },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
