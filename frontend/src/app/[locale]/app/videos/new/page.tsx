import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { AudioPicker } from "@/components/video/audio-picker";
import { Eyebrow } from "@/components/ui";

/**
 * Passo 1 do wizard de vídeo: escolher o áudio (TTS) que será a base.
 * Lista os áudios gerados do usuário com até 90s. Ao escolher, cria o projeto
 * e vai pro wizard (/app/videos/[id]).
 */
export default async function NewVideoPage({
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
        <Eyebrow>{t("newEyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("newTitle")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t("newIntro")}
        </p>
      </header>

      <AudioPicker />
    </div>
  );
}
