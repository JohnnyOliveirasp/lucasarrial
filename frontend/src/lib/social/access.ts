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

export type PlataformaSocial = "instagram" | "tiktok";

/**
 * A chave é POR PLATAFORMA (correção do Johnny 21/09: "só libera o Instagram,
 * o TikTok ainda não foi liberado"). As duas moravam no mesmo portão, então
 * abrir o Instagram abria o TikTok junto — que não passou por review nenhum.
 */
const ABERTO: Record<PlataformaSocial, boolean> = {
  instagram: true, // Meta aprovou o content_publish em 05/09/2026
  tiktok: false, // sem aprovação — segue admin + allowlist
};

/** Regra antiga: admin, revisor da Meta ou liberação individual. */
async function liberadoPorPessoa(email: string | null): Promise<boolean> {
  const low = email?.toLowerCase() ?? "";
  if (low && (REVIEWER_EMAILS.has(low) || ALLOWED_EMAILS.has(low))) return true;
  return isAdmin(email);
}

/** Pode usar ESTA plataforma? */
export async function socialPublisherAllowedEmailFor(
  plataforma: PlataformaSocial,
  email: string | null,
): Promise<boolean> {
  if (ABERTO[plataforma]) return true;
  return liberadoPorPessoa(email);
}

/** Pode abrir o Publicador (qualquer plataforma)? Decide menu e rotas comuns. */
export async function socialPublisherAllowedEmail(email: string | null): Promise<boolean> {
  if (Object.values(ABERTO).some(Boolean)) return true;
  return liberadoPorPessoa(email);
}

/** Versão por plataforma a partir do user_id (usada pelas rotas do TikTok). */
export async function socialPublisherEnabledFor(
  plataforma: PlataformaSocial,
  userId: string,
): Promise<boolean> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return socialPublisherAllowedEmailFor(plataforma, (data as { email: string | null } | null)?.email ?? null);
}

export async function socialPublisherEnabled(userId: string): Promise<boolean> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return socialPublisherAllowedEmail((data as { email: string | null } | null)?.email ?? null);
}
