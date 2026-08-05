/**
 * Gate do Publicador: enquanto o App Review da Meta não aprova, TUDO
 * (conectar, publicar, botões na UI) fica restrito a admin — mesmo padrão
 * do grupo pré-produção do sidebar. Aprovou → este helper vira `return true`
 * e o produto abre pros alunos sem mexer em mais nada.
 */
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";

export async function socialPublisherEnabled(userId: string): Promise<boolean> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return isAdmin((data as { email: string | null } | null)?.email ?? null);
}
