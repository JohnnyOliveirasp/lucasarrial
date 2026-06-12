import { getTranslations, setRequestLocale } from "next-intl/server";
import { VoiceCreator } from "@/components/voice/voice-creator";
import { Eyebrow } from "@/components/ui";

export default async function NewVoicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "app.voiceCloningNew" });

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--mute)]">{t("subtitle")}</p>
      </header>

      <VoiceCreator />
    </div>
  );
}
