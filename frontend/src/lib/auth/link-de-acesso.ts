/**
 * O link de primeiro acesso / recuperação de senha que a casa manda pro aluno.
 *
 * ⛔ NUNCA MANDE `data.properties.action_link` PRO ALUNO.
 *
 * MEDIDO EM PRODUÇÃO em 18/09/2026 ~22h50Z (incidente #438): o `action_link`
 * aponta pro `/auth/v1/verify` do Supabase, que responde **303 com a sessão no
 * FRAGMENTO da URL** (`#access_token=…`). Fragmento não viaja pro servidor, e o
 * nosso `auth/callback/route.ts` só lê `code`/`token_hash` da QUERY — então ele
 * cai no ramo final e manda o aluno pra `/login?error=missing_code_or_token`
 * com o token de uso único **JÁ QUEIMADO**. O aluno vê um erro e o link dele
 * morre junto. Foi assim que 14 alunos PAGANTES ficaram sem entrar, um deles
 * por 14 dias.
 *
 * O caminho que FUNCIONA é o `data.properties.hashed_token` na QUERY: o
 * callback cai no ramo do `verifyOtp({ token_hash, type })`, que roda NO
 * SERVIDOR e grava o cookie de sessão do lado certo.
 *
 * Medição lado a lado, com token FRESCO em CADA caminho:
 *
 *   [A] action_link ......... 303 → /auth/callback?next=…#access_token=…
 *                                 → /login?error=missing_code_or_token
 *   [B] token_hash na QUERY .. 307 → /reset-password
 *                                 + Set-Cookie sb-<proj>-auth-token   ✅
 *
 * Controle positivo: o caminho [B] rodado na conta da casa
 * (suporte@fastcloner.com) carimbou `last_sign_in_at` em
 * 2026-09-18T22:47:22Z.
 *
 * ⚠️ ARMADILHA AO RETESTAR: se você testar [A] e [B] com o MESMO token, o [A]
 * queima o token e o [B] responde "Email link is invalid or has expired" — e
 * parece que o conserto não funciona. Gere um token NOVO pra cada caminho.
 *
 * O conserto mora em quem MONTA o link, não em quem o recebe: o ramo
 * `token_hash` do `auth/callback/route.ts` já funciona e não foi tocado.
 */
import type { EmailOtpType } from "@supabase/supabase-js";

/** Pra onde o aluno vai depois que a sessão é gravada. */
export const DESTINO_DEFINIR_SENHA = "/reset-password";

/**
 * Validade do token de recovery/magiclink do Supabase, em minutos. É o mesmo
 * número que o endpoint de admin devolve como `expires_in_minutes`.
 */
export const VALIDADE_LINK_MINUTOS = 60;

/**
 * Monta o link de acesso a partir do `hashed_token` devolvido pelo
 * `auth.admin.generateLink`.
 *
 * Não valida o token (só o Supabase sabe se ele vale) — valida só o que dá pra
 * errar aqui: token vazio e `next` externo. `next` que não começa com "/"
 * viraria open-redirect; o callback já se protege disso, mas montar um link
 * sabidamente inútil e mandar pro aluno é pior do que estourar aqui.
 */
export function montarLinkDeAcesso(opts: {
  /** Base pública do site, ex.: "https://fastcloner.com". */
  site: string;
  /** `data.properties.hashed_token` do `generateLink`. */
  hashedToken: string;
  /** Precisa bater com o `type` usado no `generateLink`. */
  type: EmailOtpType;
  /** Caminho interno de destino. Default: a tela de definir senha. */
  next?: string;
}): string {
  const hashedToken = opts.hashedToken?.trim() ?? "";
  if (!hashedToken) {
    throw new Error("montarLinkDeAcesso: hashed_token vazio");
  }

  const next = opts.next ?? DESTINO_DEFINIR_SENHA;
  if (!next.startsWith("/")) {
    throw new Error(`montarLinkDeAcesso: 'next' precisa ser caminho interno: ${next}`);
  }

  const site = opts.site.replace(/\/+$/, "");
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: opts.type,
    next,
  });
  return `${site}/auth/callback?${params.toString()}`;
}
