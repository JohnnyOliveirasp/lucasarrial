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

/** E-mail pode usar o Publicador? (admin OU login de teste do revisor) */
export async function socialPublisherAllowedEmail(email: string | null): Promise<boolean> {
  if (email && REVIEWER_EMAILS.has(email.toLowerCase())) return true;
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
