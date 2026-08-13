import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { BancoCenas } from "@/components/studio/banco-cenas";

/**
 * 🚧 Banco de Cenas (13/08) — galeria das cenas do aluno + acervo
 * compartilhado (C3). PRÉ-PRODUÇÃO: gradua junto com o Vídeo Editor.
 */
export default async function BancoCenasPage({
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
    .select("email")
    .eq("id", user.id)
    .single();
  const email = profile?.email ?? user.email ?? null;
  if (!(await isAdmin(email))) return redirect({ href: "/app/dashboard", locale });

  const t = await getTranslations({ locale, namespace: "bancoCenas" });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--mute)]">
        {t("eyebrow")}
      </p>
      <h1 className="mt-1 font-sans text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        {t("title")}
      </h1>
      <p className="mt-1 text-[13.5px] text-[var(--mute)]">{t("subtitle")}</p>
      <div className="mt-6">
        <BancoCenas />
      </div>
    </div>
  );
}
