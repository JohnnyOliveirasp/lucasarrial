"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Mic2, History, Settings } from "lucide-react";

const NAV = [
  { href: "/app/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/app/voice-cloning", icon: Mic2, key: "voiceCloning" as const },
  { href: "/app/history", icon: History, key: "history" as const },
  { href: "/app/settings", icon: Settings, key: "settings" as const, soon: true },
];

export function Sidebar() {
  const t = useTranslations("app");
  const pathname = usePathname();

  return (
    <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="border-b border-border px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg">
            {t("brand")}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, icon: Icon, key, soon }) => {
            const active = pathname.endsWith(href);
            return (
              <li key={href}>
                <Link
                  href={soon ? "#" : href}
                  aria-disabled={soon}
                  className={[
                    "group flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)]",
                    active
                      ? "bg-fg text-bg"
                      : "text-muted-fg hover:bg-bg hover:text-fg",
                    soon ? "cursor-not-allowed opacity-50" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{t(`nav.${key}`)}</span>
                  </span>
                  {soon && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-fg">
                      {t("comingSoon")}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-6 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-fg">
          v0.1 · dev
        </p>
      </div>
    </aside>
  );
}
