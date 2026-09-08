/**
 * Núcleo PURO da decisão de acesso — sem nenhum import.
 *
 * Por que existe um módulo separado: `access.ts` importa `@/lib/api/auth`, que
 * arrasta `next/server` e o cliente do Supabase. O runner de teste do repo
 * (`node --test`) não resolve o alias `@/`, então a regra mais crítica da
 * plataforma ficava sem como ser testada. Aqui a lógica fica isolada e
 * verificável; `access.ts` continua sendo a porta de entrada pública.
 *
 * A REGRA (contrato que o banco já documentava e o gate nunca implementou):
 *
 *   scripts/12_payments.sql:14
 *     "Fim do acesso pago. NULL = sem acesso, OU vitalício quando
 *      access_source preenchido. Cache de entitlements."
 *
 * Ou seja, `profiles.access_until = NULL` é AMBÍGUO sozinho e só se resolve
 * olhando `access_source`:
 *
 *   access_until preenchido            -> vale a data (futuro = tem, passado = não)
 *   access_until NULL + source != NULL -> VITALÍCIO (compra avulsa)  => tem acesso
 *   access_until NULL + source  = NULL -> nunca teve / perdeu        => sem acesso
 *
 * Isso é exatamente o que `recomputeProfileAccess` (lib/payments/entitlements.ts)
 * grava: quando acha entitlement válido escreve `plan='pro'` + `access_source`;
 * quando não acha, escreve `plan='free'` + `access_source=NULL`. Logo o par
 * (source preenchido, until NULL) só nasce de um entitlement 'active' vitalício
 * — `canceled` + NULL é filtrado lá e continua significando "acabou".
 */

/** Valor de texto que existe de fato (não nulo e não só espaço). */
function preenchido(valor: string | null | undefined): boolean {
  return valor != null && String(valor).trim() !== "";
}

/**
 * A janela de acesso pago está aberta?
 *
 * @param accessUntil  profiles.access_until (ISO) — NULL = sem data
 * @param accessSource profiles.access_source ('hotmart' | 'mercadopago' | NULL)
 * @param agora        injetável só pra teste determinístico
 */
export function janelaDeAcessoAberta(
  accessUntil: string | null | undefined,
  accessSource?: string | null,
  agora: number = Date.now(),
): boolean {
  if (preenchido(accessUntil)) {
    const fim = new Date(accessUntil as string).getTime();
    // Data ilegível não vira acesso: na dúvida o gate FECHA (mesmo
    // comportamento de antes, onde NaN > agora já era false).
    if (Number.isNaN(fim)) return false;
    return fim > agora;
  }
  // Sem data: só é vitalício se algum provedor tiver liberado o acesso.
  return preenchido(accessSource);
}

/**
 * Decisão final de acesso, já com o bypass resolvido pelo chamador.
 * Separado de `hasActiveAccess` porque `bypassesBilling` depende de
 * `isAdminEmail`, que mora atrás do alias `@/` e não roda no teste.
 */
export function decidirAcesso(
  bypass: boolean,
  accessUntil: string | null | undefined,
  accessSource?: string | null,
  agora: number = Date.now(),
): boolean {
  // Equipe/admin ganha de tudo, em qualquer combinação de data/origem.
  if (bypass) return true;
  return janelaDeAcessoAberta(accessUntil, accessSource, agora);
}

/** Default da allowlist de cortesia. Decidido 2026-06-08: só Johnny, Lucas e Edu. */
export const ALLOWLIST_PADRAO =
  "johnny.oliveirasp@gmail.com,lucas.m.arrial@gmail.com,eduardo@lucasarrial.com";

/** E-mail liberado por cortesia (equipe). `env` é injetável pra teste. */
export function emailNaAllowlist(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!email) return false;
  const lista = (env.COMP_ACCESS_EMAILS ?? ALLOWLIST_PADRAO)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}
