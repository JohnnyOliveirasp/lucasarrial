import { Link, redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { ROTEIRO_COST } from "@/lib/roteiro/config";
import { RoteiroWorkspace } from "@/components/roteiro/roteiro-workspace";
import { roteiroAllowedEmail } from "@/lib/roteiro/access";
import { Eyebrow } from "@/components/ui";

/**
 * Gerador de Roteiro — o aluno dá a ideia, a LLM escreve o roteiro pronto pra
 * ler gravando.
 *
 * GATE por CRÉDITO, não por assinatura (ordem do Johnny 18/08,
 * `_frank/ordens/2026-08-18_gate_por_credito.md`): quem pagou e cancelou
 * mantém o crédito E a porta. Mesmo desenho do videos/clone — sem o mínimo
 * (ROTEIRO_COST), a tela trava com CTA em vez de redirecionar. Substitui a
 * trava por assinatura de 13/08, que era a exceção que destoava do padrão.
 *
 * 🚧 PRÉ-PRODUÇÃO: só admin até o Lucas ler roteiro e dar o veredito. Ver
 * `lib/roteiro/access.ts` — graduar é uma linha.
 */
export const dynamic = "force-dynamic";

export default async function RoteiroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "roteiro" });

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
  if (!(await roteiroAllowedEmail(email))) {
    redirect({ href: "/app/dashboard", locale });
  }
  const team = bypassesBilling(email);
  // `subscribed` continua existindo SÓ pra escolher o texto do aviso e o
  // destino do CTA — não tranca mais nada (ordem do Johnny 18/08).
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const canGenerate = team || creditsTotal >= ROTEIRO_COST;

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">{t("description")}</p>
      </header>

      {canGenerate ? (
        <RoteiroWorkspace subscribed={subscribed} unlimited={team} />
      ) : (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            <Lock className="h-5 w-5 text-[var(--silver)]" />
            {subscribed ? t("lockedNoCredits") : t("lockedNoPlan")}
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            {subscribed
              ? t("lockedNoCreditsBody", {
                  min: ROTEIRO_COST.toLocaleString("pt-BR"),
                  have: creditsTotal.toLocaleString("pt-BR"),
                })
              : t("lockedNoPlanBody")}
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
  );
}
