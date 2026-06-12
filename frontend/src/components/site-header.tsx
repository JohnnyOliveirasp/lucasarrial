"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageToggle } from "@/components/language-toggle";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="fixed top-0 z-50 w-full border-b border-[var(--hairline)] bg-[var(--canvas)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6 md:px-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2.5"
          aria-label={t("ariaBrand")}
        >
          <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
            <Image
              src="/brand/fastpost-glyph.png"
              alt=""
              width={16}
              height={16}
              className="size-4"
              priority
            />
          </span>
          <span className="font-sans text-[17px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            {t("brand")}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label={t("ariaPrimary")}
        >
          <a
            href="#solucao"
            className="text-[14px] font-medium tracking-[-0.01em] text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
          >
            {t("solution")}
          </a>
          <a
            href="#plataforma"
            className="text-[14px] font-medium tracking-[-0.01em] text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
          >
            {t("platform")}
          </a>
          <a
            href="#features"
            className="text-[14px] font-medium tracking-[-0.01em] text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
          >
            {t("features")}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-[var(--radius)] bg-[var(--pill-bg)] px-4 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </header>
  );
}
