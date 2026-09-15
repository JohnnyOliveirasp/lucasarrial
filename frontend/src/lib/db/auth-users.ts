/**
 * Varredura paginada de `auth.users` (Supabase Admin API).
 *
 * Por que existe: `auth.admin.listUsers()` devolve NO MÁXIMO `perPage` contas
 * (teto do servidor: 1000) e NÃO avisa que cortou — igualzinho ao teto de 1000
 * do PostgREST que já causou o incidente 72a4c9db (ver `paginate.ts`). Quem
 * chama com uma página só enxerga as primeiras 1000 contas e trata TODO o
 * resto como inexistente.
 *
 * Medido em 12/09: a base tem 2.542 contas. Uma busca de 1 página cegava 1.542
 * delas — `ederonline1@gmail.com` e `smilefastrio@gmail.com` voltavam "conta
 * não encontrada" existindo em `auth.users`. Falso negativo puro.
 *
 * Contrato (regra `consulta que erra volta vazia`, _frank/03_ROTINA.md):
 * - lê PÁGINA POR PÁGINA até vir uma incompleta — só aí a base acabou;
 * - erro da API ABORTA (throw). Lista vazia por falha é o que transforma
 *   cliente que existe em "não encontrado";
 * - estourar o teto de sanidade também ABORTA, em vez de devolver metade da
 *   base como se fosse ela inteira.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Teto por página imposto pelo GoTrue; pedir mais não traz mais. */
export const AUTH_PAGE_SIZE = 1000;

/**
 * Teto de sanidade, NÃO de negócio: 50 páginas = 50.000 contas. Existe só pra
 * um bug de paginação (servidor devolvendo sempre página cheia) não virar
 * laço infinito. Bater nele é erro, nunca resultado parcial silencioso.
 */
const MAX_PAGES = 50;

/**
 * Lê TODAS as contas de `auth.users`.
 *
 * @param admin cliente service_role (`getAdmin()`)
 * @param label aparece na mensagem de erro, pra saber quem estourou
 * @throws se a API falhar ou se a base passar de `MAX_PAGES * AUTH_PAGE_SIZE`
 */
export async function fetchAllAuthUsers(
  admin: Pick<SupabaseClient, "auth">,
  label = "auth.users",
): Promise<User[]> {
  const todos: User[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_PAGE_SIZE,
    });
    if (error) {
      throw new Error(`[auth-users] ${label}: página ${page} falhou: ${error.message}`);
    }
    const users = data?.users ?? [];
    todos.push(...users);
    // Página incompleta = acabou a base. Página cheia = pode haver mais.
    if (users.length < AUTH_PAGE_SIZE) return todos;
  }
  throw new Error(
    `[auth-users] ${label}: a base passou de ${MAX_PAGES * AUTH_PAGE_SIZE} contas ` +
      `(${MAX_PAGES} páginas cheias). Abortando em vez de responder com a base pela metade.`,
  );
}

/** Mapa `user_id -> email` da base inteira. Mesmas garantias de cima. */
export async function fetchAuthEmailsById(
  admin: Pick<SupabaseClient, "auth">,
  label = "auth.users",
): Promise<Map<string, string>> {
  const porId = new Map<string, string>();
  for (const u of await fetchAllAuthUsers(admin, label)) {
    if (u.email) porId.set(u.id, u.email);
  }
  return porId;
}
