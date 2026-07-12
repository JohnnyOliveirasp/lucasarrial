/**
 * Agente de suporte WhatsApp — cliente da Evolution API (server-only).
 * A Evolution (self-hosted no Hetzner, wrapper do Baileys) é a ponte com o
 * WhatsApp: o número do suporte é pareado como "aparelho conectado".
 *
 * Envs: EVOLUTION_API_URL (no servidor = http://127.0.0.1:8080, mesma máquina)
 *       EVOLUTION_API_KEY · AGENT_INSTANCE (ex.: fastcloner-suporte)
 */

function baseUrl(): string {
  const u = process.env.EVOLUTION_API_URL;
  if (!u) throw new Error("Missing EVOLUTION_API_URL");
  return u.replace(/\/$/, "");
}

function apiKey(): string {
  const k = process.env.EVOLUTION_API_KEY;
  if (!k) throw new Error("Missing EVOLUTION_API_KEY");
  return k;
}

export function agentInstance(): string {
  return process.env.AGENT_INSTANCE || "fastcloner-suporte";
}

async function evo<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      apikey: apiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Evolution ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Estado da conexão da instância: 'open' = pareada e online. */
export async function getConnectionState(): Promise<string> {
  try {
    const json = await evo<{ instance?: { state?: string } }>(
      `/instance/connectionState/${agentInstance()}`,
    );
    return json.instance?.state ?? "close";
  } catch {
    return "not_found";
  }
}

/** QR code (base64) pra parear — a Evolution gera um novo a cada chamada. */
export async function getQrCode(): Promise<string | null> {
  try {
    const json = await evo<{ base64?: string; code?: string }>(
      `/instance/connect/${agentInstance()}`,
    );
    return json.base64 ?? null;
  } catch {
    return null;
  }
}

/** Assunto (nome) de um grupo — usado 1x ao criar o chat no banco. */
export async function getGroupSubject(groupJid: string): Promise<string | null> {
  try {
    const json = await evo<{ subject?: string }>(
      `/group/findGroupInfos/${agentInstance()}?groupJid=${encodeURIComponent(groupJid)}`,
    );
    return json.subject ?? null;
  } catch {
    return null;
  }
}

/** Envia texto pra um jid (privado ou grupo). Usado a partir da F1/F2. */
export async function sendText(jid: string, text: string): Promise<void> {
  await evo(`/message/sendText/${agentInstance()}`, {
    method: "POST",
    body: JSON.stringify({ number: jid, text }),
  });
}
