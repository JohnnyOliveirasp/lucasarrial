import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { VideoWizard } from "@/components/video/video-wizard";

/**
 * Wizard de vídeo (shell). Renderiza o stepper de 5 estágios e o conteúdo do
 * estágio atual. Fase 1: estágio Áudio concluído; demais como "em breve".
 * Estado vem de GET /api/v1/videos/[id] no client.
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

  return <VideoWizard projectId={id} locale={locale} />;
}
