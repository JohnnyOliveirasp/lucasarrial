import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mic2, Video, UserCircle2, FileAudio } from "lucide-react";
import { Eyebrow } from "@/components/ui";

type Tool = {
  key: "voiceCloning" | "videoGen" | "avatar" | "transcription";
  href: string;
  icon: typeof Mic2;
  active: boolean;
};

const TOOLS: Tool[] = [
  { key: "voiceCloning", href: "/app/voice-cloning", icon: Mic2, active: true },
  { key: "videoGen", href: "/app/videos/history", icon: Video, active: true },
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
        <Eyebrow>{t("nav.dashboard")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("dashboard.title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t("dashboard.subtitle")}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map(({ key, href, icon: Icon, active }) => {
          const content = (
            <div
              className={[
                "flex h-full flex-col gap-4 rounded-[var(--radius-lg)] border bg-[var(--surface-card)] p-6 transition-[border-color,background-color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                active
                  ? "cursor-pointer border-[var(--hairline-strong)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-elevated)]"
                  : "cursor-not-allowed border-[var(--hairline)] opacity-60",
              ].join(" ")}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-7 w-7 text-[var(--silver)]" />
                {!active && (
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ash)]">
                    {t("comingSoon")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="font-sans text-xl font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                  {t(`dashboard.tools.${key}.name`)}
                </h2>
                <p className="text-sm text-[var(--mute)]">
                  {t(`dashboard.tools.${key}.description`)}
                </p>
              </div>
              {active && (
                <div className="mt-auto pt-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--silver)]">
                    {t("dashboard.tools.voiceCloning.cta")}
                    <span aria-hidden>→</span>
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
