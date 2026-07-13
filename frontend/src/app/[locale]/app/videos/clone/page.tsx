import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { CLONE_MIN_CREDITS } from "@/lib/video-clone/config";
import { CloneWorkspace } from "@/components/video-clone/clone-workspace";
import { CloneHistory } from "@/components/video-clone/clone-history";
import { Eyebrow } from "@/components/ui";

/**
 * Vídeo Clone — lip-sync (InfiniteTalk no nosso RunPod): foto + áudio → vídeo
 * da pessoa falando. Tela única: estúdio no topo, histórico abaixo.
 *
 * GATE (crédito é o único gate): sem o mínimo, a ferramenta trava com CTA;
 * o histórico segue visível.
 */
export default async function VideoClonePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("videoClone");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale: locale as Locale });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, credits_subscription, credits_extra, access_until")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email ?? null;
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const canGenerate = team || creditsTotal >= CLONE_MIN_CREDITS;

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("page.eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("page.title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t("page.description")}
        </p>
      </header>

      {canGenerate ? (
        <CloneWorkspace creditsTotal={creditsTotal} unlimited={team} />
      ) : (
        <div className="flex flex-col gap-12">
          <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
            <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              <Lock className="h-5 w-5 text-[var(--silver)]" />
              {subscribed ? t("page.lockedNoCredits") : t("page.lockedNoPlan")}
            </h2>
            <p className="max-w-xl text-sm text-[var(--mute)]">
              {subscribed
                ? t("page.lockedNoCreditsBody", {
                    min: CLONE_MIN_CREDITS.toLocaleString("pt-BR"),
                    have: creditsTotal.toLocaleString("pt-BR"),
                  })
                : t("page.lockedNoPlanBody")}
            </p>
            <Link
              href={subscribed ? "/app/credits" : "/planos"}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
            >
              {subscribed ? t("page.buyCredits") : t("page.subscribe")}
              <span aria-hidden>→</span>
            </Link>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {t("yourVideos")}
            </h2>
            <CloneHistory />
          </section>
        </div>
      )}
    </div>
  );
}
