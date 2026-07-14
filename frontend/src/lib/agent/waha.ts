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

/**
 * Envia texto. Devolve o id da mensagem (dedupe do eco no webhook).
 * replyTo (id serializado da mensagem original) = responde CITANDO — usado
 * nos grupos pra ficar claro a quem a resposta se dirige.
 */
export async function wahaSendText(
  jid: string,
  text: string,
  opts?: { replyTo?: string | null },
): Promise<string | null> {
  const res = await waha(`/api/sendText`, {
    method: "POST",
    body: JSON.stringify({
      session: SESSION,
      chatId: toWahaChatId(jid),
      text,
      ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`WAHA sendText ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // webjs devolve id objeto {id,_serialized}; GOWS devolve string
  // "true_<jid>_<ID>" — normaliza pro MESMO valor que o webhook usa (último
  // segmento), senão o eco da própria mensagem duplica no banco.
  const json = (await res.json()) as { id?: string | { id?: string; _serialized?: string } };
  if (typeof json.id === "string") return json.id.split("_").pop() ?? json.id;
  return json.id?.id ?? json.id?._serialized ?? null;
}

/**
 * Resolve um LID (identificador anônimo do GOWS) pro telefone real.
 * O store do whatsmeow guarda o mapeamento lid→pn de todo contato visto:
 * GET /api/{session}/lids/{lid} → { lid, pn: "5511...@c.us" }.
 * Devolve SÓ os dígitos do telefone, ou null se o engine não conhece o LID.
 */
export async function wahaLidToPhone(lid: string): Promise<string | null> {
  try {
    const id = lid.includes("@") ? lid : `${lid}@lid`;
    const res = await waha(`/api/${SESSION}/lids/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { pn?: string | null };
    const digits = (json.pn ?? "").replace(/\D/g, "");
    return digits || null;
  } catch {
    return null;
  }
}

/** Marca o chat como lido (✔✔ azul) — parte da simulação de digitação. */
export async function wahaSendSeen(jid: string): Promise<void> {
  try {
    await waha(`/api/sendSeen`, {
      method: "POST",
      body: JSON.stringify({ session: SESSION, chatId: toWahaChatId(jid) }),
    });
  } catch {
    /* cosmético — nunca trava o envio */
  }
}

/** Liga/desliga o "digitando…" no chat (simulação de digitação humana). */
export async function wahaSetTyping(jid: string, on: boolean): Promise<void> {
  try {
    await waha(`/api/${on ? "startTyping" : "stopTyping"}`, {
      method: "POST",
      body: JSON.stringify({ session: SESSION, chatId: toWahaChatId(jid) }),
    });
  } catch {
    /* cosmético — nunca trava o envio */
  }
}

/** Assunto (nome) de um grupo. */
export async function wahaGroupSubject(groupJid: string): Promise<string | null> {
  try {
    const res = await waha(`/api/${SESSION}/groups/${encodeURIComponent(groupJid)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { subject?: string; name?: string; Name?: string };
    return json.subject ?? json.name ?? json.Name ?? null;
  } catch {
    return null;
  }
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
