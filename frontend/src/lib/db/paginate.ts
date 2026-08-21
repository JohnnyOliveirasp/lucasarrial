/**
 * Paginação obrigatória pra .select() que alimenta guarda ou agregação.
 *
 * Por que existe: o PostgREST corta QUALQUER .select() sem .range() em 1000
 * linhas EM SILÊNCIO — sem erro, sem aviso. Incidente 72a4c9db (04–19/08):
 * a guarda hasAccount do orphan-outreach via só 1000 dos 1294 profiles e
 * mandou "crie sua conta" pra 105 clientes ATIVOS. O mesmo teto deixou o
 * churn do /admin cego pra ~99 compras (payment_events passou de 1000
 * PURCHASE_APPROVED em 19/08).
 *
 * Contrato:
 * - `queryPage` DEVE aplicar uma ordem ESTÁVEL e única (ex.: .order("id"),
 *   ou a PK composta coluna a coluna) — sem isso as páginas podem repetir
 *   ou pular linhas entre requisições.
 * - Falha ABORTA (throw). Guarda que degrada pra lista vazia é exatamente o
 *   que transformou cliente ativo em "órfão" no incidente acima.
 */
export async function fetchAllPages<T>(
  label: string,
  queryPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryPage(from, from + pageSize - 1);
    if (error) throw new Error(`[paginate] ${label}: ${error.message}`);
    all.push(...(data ?? []));
    // Página incompleta = acabou. Página cheia = pode haver mais.
    if (!data || data.length < pageSize) break;
  }
  return all;
}
