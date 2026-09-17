/**
 * Classificação do erro do RPC de estorno — lógica PURA.
 *
 * Mora FORA de `refund.ts` porque aquele módulo é server-only (importa
 * `@/lib/db/admin`) e o teste desta decisão precisa rodar no `node --test`
 * pelado, sem o alias `@/`. Mesmo padrão do `rajada-nasce-fechada.ts` em
 * `support/failure-alert.ts`.
 *
 * ⚠️ PONTE TEMPORÁRIA (#446). Existe só porque o commit 0776768 (14/09) subiu
 * na main o CHAMADOR de `zero_subscription_credits_on_refund` sem a DDL que
 * cria a função (`scripts/111_estorno_zera_credito.sql`, parada aguardando aval
 * do Johnny porque mexe em dinheiro de aluno). Quando a 111 for aplicada, a
 * função passa a existir, `rpcFuncaoAusente` nunca mais devolve `true` e este
 * arquivo inteiro vira código morto — remover junto com o caminho de
 * `MOTIVO_RPC_AUSENTE` em `refund.ts` e no webhook.
 */

/** Nome da função de banco que o estorno chama. */
export const RPC_ESTORNO = "zero_subscription_credits_on_refund";

/** Prefixo do `reason` que marca "a função não existe no banco". */
export const PREFIXO_RPC_AUSENTE = "rpc_ausente:";

/** O `reason` exato devolvido quando a função não existe. */
export const MOTIVO_RPC_AUSENTE = `${PREFIXO_RPC_AUSENTE}${RPC_ESTORNO}`;

/** O formato do erro que PostgREST/supabase-js devolve em `{ data, error }`. */
export type ErroRpc = { code?: string | null; message?: string | null } | null | undefined;

/**
 * "A função não existe" e SÓ isso. A estreiteza é o ponto do #446: rede,
 * timeout, permissão e deadlock são falhas TRANSITÓRIAS e precisam continuar
 * lançando, pra o webhook devolver 500 e a Hotmart reenviar. Generalizar o
 * catch aqui trocaria um defeito visível por perda silenciosa de estorno.
 *
 *  · `PGRST202` — PostgREST não achou a função no schema cache (é o código que
 *    produção está devolvendo hoje, medido em 2 de 2 eventos desde 14/09);
 *  · `42883`    — `undefined_function` do próprio Postgres;
 *  · mensagem com "Could not find the function" — mesma condição quando o
 *    `code` vem vazio.
 */
export function rpcFuncaoAusente(error: ErroRpc): boolean {
  if (!error) return false;
  const code = (error.code ?? "").trim();
  if (code === "PGRST202" || code === "42883") return true;
  return (error.message ?? "").includes("Could not find the function");
}

/** O `reason` de um `ok:false` veio da função ausente? (lido no webhook) */
export function motivoEhRpcAusente(reason: string | null | undefined): boolean {
  return (reason ?? "").startsWith(PREFIXO_RPC_AUSENTE);
}
