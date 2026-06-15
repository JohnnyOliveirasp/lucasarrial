import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { AdminTopbar } from "@/components/admin/admin-topbar";

/**
 * Gate do /admin (server-side). Não-admin recebe 404 — o painel nem revela que
 * existe. Allowlist na tabela admin_emails (gerenciável) + fallback env.
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
  if (!(await isAdmin(user.email))) notFound();

  return (
    <div className="min-h-svh bg-[var(--canvas)]">
      <AdminTopbar email={user.email} />
      <main className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
        {children}
      </main>
    </div>
  );
}
