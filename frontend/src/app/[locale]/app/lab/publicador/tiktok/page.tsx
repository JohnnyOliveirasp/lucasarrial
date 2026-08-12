import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { socialPublisherAllowedEmail } from "@/lib/social/access";
import { SocialPublisher } from "@/components/lab/social-publisher";

/**
 * 🧪 Lab · Publicador → TikTok (12/08). Mesmo trilho do Instagram, página
 * própria (menu Publicador tem um submenu por rede — pedido do Johnny).
 * Sandbox do TikTok: posts saem privados até a auditoria aprovar.
 */
export const dynamic = "force-dynamic";

export default async function PublicadorTiktokPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("social");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).single();
  if (!(await socialPublisherAllowedEmail(profile?.email ?? user.email ?? null))) {
    redirect({ href: "/app/dashboard", locale });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ash)]">{t("labBadge")}</span>
        <h1 className="mt-1 font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          {t("tiktok.pageTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">{t("tiktok.pageSubtitle")}</p>
      </div>
      <SocialPublisher platform="tiktok" />
    </div>
  );
}
