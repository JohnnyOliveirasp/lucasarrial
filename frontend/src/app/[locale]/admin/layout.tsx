import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { adminRole } from "@/lib/admin/guard";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { AdminRoleGate } from "@/components/admin/admin-role-gate";

/**
 * Gate do /admin (server-side). Não-admin recebe 404 — o painel nem revela que
 * existe. Allowlist na tabela admin_emails (gerenciável) + fallback env.
 *
 * PAPEL (mig 95): quem é `suporte` entra, mas só enxerga Falhas, SGP e Agente —
 * o menu vem filtrado e o AdminRoleGate barra a URL digitada na mão. A trava que
 * vale é a das rotas de API (gateAdmin); esta camada é menu e recado.
 * A lista que MANDA é `roles` em lib/admin/nav.ts — este comentário só descreve.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) notFound();
  const role = await adminRole(user.email);
  if (!role) notFound();

  return (
    <div className="min-h-svh bg-[var(--canvas)]">
      <AdminTopbar email={user.email} role={role} />
      <main className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
        <AdminRoleGate role={role}>{children}</AdminRoleGate>
      </main>
    </div>
  );
}
