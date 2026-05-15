"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Languages } from "lucide-react";

const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "PT",
  en: "EN",
  es: "ES",
};

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("languageToggle");

  const handleChange = (next: Locale) => {
    router.replace(pathname, { locale: next });
  };

  return (
    <div className="relative">
      <details className="group">
        <summary
          aria-label={t("label")}
          className="flex h-11 cursor-pointer list-none items-center gap-2 border border-[var(--border)] px-3 text-[var(--fg)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] hover:border-[var(--accent)] md:h-9 [&::-webkit-details-marker]:hidden"
        >
          <Languages className="size-4" />
          <span className="label-mono">{LOCALE_LABELS[locale]}</span>
        </summary>
        <div className="absolute right-0 z-50 mt-1 flex w-[140px] flex-col border border-[var(--border)] bg-[var(--bg)] shadow-lg">
          {routing.locales.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleChange(option)}
              className={`flex min-h-11 items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                option === locale
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-[var(--fg)] hover:bg-[var(--surface)]"
              }`}
            >
              <span className="label-mono">{LOCALE_LABELS[option]}</span>
              <span className="text-[10px] text-[var(--muted-fg)]">
                {t(option)}
              </span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
