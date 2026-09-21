/**
 * Monta o link de ENTRADA na conta do aluno do SGP (botão "Entrar na conta do
 * aluno" do /admin/sgp) a partir da resposta do `auth.admin.generateLink`.
 *
 * ⛔ POR QUE ESTE MÓDULO EXISTE — NÃO VOLTE PRO `action_link`.
 *
 * MEDIDO EM 20/09 contra a conta de teste da casa, com `type:"magiclink"`
 * (a cicatriz anterior, de 18/09, tinha sido medida só com `recovery` — esta
 * medição fecha a dúvida para o magiclink também). Token fresco em cada
 * caminho, nunca dividido entre os dois:
 *
 *   [A] action_link ...... 303 → /auth/callback?next=%2Fapp#access_token=…
 *                              → callback 307 → /login?error=missing_code_or_token
 *                              → SEM cookie de sessão, e o token de uso único
 *                                JÁ FOI QUEIMADO. O atendente vê um erro e o
 *                                link morreu junto.
 *   [B] token_hash na QUERY .. 307 → /app  +  Set-Cookie de sessão   ✅
 *
 * A causa: o `action_link` aponta pro `/auth/v1/verify` do Supabase, que
 * devolve a sessão no FRAGMENTO (`#access_token=…`). Fragmento NÃO viaja pro
 * servidor, e o `auth/callback/route.ts` só lê `code` (via query) ou
 * `token_hash` + `type` (via query) — qualquer outra coisa cai no
 * `missing_code_or_token`. O ramo [B] chama `verifyOtp` NO SERVIDOR, que é
 * quem grava o cookie do lado certo.
 *
 * Módulo PURO de propósito (zero imports): a regra é testável sem subir
 * Supabase nem Next.
 */

/** O pedaço de `data.properties` que nos interessa do `generateLink`. */
export type PropriedadesDoLink = {
  hashed_token?: string | null;
  /** Só referência de diagnóstico. NUNCA é devolvido como link de entrada. */
  action_link?: string | null;
} | null;

export type ResultadoLinkDeEntrada =
  | { ok: true; link: string }
  | { ok: false; erro: string };

/** Destino padrão depois que a sessão do aluno é criada. */
export const DESTINO_PADRAO = "/app";

/**
 * @param propriedades  `data.properties` devolvido pelo `generateLink`.
 * @param site          URL pública do site (barra final é tolerada).
 * @param next          Caminho interno pós-login. Qualquer coisa que não
 *                      comece com "/" é descartada em favor do padrão — o
 *                      callback faz a mesma guarda contra open-redirect.
 */
export function montarLinkDeEntrada(
  propriedades: PropriedadesDoLink,
  site: string,
  next: string = DESTINO_PADRAO,
): ResultadoLinkDeEntrada {
  const base = (site ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return { ok: false, erro: "Sem URL do site para montar o link de entrada" };
  }

  const hashed = propriedades?.hashed_token?.trim() ?? "";
  if (!hashed) {
    // Falha ALTA e explícita. Cair no `action_link` calado entregaria um link
    // que queima o token e joga o atendente em /login?error=… (medido acima).
    return {
      ok: false,
      erro:
        "O Supabase não devolveu `hashed_token` — sem ele não dá para montar o " +
        "link de entrada. (O `action_link` não serve: ele entrega a sessão no " +
        "fragmento da URL, que o callback não lê, e queima o token de uso único.)",
    };
  }

  const destino = next.startsWith("/") ? next : DESTINO_PADRAO;

  const link =
    `${base}/auth/callback` +
    `?token_hash=${encodeURIComponent(hashed)}` +
    `&type=magiclink` +
    `&next=${encodeURIComponent(destino)}`;

  return { ok: true, link };
}
