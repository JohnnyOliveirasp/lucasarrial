import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { ConsentGate } from "@/components/app/consent-gate";
import { createClient } from "@/lib/supabase/server";
import { hasActiveAccess, bypassesBilling } from "@/lib/credits/access";

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
    .select("id, email, display_name, avatar_url, plan, access_until, credits_subscription, credits_extra")
    .eq("id", user.id)
    .single();

  // Gate de assinatura: sem acesso ativo (e fora da allowlist) → tela de planos.
  // É aqui que "quem não pagou não entra". Equipe (Johnny/Lucas/Edu) passa direto.
  const email = profile?.email ?? user.email ?? null;
  if (!hasActiveAccess(email, profile?.access_until)) {
    redirect(`/${locale}/planos`);
  }

  const unlimited = bypassesBilling(email);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-[260px_1fr] bg-bg">
      <Sidebar />
      <div className="flex flex-col">
        <Topbar
          email={profile?.email ?? user.email ?? ""}
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          creditsTotal={creditsTotal}
          unlimited={unlimited}
        />
        <main className="flex-1 px-6 py-10 lg:px-12">{children}</main>
      </div>
      <ConsentGate />
    </div>
  );
}
