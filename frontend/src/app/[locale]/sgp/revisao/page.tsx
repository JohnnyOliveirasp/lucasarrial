import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { SgpShell } from "@/components/sgp/sgp-shell";

/** /sgp/revisao — Tela 4 (Confirmação & Autorização). PR 4 do plano; por enquanto só a moldura. */
export const dynamic = "force-dynamic";

export default async function SgpRevisaoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/sgp", locale });
  const t = await getTranslations({ locale, namespace: "sgp.revisao" });

  return (
    <SgpShell passo="revisao" titulo={t("titulo")} descricao={t("descricao")}>
      <p className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] px-4 py-8 text-center text-[14px] text-[var(--mute)]">
        {t("emConstrucao")}
      </p>
    </SgpShell>
  );
}
