/**
 * SGP — LINK DE RETOMADA. Server-only, **sem tabela nova**.
 *
 * O PROBLEMA (caso welrisson@, 09/09): o dono do pedido é um cookie httpOnly
 * (`lib/sgp/sessao.ts`). Perdeu o cookie — trocou de navegador, limpou os
 * dados, abriu no celular — e o pedido fica órfão: não há tela, botão ou login
 * que devolva o aluno pra ele. A única saída que existia era pedir pro cliente
 * colar um uuid no DevTools, o que não é saída nenhuma.
 *
 * COMO FUNCIONA: o token é `base64url(sessao.exp)~hmac`, assinado com chave
 * derivada do service key — mesmo desenho do handoff do gravador
 * (`lib/recorder-test/token.ts`), que já roda em produção. Stateless: nada é
 * gravado, nada precisa de migration.
 *
 * VALIDADE LONGA (30 dias, igual ao cookie): link de acesso que vence rápido
 * já nos custou caro uma vez — a leva de 04/09 mandou link de 1 hora e 341 de
 * 349 pessoas nunca entraram. E aqui o vencimento também **não é beco sem
 * saída**: token vencido cai na tela 1 com aviso, e a tela 1 sabe retomar o
 * pedido pelo e-mail (ver `POST /api/v1/sgp/inicio`).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** 30 dias — o mesmo fôlego do cookie `sgp_sessao` (MAX_IDADE em sessao.ts). */
export const RETOMADA_VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

function chave(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createHmac("sha256", "sgp-retomada-v1").update(base).digest("hex");
}

function assinatura(payload: string): string {
  return createHmac("sha256", chave()).update(payload).digest("hex").slice(0, 32);
}

const b64u = {
  enc: (s: string) => Buffer.from(s, "utf8").toString("base64url"),
  dec: (s: string) => Buffer.from(s, "base64url").toString("utf8"),
};

export function assinarRetomada(sessao: string, agora = Date.now()): string {
  const payload = `${sessao}.${agora + RETOMADA_VALIDADE_MS}`;
  // Separador "~" e não ".": o matcher do middleware ignora URL com ponto
  // (trata como arquivo estático). Mesma pegadinha do gravador.
  return `${b64u.enc(payload)}~${assinatura(payload)}`;
}

export type RetomadaInvalida = "invalido" | "vencido";

/**
 * A sessão, quando o token é nosso e ainda vale. Devolve o MOTIVO da recusa em
 * vez de só `null` — a tela 1 precisa distinguir "esse link não é nosso" de
 * "esse link venceu, peça outro", senão vira de novo mensagem inútil.
 */
export function verificarRetomada(
  token: unknown,
  agora = Date.now(),
): { sessao: string } | { erro: RetomadaInvalida } {
  if (typeof token !== "string" || !token) return { erro: "invalido" };
  const corte = token.lastIndexOf("~");
  if (corte < 1) return { erro: "invalido" };

  let payload: string;
  try {
    payload = b64u.dec(token.slice(0, corte));
  } catch {
    return { erro: "invalido" };
  }

  const dado = token.slice(corte + 1);
  const esperado = assinatura(payload);
  if (dado.length !== esperado.length) return { erro: "invalido" };
  if (!timingSafeEqual(Buffer.from(dado), Buffer.from(esperado))) return { erro: "invalido" };

  const [sessao, expStr] = payload.split(".");
  if (!sessao || !/^[0-9a-f-]{36}$/i.test(sessao)) return { erro: "invalido" };
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return { erro: "invalido" };
  // Assinatura confere: daqui pra frente o erro é "vencido", que tem conserto
  // na tela (pedir link novo) — e não "invalido", que soa como culpa do aluno.
  if (agora > exp) return { erro: "vencido" };
  return { sessao };
}

/**
 * O link pronto pro suporte colar no e-mail. `null` quando falta
 * NEXT_PUBLIC_SITE_URL/SITE_URL — melhor devolver nada do que devolver um link
 * quebrado pra alguém mandar pro cliente.
 */
export function linkDeRetomada(sessao: string, agora = Date.now()): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/v1/sgp/retomar?token=${encodeURIComponent(assinarRetomada(sessao, agora))}`;
}
