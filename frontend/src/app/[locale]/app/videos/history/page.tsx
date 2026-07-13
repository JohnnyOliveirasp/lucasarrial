import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { VideoBoard } from "@/components/video/video-board";
import { Eyebrow } from "@/components/ui";

/**
 * Vídeo História (board) — o quadro que acompanha os projetos de vídeo do usuário.
 * Cada projeto caminha pelos estágios do wizard (Áudio → Cenas → Imagens →
 * Vídeos → Final). Daqui ele cria um novo vídeo ou reabre um em andamento.
 *
 * Entrada livre (ver o board não custa); o gate de créditos acontece dentro do
 * wizard, nos estágios que geram (imagens/vídeos).
 */
export default async function VideoHistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("videoWizard.pages");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/login", locale: locale as Locale });

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("historyEyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("historyTitle")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t("historyIntro")}
        </p>
      </header>

      <VideoBoard />
    </div>
  );
}
