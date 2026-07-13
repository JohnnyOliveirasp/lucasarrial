/**
 * Agente de suporte — camada de provedor (Evolution × WAHA). Server-only.
 * Env AGENT_PROVIDER: "waha" (padrão em prod desde 2026-07-13) | "evolution".
 * O resto do agente (webhook/ingest/brain/painel) não sabe qual motor roda.
 */
import * as evo from "@/lib/agent/evolution";
import * as waha from "@/lib/agent/waha";

export function agentProvider(): "waha" | "evolution" {
  return process.env.AGENT_PROVIDER === "evolution" ? "evolution" : "waha";
}

/** Estado da conexão ('open' | 'connecting' | 'close' | 'not_found'). */
export async function connectionState(): Promise<string> {
  return agentProvider() === "waha" ? waha.wahaConnectionState() : evo.getConnectionState();
}

/** QR (data URL/base64) quando desconectado. */
export async function qrCode(): Promise<string | null> {
  return agentProvider() === "waha" ? waha.wahaQrCode() : evo.getQrCode();
}

/** Nome do endpoint exibido no painel. */
export function instanceLabel(): string {
  return agentProvider() === "waha" ? "waha:default" : evo.agentInstance();
}

/** Nome (assunto) de um grupo — WAHA não expõe fácil; preenche depois. */
export async function groupSubject(groupJid: string): Promise<string | null> {
  return agentProvider() === "waha" ? null : evo.getGroupSubject(groupJid);
}

/** Envia texto; devolve o id da mensagem enviada (pro dedupe do eco). */
export async function sendAgentText(jid: string, text: string): Promise<string | null> {
  return agentProvider() === "waha" ? waha.wahaSendText(jid, text) : evo.sendText(jid, text);
}

/**
 * Bytes do áudio de uma mensagem: WAHA entrega a URL no próprio webhook;
 * Evolution busca pelo id da mensagem.
 */
export async function fetchAudioBytes(args: {
  waMessageId: string | null;
  mediaUrl: string | null;
}): Promise<Buffer | null> {
  if (agentProvider() === "waha") {
    return args.mediaUrl ? waha.wahaFetchMedia(args.mediaUrl) : null;
  }
  if (!args.waMessageId) return null;
  const media = await evo.getMediaBase64(args.waMessageId);
  return media ? Buffer.from(media.base64, "base64") : null;
}
