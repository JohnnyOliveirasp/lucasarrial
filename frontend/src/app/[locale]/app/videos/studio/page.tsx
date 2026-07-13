import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { isAdmin } from "@/lib/admin/guard";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { Eyebrow } from "@/components/ui";

/**
 * Vídeo Estúdio — F0 (áudio impecável): grave errando à vontade; a plataforma
 * corta as tentativas repetidas, encolhe as pausas e devolve o áudio limpo com
 * transcrição. Fases seguintes montam o vídeo em cima deste áudio.
 *
 * GATE (crédito é o único gate): sem o mínimo, a ferramenta trava com CTA.
 */
export default async function VideoStudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "studio.page" });

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

  // 🚧 PRÉ-PRODUÇÃO: só admin acessa até o Lucas validar. Liberar = remover
  // este guard + mover o item do menu pro grupo Vídeos (sidebar.tsx).
  if (!(await isAdmin(email))) redirect({ href: "/app/dashboard", locale });
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const canUse = team || creditsTotal >= STUDIO_CLEAN_COST;

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">{t("subtitle")}</p>
      </header>

      {canUse ? (
        <StudioWorkspace creditsTotal={creditsTotal} unlimited={team} />
      ) : (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            <Lock className="h-5 w-5 text-[var(--silver)]" />
            {subscribed ? t("gateTitleCredits") : t("gateTitleSubscribe")}
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            {subscribed
              ? t("gateBodyCredits", {
                  cost: STUDIO_CLEAN_COST.toLocaleString("pt-BR"),
                  credits: creditsTotal.toLocaleString("pt-BR"),
                })
              : t("gateBodySubscribe")}
          </p>
          <Link
            href={subscribed ? "/app/credits" : "/planos"}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
          >
            {subscribed ? t("gateCtaBuy") : t("gateCtaSubscribe")}
            <span aria-hidden>→</span>
          </Link>
        </section>
      )}
    </div>
  );
}
