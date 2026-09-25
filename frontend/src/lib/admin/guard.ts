/**
 * Gate de admin do /admin. Server-only.
 *
 * Admin = e-mail na tabela `admin_emails` (gerenciável pela própria tela) OU na
 * env `ADMIN_EMAILS` (fallback de bootstrap — nunca trava o acesso se a tabela
 * estiver vazia/indisponível). A allowlist da tabela é a fonte editável.
 *
 * PAPÉIS (mig 95, pedido do Johnny 24/08):
 *   admin   → painel inteiro, inclusive dinheiro.
 *   suporte → SÓ Falhas + SGP + Agente. Quem é gerente de suporte não precisa
 *             ver faturamento, lucro nem a base de usuários pra fazer o
 *             trabalho. A lista que MANDA é `roles` em lib/admin/nav.ts —
 *             este comentário só descreve; ao mudar lá, atualize aqui.
 * Quem entra pela env é sempre `admin` (bootstrap não tem como ter papel).
 */
import { getAdmin } from "@/lib/db/admin";
import { isAdminEmail } from "@/lib/api/auth";
import {
  resolverPapel,
  type AdminRole,
  type GuardDeps,
  type PapelResolvido,
} from "./guard-pure";

export type { AdminRole };

/** Ligação da decisão pura (guard-pure.ts) com o mundo real (env + Supabase). */
const depsReais: GuardDeps = {
  isAdminEmail,
  selectComRole: async (e) => {
    const { data, error } = await getAdmin()
      .from("admin_emails")
      .select("email, role")
      .eq("email", e)
      .maybeSingle();
    return { data, error };
  },
  // Coluna `role` ainda não existe (deploy chegou antes da mig 95): o SELECT
  // com role falha inteiro e TODO admin viraria não-admin — o painel sumiria
  // pra todos. O select legado (allowlist binária) segue como fallback.
  selectLegado: async (e) => {
    const { data, error } = await getAdmin()
      .from("admin_emails")
      .select("email")
      .eq("email", e)
      .maybeSingle();
    return { data, error };
  },
};

/**
 * Papel do e-mail com HONESTIDADE de erro: distingue "não tem papel"
 * (ok:true, role:null) de "não consegui verificar" (ok:false). A rota de API
 * (gateAdmin) usa este formato pra responder 503 em vez de mentir 403 quando
 * o banco falha — defeito medido em 21/09.
 */
export async function adminRoleDetalhado(
  email: string | null | undefined,
): Promise<PapelResolvido> {
  return resolverPapel(email, depsReais);
}

/** Papel do e-mail, ou null se não for admin nenhum. */
export async function adminRole(email: string | null | undefined): Promise<AdminRole | null> {
  const r = await adminRoleDetalhado(email);
  // Erro de consulta FECHA (null) aqui de propósito: os chamadores deste
  // formato (isAdmin nos recursos que gastam dinheiro, layouts) só sabem
  // sim/não, e fechado é o lado seguro. Quem precisa distinguir e responder
  // 503 usa adminRoleDetalhado — NÃO troque esta linha por afrouxamento.
  return r.ok ? r.role : null;
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
