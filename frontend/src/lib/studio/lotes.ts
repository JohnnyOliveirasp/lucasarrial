/**
 * Execução com TETO DE CONCORRÊNCIA (#358, perna 2) — módulo folha, sem
 * nenhum import, pra rodar direto no `node --test` com type-stripping (mesma
 * convenção de `lib/kie/http.ts` e `lib/r2/client.ts`).
 *
 * POR QUE EXISTE: o poll do projeto do Estúdio (`GET /api/v1/studio/[id]`)
 * fazia
 *
 *     await Promise.all(pending.map((s) => syncStudioScene(s).catch(() => {})));
 *
 * onde `pending` são TODAS as cenas em `generating_still`/`animating` do
 * projeto, sem teto. Medido em produção 11/09: um projeto com 48 cenas dispara
 * até 48 chamadas simultâneas ao Kie A CADA TICK do poll — é essa rajada que
 * produz o 429. A retentativa criada no #240 ameniza o sintoma mas não remove
 * a causa: 48 chamadas paralelas retentando continuam sendo uma rajada, só que
 * mais demorada.
 *
 * Sem dependência nova de propósito (nada de `p-limit`): são 15 linhas e o
 * repo evita pacote novo pra isso.
 */

/**
 * Quebra a lista em fatias de no máximo `tamanho`, preservando a ordem.
 * `tamanho` inválido (0, negativo, fracionário) vira no mínimo 1 — devolver
 * fatia vazia aqui viraria laço infinito no chamador.
 */
export function fatiar<T>(itens: readonly T[], tamanho: number): T[][] {
  const teto = Math.max(1, Math.floor(tamanho));
  const saida: T[][] = [];
  for (let i = 0; i < itens.length; i += teto) {
    saida.push(itens.slice(i, i + teto));
  }
  return saida;
}

/**
 * Roda `fn` sobre todos os `itens` com no máximo `tamanho` execuções em voo ao
 * mesmo tempo, e devolve os resultados NA ORDEM DE ENTRADA (não na ordem de
 * término).
 *
 * ⚠️ CONTRATO COM O CHAMADOR: o lote usa `Promise.all`, então uma `fn` que
 * REJEITA derruba a rodada dela. Quem quer "uma falha não derruba o lote"
 * passa uma `fn` que não rejeita — é o que o poll do Estúdio faz, mantendo o
 * `.catch(() => {})` por cena que já existia antes deste helper. O teste
 * cobre exatamente esse uso real.
 */
export async function emLotes<T, R>(
  itens: readonly T[],
  tamanho: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const saida: R[] = [];
  for (const lote of fatiar(itens, tamanho)) {
    const base = saida.length;
    const resultados = await Promise.all(lote.map((item, i) => fn(item, base + i)));
    saida.push(...resultados);
  }
  return saida;
}
