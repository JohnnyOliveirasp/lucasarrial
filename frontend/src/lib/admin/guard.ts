/**
 * Gate de admin do /admin. Server-only.
 *
 * Admin = e-mail na tabela `admin_emails` (gerenciável pela própria tela) OU na
 * env `ADMIN_EMAILS` (fallback de bootstrap — nunca trava o acesso se a tabela
 * estiver vazia/indisponível). A allowlist da tabela é a fonte editável.
 *
 * PAPÉIS (mig 95, pedido do Johnny 24/08):
 *   admin   → painel inteiro, inclusive dinheiro.
 *   suporte → SÓ Falhas + Agente. Quem é gerente de suporte não precisa ver
 *             faturamento, lucro nem a base de usuários pra fazer o trabalho.
 * Quem entra pela env é sempre `admin` (bootstrap não tem como ter papel).
 */
import { getAdmin } from "@/lib/db/admin";
import { isAdminEmail } from "@/lib/api/auth";

export type AdminRole = "admin" | "suporte";

/** Papel do e-mail, ou null se não for admin nenhum. */
export async function adminRole(email: string | null | undefined): Promise<AdminRole | null> {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (isAdminEmail(e)) return "admin"; // fallback env

  const { data, error } = await getAdmin()
    .from("admin_emails")
    .select("email, role")
    .eq("email", e)
    .maybeSingle();

  // Coluna `role` ainda não existe (deploy chegou antes da mig 95): o SELECT
  // falha inteiro e TODO admin viraria não-admin — o painel sumiria pra todos.
  // Cai pro comportamento antigo (allowlist binária) até a migration rodar.
  if (error) {
    const { data: legado } = await getAdmin()
      .from("admin_emails")
      .select("email")
      .eq("email", e)
      .maybeSingle();
    return legado ? "admin" : null;
  }
  if (!data) return null;
  // Linha sem papel = admin, como sempre foi.
  return (data as { role?: string }).role === "suporte" ? "suporte" : "admin";
}

/**
 * ADMIN CHEIO — mantém o significado que sempre teve.
 *
 * ⚠️ NÃO troque por `adminRole(...) !== null`. Esta função não guarda só o
 * /admin: ela guarda os recursos admin-only do PRODUTO (lab/react, lab/virais,
 * gravador-celular, estúdio, edição, tier admin do video-clone, publicador
 * social) — vários deles gastam dinheiro por clique. Papel `suporte` não entra
 * em nada disso; quem quer "qualquer papel" chama `adminRole` direto, como faz
 * o layout do /admin.
 */
export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  return (await adminRole(email)) === "admin";
}

/**
 * Resolve o usuário logado e diz se é admin. Usa o client de SESSÃO (cookie)
 * pra pegar o e-mail autenticado, e a allowlist pra autorizar.
 */
export async function getAdminContext(): Promise<{
  userId: string;
  email: string;
  role: AdminRole;
} | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const role = await adminRole(user.email);
  if (!role) return null;
  return { userId: user.id, email: user.email, role };
}
