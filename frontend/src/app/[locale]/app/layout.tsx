import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { ConsentGate } from "@/components/app/consent-gate";
import { PresencePinger } from "@/components/admin/presence-pinger";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { isAdmin } from "@/lib/admin/guard";

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

  // Entrada LIVRE: todo usuário logado entra na plataforma e vê os menus.
  // O paywall não bloqueia mais o acesso — ele aparece como popup na AÇÃO
  // (clonar/gerar voz) quando faltam créditos. Ver PaywallModal + 402 nas
  // rotas generate/start-training.
  const email = profile?.email ?? user.email ?? null;
  const unlimited = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const admin = await isAdmin(email);

  // Tem voz pronta? Libera o item "Gerar Áudio" do submenu Vozes.
  const { count: readyVoices } = await supabase
    .from("voices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "ready");
  const hasReadyVoice = (readyVoices ?? 0) > 0;

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-[260px_1fr] bg-[var(--canvas)]">
      <Sidebar creditsTotal={creditsTotal} unlimited={unlimited} subscribed={subscribed} isAdmin={admin} hasReadyVoice={hasReadyVoice} />
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
      <PresencePinger />
    </div>
  );
}
