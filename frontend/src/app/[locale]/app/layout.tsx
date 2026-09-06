import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileNavProvider } from "@/components/app/mobile-nav";
import { ConsentGate } from "@/components/app/consent-gate";
import { PresencePinger } from "@/components/admin/presence-pinger";
import { PurchaseAutoRefresh } from "@/components/app/purchase-auto-refresh";
import { PendingPaymentBanner } from "@/components/app/pending-payment-banner";
import { HelpWidget } from "@/components/app/help-widget";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { adminRole } from "@/lib/admin/guard";
import { socialPublisherAllowedEmail } from "@/lib/social/access";
import { claimPurchasesOnLogin } from "@/lib/payments/claim";
import { precisaResgatarCompras } from "@/lib/payments/claim-guard";

/**
 * Este usuário já recebeu alguma recarga de ciclo? É o que separa "nunca
 * recebeu" (incidente #283) de "recebeu e gastou tudo" — os dois chegam a
 * saldo 0, e só o primeiro precisa do resgate.
 *
 * `head: true` + `count: exact` não traz linha nenhuma, e o filtro
 * (user_id, kind) é atendido pelo índice `credit_tx_user_idx`
 * (user_id, created_at desc) — sem migration nova.
 *
 * Falha FECHADA: se a consulta der erro, responde "já recebeu", ou seja NÃO
 * dispara o resgate. Um banco intermitente não pode virar `claim` em toda
 * renderização.
 */
async function jaRecebeuRecargaDoCiclo(userId: string): Promise<boolean> {
  try {
    const { count, error } = await getAdmin()
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "subscription_grant");
    if (error) return true;
    return (count ?? 0) > 0;
  } catch {
    return true;
  }
}

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
  // cobre TODOS os fluxos (best-effort, nunca quebra a página) e recarrega o
  // profile se destravou algo.
  //
  // A guarda antiga era só `sem plano`, o que enxerga ACESSO faltando e é cega
  // pra CRÉDITO faltando: `gestao@qooqi.com.br` ficou `plan='pro'` com ZERO
  // crédito por 47 dias (incidente #283). Agora o plano pago com saldo zerado
  // também entra — mas SÓ se nunca houve recarga, pra quem gastou tudo
  // legitimamente não chamar o resgate a cada page load. Ver claim-guard.ts.
  const claimEmail = profile?.email ?? user.email ?? null;
  const precisaResgate =
    !!claimEmail &&
    (await precisaResgatarCompras({
      profile,
      bypassaCobranca: bypassesBilling(claimEmail),
      jaRecebeuRecarga: () => jaRecebeuRecargaDoCiclo(user.id),
    }));
  if (claimEmail && precisaResgate) {
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
    // MobileNavProvider: o hamburguer mora na Topbar e o drawer mora na
    // Sidebar — são irmãos, então o estado de aberto/fechado vive acima dos dois.
    <MobileNavProvider>
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
    </MobileNavProvider>
  );
}
