import { getTranslations, setRequestLocale } from "next-intl/server";
import { VoiceCreator } from "@/components/voice/voice-creator";

export default async function NewVoicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "app.voiceCloningNew" });

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          {t("eyebrow")}
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-fg">{t("subtitle")}</p>
      </header>

      <VoiceCreator />
    </div>
  );
}
