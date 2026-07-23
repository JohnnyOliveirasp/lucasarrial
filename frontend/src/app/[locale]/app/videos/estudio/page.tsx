import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { EstudioWizard } from "@/components/studio/estudio-wizard";
import { Eyebrow } from "@/components/ui";

/**
 * Estúdio de Vídeo (unificado) — F0: entrada única, wizard de 2 perguntas.
 * História/TikTok/Clone viram caminhos internos; nada muda pros alunos.
 *
 * 🚧 PRÉ-PRODUÇÃO: só admin acessa até o Lucas validar. Liberar = remover o
 * guard abaixo + mover o item do menu pro grupo Vídeos (sidebar.tsx).
 * Sem gate de crédito aqui: quem cobra são os destinos (cada fluxo já cobra).
 */
export default async function EstudioUnificadoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "studio.unified" });

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
  if (!(await isAdmin(email))) redirect({ href: "/app/dashboard", locale });

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">{t("subtitle")}</p>
      </header>

      <EstudioWizard />
    </div>
  );
}
