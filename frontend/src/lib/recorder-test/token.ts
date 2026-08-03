/**
 * 🧪 Lab · Gravador pelo Celular — token STATELESS do handoff desktop→celular.
 * Sem tabela nova: o link do celular carrega `userId.exp.hmac` assinado com
 * chave derivada do service key. Expira em 2h. Server-only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 2 * 60 * 60 * 1000;

function key(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createHmac("sha256", "recorder-test-v1").update(base).digest("hex");
}

function sig(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("hex").slice(0, 24);
}

const b64u = {
  enc: (s: string) => Buffer.from(s, "utf8").toString("base64url"),
  dec: (s: string) => Buffer.from(s, "base64url").toString("utf8"),
};

export function signRecorderToken(userId: string): string {
  const payload = `${userId}.${Date.now() + TTL_MS}`;
  return `${b64u.enc(payload)}.${sig(payload)}`;
}

/** userId se o token é válido e não expirou; null caso contrário. */
export function verifyRecorderToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  let payload: string;
  try {
    payload = b64u.dec(token.slice(0, dot));
  } catch {
    return null;
  }
  const given = token.slice(dot + 1);
  const want = sig(payload);
  if (given.length !== want.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(want))) return null;
  const [userId, expStr] = payload.split(".");
  if (!userId || !expStr || Date.now() > Number(expStr)) return null;
  return userId;
}

/** Prefixo R2 (bucket voices) dos takes desta sessão de teste. */
export function recorderPrefix(userId: string, token: string): string {
  // hash curto do token = "pasta da sessão" (novo QR = pasta nova)
  const h = createHmac("sha256", "recorder-dir").update(token).digest("hex").slice(0, 10);
  return `${userId}/recorder-test/${h}/`;
}
