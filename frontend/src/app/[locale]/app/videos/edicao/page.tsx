import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { EdicaoWizard } from "@/components/edicao/edicao-wizard";

/**
 * 🎬 Estúdio Automático (Vídeo Edição 2.0) — wizard central:
 * Roteiro → Áudio → Vídeo base (Cenas|Clone) → Editar? → Final.
 *
 * GATE por CRÉDITO, não por assinatura (ordem do Johnny 18/08,
 * `_frank/ordens/2026-08-18_gate_por_credito.md`): quem pagou e cancelou
 * mantém o crédito E a porta. O wizard não tem um custo mínimo único (cada
 * etapa cobra o seu), então o critério é ter saldo (> 0), igual ao Settings.
 * Substitui a trava por assinatura de 13/08, que era a exceção que destoava.
 */
export default async function VideoEdicaoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, credits_subscription, credits_extra, access_until")
    .eq("id", user.id)
    .single();
  const email = profile?.email ?? user.email ?? null;
  // `subscribed` continua existindo SÓ pra escolher o texto do aviso e o
  // destino do CTA — não tranca mais nada (ordem do Johnny 18/08).
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const unlocked = bypassesBilling(email) || creditsTotal > 0;
  // O admin ainda importa: o caminho HeyGen (BYOK em validação) só aparece
  // pra admin; publicar continua atrás do gate do Publicador (App Review).
  const admin = await isAdmin(email);

  const t = await getTranslations({ locale, namespace: "edicao" });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--mute)]">
        {t("eyebrow")}
      </p>
      <h1 className="mt-1 font-sans text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        {t("title")}
      </h1>
      <p className="mt-1 text-[13.5px] text-[var(--mute)]">{t("subtitle")}</p>
      <div className="mt-6">
        {unlocked ? (
          <EdicaoWizard admin={admin} />
        ) : (
          <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
            <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              <Lock className="h-5 w-5 text-[var(--silver)]" />
              {subscribed ? t("lockedNoCredits") : t("lockedNoPlan")}
            </h2>
            <p className="max-w-xl text-sm text-[var(--mute)]">
              {subscribed ? t("lockedNoCreditsBody") : t("lockedNoPlanBody")}
            </p>
            <Link
              href={subscribed ? "/app/credits" : "/planos"}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
            >
              {subscribed ? t("buyCredits") : t("subscribe")}
              <span aria-hidden>→</span>
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
