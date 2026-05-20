import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, plan")
    .eq("id", user.id)
    .single();

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-[260px_1fr] bg-bg">
      <Sidebar />
      <div className="flex flex-col">
        <Topbar
          email={profile?.email ?? user.email ?? ""}
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <main className="flex-1 px-6 py-10 lg:px-12">{children}</main>
      </div>
    </div>
  );
}
