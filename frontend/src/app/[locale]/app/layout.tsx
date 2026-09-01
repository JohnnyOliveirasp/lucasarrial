import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { ConsentGate } from "@/components/app/consent-gate";
import { PresencePinger } from "@/components/admin/presence-pinger";
import { PurchaseAutoRefresh } from "@/components/app/purchase-auto-refresh";
import { PendingPaymentBanner } from "@/components/app/pending-payment-banner";
import { HelpWidget } from "@/components/app/help-widget";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { adminRole } from "@/lib/admin/guard";
import { socialPublisherAllowedEmail } from "@/lib/social/access";
import { claimPurchasesOnLogin } from "@/lib/payments/claim";

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

  let { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, plan, access_until, credits_subscription, credits_extra, pending_payment_at")
    .eq("id", user.id)
    .single();

  // Compra/cortesia feita ANTES da conta existir só era resgatada no
  // /auth/callback (OAuth) — quem entra por e-mail/senha nunca passava lá e
  // ficava pago sem acesso (caso dreduardosilva 22/07, 6 dias travado). Aqui
  // cobre TODOS os fluxos; roda só pra quem está sem plano (best-effort,
  // nunca quebra a página) e recarrega o profile se destravou algo.
  const claimEmail = profile?.email ?? user.email ?? null;
  if (claimEmail && (!profile || !profile.plan || profile.plan === "free")) {
    await claimPurchasesOnLogin(user.id, claimEmail);
    const { data: refreshed } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url, plan, access_until, credits_subscription, credits_extra, pending_payment_at")
      .eq("id", user.id)
      .single();
    if (refreshed) profile = refreshed;
  }

  // Entrada LIVRE: todo usuário logado entra na plataforma e vê os menus.
  // O paywall não bloqueia mais o acesso — ele aparece como popup na AÇÃO
  // (clonar/gerar voz) quando faltam créditos. Ver PaywallModal + 402 nas
  // rotas generate/start-training.
  const email = profile?.email ?? user.email ?? null;
  const unlimited = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  // Papel (mig 95): `admin` abre a pré-produção e os recursos que gastam
  // dinheiro; `suporte` só ganha o link do painel.
  const papel = await adminRole(email);
  const admin = papel === "admin";
  // Publicador: admin OU liberação individual (modelo "aluno pede", 13/08).
  const publisherAllowed = await socialPublisherAllowedEmail(email);

  // Pix/boleto aguardando pagamento: mostra o banner só se ainda SEM acesso e o
  // aviso for recente (< 3 dias — janela típica do Pix). Some quando liberar/expirar.
  const pendingAt = profile?.pending_payment_at ?? null;
  const pendingRecent = pendingAt
    ? Date.now() - new Date(pendingAt).getTime() < 3 * 24 * 60 * 60 * 1000
    : false;
  const showPendingBanner = !!pendingAt && pendingRecent && !subscribed && !unlimited;

  // Tem voz pronta? Libera o item "Gerar Áudio" do submenu Vozes.
  const { count: readyVoices } = await supabase
    .from("voices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "ready");
  const hasReadyVoice = (readyVoices ?? 0) > 0;

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-[260px_1fr] bg-[var(--canvas)]">
      <Sidebar creditsTotal={creditsTotal} unlimited={unlimited} subscribed={subscribed} isAdmin={admin} podeAbrirPainel={papel !== null} hasReadyVoice={hasReadyVoice} publisherAllowed={publisherAllowed} />
      <div className="flex flex-col">
        <Topbar
          email={profile?.email ?? user.email ?? ""}
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          creditsTotal={creditsTotal}
          unlimited={unlimited}
        />
        {showPendingBanner && <PendingPaymentBanner />}
        <main className="flex-1 px-6 py-10 lg:px-12">{children}</main>
      </div>
      <ConsentGate />
      <PresencePinger />
      <PurchaseAutoRefresh />
      <HelpWidget />
    </div>
  );
}
