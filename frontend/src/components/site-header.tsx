"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="fixed top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-display text-2xl uppercase leading-none tracking-tight"
          aria-label={t("ariaBrand")}
        >
          {t("brand")}
          <span className="text-[var(--accent)]">.</span>
        </Link>

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label={t("ariaPrimary")}
        >
          <a
            href="#solucao"
            className="label-mono text-[var(--muted-fg)] transition-colors hover:text-[var(--fg)]"
          >
            {t("solution")}
          </a>
          <a
            href="#plataforma"
            className="label-mono text-[var(--muted-fg)] transition-colors hover:text-[var(--fg)]"
          >
            {t("platform")}
          </a>
          <a
            href="#features"
            className="label-mono text-[var(--muted-fg)] transition-colors hover:text-[var(--fg)]"
          >
            {t("features")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center bg-[var(--accent)] px-4 font-sans text-xs font-semibold uppercase tracking-wider text-[var(--accent-fg)] transition-transform duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:-translate-y-[2px] md:h-9"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </header>
  );
}
