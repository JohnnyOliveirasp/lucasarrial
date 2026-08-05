/**
 * Criptografia das API keys do HeyGen (BYOK): AES-256-GCM.
 *
 * A chave de criptografia é DERIVADA (HKDF) da SUPABASE_SERVICE_ROLE_KEY —
 * já presente em todo ambiente server, zero configuração nova. Trade-off
 * documentado: rotacionar a service role invalida as keys salvas (os alunos
 * reconectam — aceitável para credencial de terceiro re-obtenível).
 * Server-only; a key NUNCA volta pro client (nem mascarada).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function aesKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return Buffer.from(hkdfSync("sha256", secret, "fastcloner", "heygen-byok-v1", 32));
}

/** Devolve "v1:<iv>:<tag>:<cipher>" em base64url. */
export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64 = (b: Buffer) => b.toString("base64url");
  return `v1:${b64(iv)}:${b64(tag)}:${b64(enc)}`;
}

export function decryptApiKey(stored: string): string {
  const [version, ivB64, tagB64, encB64] = stored.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !encB64) {
    throw new Error("formato de key criptografada inválido");
  }
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
