/**
 * Gate do Publicador — ABERTO PRA TODO MUNDO desde 21/09 (ordem do Johnny).
 *
 * O que destravou: a Meta APROVOU a submissão de 05/09/2026 —
 * `instagram_business_content_publish` = Approved e `instagram_business_basic`
 * = Renewed, app Published, nenhuma ação pendente em "Required actions"
 * (conferido no painel developers.facebook.com/apps/4656341101352201). A
 * reprovação de 20/08 era do SCREENCAST, não do produto.
 *
 * ⚠️ O que ainda NÃO foi provado: a única publicação da história (27/08,
 * `johnny.oliveira.ai`) saiu de uma conta com papel de testador no app da
 * Meta. Ninguém de fora publicou ainda, e a lista de permissões mostra
 * "Verification required" (verificação do NEGÓCIO) nas duas permissões,
 * inclusive na que já funciona. Se a primeira publicação de aluno falhar com
 * erro da Meta, o caminho de volta é uma linha: trocar o `return true` por
 * `isAdmin(email)`.
 *
 * A allowlist e o e-mail do revisor ficam aqui de propósito: se a chave geral
 * for fechada de novo, eles continuam valendo sem precisar reescrever nada.
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

/** Chave geral: true = Publicador aberto a qualquer aluno (Meta aprovou 05/09). */
const APROVADO_PELA_META = true;

/** E-mail pode usar o Publicador? */
export async function socialPublisherAllowedEmail(email: string | null): Promise<boolean> {
  if (APROVADO_PELA_META) return true;
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
