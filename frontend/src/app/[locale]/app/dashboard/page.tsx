import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mic2, Video, UserCircle2, FileAudio } from "lucide-react";

type Tool = {
  key: "voiceCloning" | "videoGen" | "avatar" | "transcription";
  href: string;
  icon: typeof Mic2;
  active: boolean;
};

const TOOLS: Tool[] = [
  { key: "voiceCloning", href: "/app/voice-cloning", icon: Mic2, active: true },
  { key: "videoGen", href: "#", icon: Video, active: false },
  { key: "avatar", href: "#", icon: UserCircle2, active: false },
  { key: "transcription", href: "#", icon: FileAudio, active: false },
];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "app" });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          {t("nav.dashboard")}
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          {t("dashboard.title")}
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">{t("dashboard.subtitle")}</p>
      </header>

      <section className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map(({ key, href, icon: Icon, active }) => {
          const content = (
            <div
              className={[
                "flex h-full flex-col gap-4 bg-bg p-6 transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)]",
                active
                  ? "cursor-pointer hover:bg-fg hover:text-bg"
                  : "cursor-not-allowed opacity-60",
              ].join(" ")}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-8 w-8" />
                {!active && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
                    {t("comingSoon")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-2xl uppercase leading-tight tracking-tight">
                  {t(`dashboard.tools.${key}.name`)}
                </h2>
                <p className="text-sm text-current/70">
                  {t(`dashboard.tools.${key}.description`)}
                </p>
              </div>
              {active && (
                <div className="mt-auto pt-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                    {t("dashboard.tools.voiceCloning.cta")} →
                  </span>
                </div>
              )}
            </div>
          );
          return active ? (
            <Link key={key} href={href} className="block">
              {content}
            </Link>
          ) : (
            <div key={key}>{content}</div>
          );
        })}
      </section>
    </div>
  );
}
