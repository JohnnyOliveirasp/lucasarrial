/**
 * Criptografia dos tokens de contas sociais (publicador): AES-256-GCM,
 * mesmo desenho do HeyGen BYOK (lib/heygen/crypto) com contexto próprio.
 * Também gera/valida o `state` HMAC do OAuth (stateless, sem migração —
 * padrão do token do Gravador Celular).
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

function aesKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return Buffer.from(hkdfSync("sha256", secret, "fastcloner", "social-tokens-v1", 32));
}

/** Devolve "v1:<iv>:<tag>:<cipher>" em base64url. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64 = (b: Buffer) => b.toString("base64url");
  return `v1:${b64(iv)}:${b64(tag)}:${b64(enc)}`;
}

export function decryptToken(stored: string): string {
  const [version, ivB64, tagB64, encB64] = stored.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !encB64) {
    throw new Error("formato de token criptografado inválido");
  }
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

// ───────── state do OAuth (amarra o callback ao usuário logado) ─────────
// ⚠️ separador "~" (nunca "."): o matcher do middleware ignora URL com ponto
// (lição do Gravador Celular 03/08).

function stateHmac(payload: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", secret).update(`social-state:${payload}`).digest("base64url");
}

/** state = "<user_id>~<expEpoch>~<hmac>", válido por 15min. */
export function makeOauthState(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const payload = `${userId}~${exp}`;
  return `${payload}~${stateHmac(payload)}`;
}

/** Devolve o user_id se o state for válido e não expirado; senão null. */
export function verifyOauthState(state: string): string | null {
  const parts = state.split("~");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const payload = `${userId}~${expStr}`;
  if (sig !== stateHmac(payload)) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  return userId;
}
