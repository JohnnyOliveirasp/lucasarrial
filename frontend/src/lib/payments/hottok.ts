/**
 * Autenticidade do webhook da Hotmart — o token `hottok`.
 *
 * POR QUE ISTO SAIU DE DENTRO DO route.ts (03/09/2026):
 * o webhook passou a atender MAIS DE UM PRODUTO da mesma conta (o FastCloner e
 * o SGP). Se a Hotmart gerar um hottok diferente pra segunda configuração de
 * webhook, o `route.ts` devolveria 401 em TODO evento do produto novo — e a
 * configuração que o Lucas fizer no painel não valeria nada, sem nenhum sinal
 * além de um 401 mudo. Aqui a casa passa a aceitar N tokens esperados.
 *
 * ⚠️ ACEITAR N TOKENS NÃO É AFROUXAR A CHECAGEM. Continua sendo igualdade
 * exata contra uma lista FECHADA vinda do ambiente: quem não estiver na lista
 * é 401. O que muda é o tamanho da lista (1 → N), não o critério.
 *
 * O QUE A MEDIÇÃO NO NOSSO BANCO DIZ (03/09/2026, tabela `payment_events`
 * inteira, 5.424 eventos): o hottok desta conta é COMPARTILHADO entre os
 * produtos, não é um por produto. Prova: a checagem do hottok roda ANTES do
 * insert, então estar na tabela é prova de ter passado na autenticação — e lá
 * dentro há 13 eventos do produto 7283229 (SGP), 55 do 7283335 e 1 do 788921,
 * todos gravados quando só existia UM valor esperado configurado. Ou seja: o
 * mais provável é que o token não mude e `HOTMART_HOTTOK` sozinho siga
 * bastando. Esta lista é a rede de segurança pro caso contrário — se a Hotmart
 * gerar um token novo, é só somar em `HOTMART_HOTTOK_SGP` (ou na lista
 * separada por vírgula) sem tocar em código nem derrubar o produto que já
 * funciona.
 *
 * SEM ESTADO E SEM I/O de propósito (o ambiente entra por parâmetro), pra ficar
 * testável em `hottok.test.ts` — o runner `node --test` não resolve o alias
 * `@/`. Mesmo desenho de `aviso-orfao.ts` e `sgp-boas-vindas.ts`.
 */
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Nomes de ambiente lidos, em ordem de importância:
 *  - `HOTMART_HOTTOK`     — o de sempre. Aceita UM token (comportamento atual,
 *                           nada muda) ou vários separados por vírgula.
 *  - `HOTMART_HOTTOK_SGP` — opcional. Só é preciso preencher SE a Hotmart gerar
 *                           um token diferente pro webhook do SGP.
 */
export const ENVS_DO_HOTTOK = ["HOTMART_HOTTOK", "HOTMART_HOTTOK_SGP"] as const;

/**
 * Monta a lista de tokens aceitos a partir do ambiente.
 *
 * Descarta vazios de propósito: `HOTMART_HOTTOK_SGP=""` num `.env` não pode
 * virar um token válido — senão bastaria mandar o header vazio pra entrar.
 * Deduplica porque o caso normal (mesmo token nos dois produtos) não precisa
 * pagar duas comparações.
 */
export function tokensEsperados(env: Record<string, string | undefined>): string[] {
  const vistos = new Set<string>();
  for (const nome of ENVS_DO_HOTTOK) {
    for (const pedaco of (env[nome] ?? "").split(",")) {
      const t = pedaco.trim();
      if (t) vistos.add(t);
    }
  }
  return [...vistos];
}

/** SHA-256 do token. Ver `hottokValido` pra saber por que passa por hash. */
function resumo(valor: string): Buffer {
  return createHash("sha256").update(valor, "utf8").digest();
}

/**
 * O token recebido é um dos esperados?
 *
 * DUAS PROPRIEDADES QUE A VERSÃO ANTERIOR NÃO TINHA, e nenhuma delas afrouxa:
 *
 * 1. COMPARA POR RESUMO (SHA-256), não pelos bytes crus. `timingSafeEqual`
 *    explode quando os tamanhos diferem, então a versão anterior precisava de
 *    um `if (a.length !== b.length) return false` — que responde ANTES de
 *    comparar e, no tempo de resposta, entrega o TAMANHO do token certo. Como
 *    todo resumo tem 32 bytes, a comparação é sempre a mesma e esse vazamento
 *    deixa de existir. Igualdade de resumo é igualdade de token (SHA-256).
 *
 * 2. NÃO PARA NO PRIMEIRO ACERTO. Um `for` com `return true` no meio
 *    responderia mais rápido quando o acerto fosse o primeiro da lista,
 *    contando QUAL produto mandou o evento. Comparamos com TODOS os esperados,
 *    sempre, e só no fim olhamos o placar.
 *
 * Fecha por padrão: sem token recebido ou sem NENHUM esperado configurado, é
 * `false`. Ambiente mal configurado tem que virar 401 barulhento, nunca porta
 * aberta.
 */
export function hottokValido(recebido: string | null | undefined, esperados: string[]): boolean {
  if (!recebido || esperados.length === 0) return false;
  const alvo = resumo(recebido);
  let acertos = 0;
  for (const esperado of esperados) {
    if (timingSafeEqual(alvo, resumo(esperado))) acertos += 1;
  }
  return acertos > 0;
}
