import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProjectSwitch } from "@/components/video/project-switch";

/**
 * Wizard de vídeo (shell). O ProjectSwitch decide pelo `kind` do projeto:
 * story → VideoWizard (Vídeo História); sales → SalesSetup (Vídeo Vendas
 * TikTok) até a voz existir, depois converge pro mesmo pipeline.
 */
export default async function VideoWizardPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  return <ProjectSwitch projectId={id} locale={locale} />;
}
