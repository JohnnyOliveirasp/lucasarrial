/**
 * Gate do Publicador: enquanto o App Review da Meta não aprova, TUDO
 * (conectar, publicar, botões na UI) fica restrito a admin — mesmo padrão
 * do grupo pré-produção do sidebar. Aprovou → este helper vira `return true`
 * e o produto abre pros alunos sem mexer em mais nada.
 *
 * Exceção: o LOGIN DE TESTE do revisor da Meta (App Review) entra na
 * allowlist SEM ganhar admin — ele só enxerga o Publicador.
 */
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";

const REVIEWER_EMAILS = new Set(["meta.reviewer@fastcloner.com"]);

/**
 * Liberações individuais (modelo travado 13/08: aluno PEDE → a gente liga só
 * pra ele; a chave geral continua sendo a aprovação do App Review da Meta).
 * 13/08: contas do Lucas liberadas por ordem do Johnny (post no Instagram).
 */
const ALLOWED_EMAILS = new Set([
  "lucas.m.arrial@gmail.com",
  "lucas@lucasarrial.com",
  "lucasarrial@gmail.com",
]);

/** E-mail pode usar o Publicador? (admin OU revisor OU liberação individual) */
export async function socialPublisherAllowedEmail(email: string | null): Promise<boolean> {
  const low = email?.toLowerCase() ?? "";
  if (low && (REVIEWER_EMAILS.has(low) || ALLOWED_EMAILS.has(low))) return true;
  return isAdmin(email);
}

export async function socialPublisherEnabled(userId: string): Promise<boolean> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return socialPublisherAllowedEmail((data as { email: string | null } | null)?.email ?? null);
}
