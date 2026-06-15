/**
 * Gate de admin do /admin. Server-only.
 *
 * Admin = e-mail na tabela `admin_emails` (gerenciável pela própria tela) OU na
 * env `ADMIN_EMAILS` (fallback de bootstrap — nunca trava o acesso se a tabela
 * estiver vazia/indisponível). A allowlist da tabela é a fonte editável.
 */
import { getAdmin } from "@/lib/db/admin";
import { isAdminEmail } from "@/lib/api/auth";

export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (isAdminEmail(e)) return true; // fallback env

  const { data } = await getAdmin()
    .from("admin_emails")
    .select("email")
    .eq("email", e)
    .maybeSingle();
  return !!data;
}

/**
 * Resolve o usuário logado e diz se é admin. Usa o client de SESSÃO (cookie)
 * pra pegar o e-mail autenticado, e a allowlist pra autorizar.
 */
export async function getAdminContext(): Promise<{
  userId: string;
  email: string;
} | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  if (!(await isAdmin(user.email))) return null;
  return { userId: user.id, email: user.email };
}
