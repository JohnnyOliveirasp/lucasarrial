import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { EdicaoWizard } from "@/components/edicao/edicao-wizard";

/**
 * 🚧 Vídeo Edição 2.0 — wizard central (spec 11/08, project-video-edicao-wizard):
 * Roteiro → Áudio → Vídeo base (Cenas|Clone) → Editar? → Final.
 * PRÉ-PRODUÇÃO: só admin vê/usa até o veredito do Lucas.
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
    .select("email")
    .eq("id", user.id)
    .single();
  const email = profile?.email ?? user.email ?? null;
  // ✅ GRADUADO 13/08 (ordem do Johnny): aberto pra todos os alunos.
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
        <EdicaoWizard admin={admin} />
      </div>
    </div>
  );
}
